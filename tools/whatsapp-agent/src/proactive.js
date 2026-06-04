/**
 * Proactive outreach — polls admin panel for new leads every 30s.
 * If a lead hasn't messaged on WhatsApp within 1 minute of being received,
 * agent sends the first message to them.
 *
 * Rate limits (to avoid WhatsApp flagging the account):
 *   - Max 10 proactive chats per day
 *   - Max 3 per hour
 *   - Min 3 minute gap between each initiation
 */

const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const seenLeadsPath = path.join(dataDir, "seen-leads.json");

// Safety limits — conservative to protect the WhatsApp account
const MAX_PER_DAY  = 10;
const MAX_PER_HOUR = 3;
const MIN_GAP_MS   = 3 * 60 * 1000; // 3 minutes between initiations

// leadId → { seenAt, initiated, initiatedAt? }
function loadSeen() {
  try { return JSON.parse(fs.readFileSync(seenLeadsPath, "utf8")); } catch { return {}; }
}
function saveSeen(seen) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(seenLeadsPath, JSON.stringify(seen, null, 2));
}

function countRecentInitiations(seen, windowMs) {
  const cutoff = Date.now() - windowMs;
  return Object.values(seen).filter(
    (s) => s.initiated && s.initiatedAt && s.initiatedAt > cutoff
  ).length;
}

function lastInitiationAt(seen) {
  const times = Object.values(seen)
    .filter((s) => s.initiated && s.initiatedAt)
    .map((s) => s.initiatedAt);
  return times.length ? Math.max(...times) : 0;
}

function cleanPhone(raw) {
  let digits = (raw || "").replace(/\D/g, "");
  if (!digits || digits.length < 7) return null;

  // Strip redundant 0 after country code — e.g. +966054... → 966054... → 96654...
  // Gulf: 966 or 971 followed by 0
  if (/^(966|971)0/.test(digits)) digits = digits.replace(/^(966|971)0/, (m, cc) => cc);
  // India: 910... (91 + leading 0)
  if (/^910[6-9]/.test(digits) && digits.length === 13) digits = digits.replace(/^910/, "91");

  // Already has country code (11+ digits, not starting with 0)
  if (digits.length >= 11 && !digits.startsWith("0")) return digits;
  // Indian 10-digit mobile (starts with 6-9)
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `91${digits}`;
  // Gulf 05x number without country code — default Saudi 966
  if (digits.startsWith("05") && digits.length === 10) return `966${digits.slice(1)}`;
  // Any other 0-prefixed number — strip leading 0
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function toWhatsAppId(phone) {
  const clean = cleanPhone(phone);
  if (!clean) return null;
  return `${clean}@c.us`;
}

function hasLeadTexted(chatState, phone) {
  const waId = toWhatsAppId(phone);
  if (!waId) return false;
  const chats = chatState.chats || {};
  // Check by @c.us ID or @lid (partial match on last 10 digits)
  const digits = cleanPhone(phone);
  if (!digits) return false;
  const last10 = digits.slice(-10);
  return Object.values(chats).some((chat) => {
    const chatNum = (chat.contactNumber || chat.chatId || "").replace(/\D/g, "").slice(-10);
    return chatNum === last10 && (chat.messages || []).some((m) => m.direction === "in");
  });
}

function buildFirstMessage(lead) {
  const name = (lead.name || "").split(" ")[0] || "there";
  const program = lead.program || "founders";
  const priority = lead.problem_statement || "";

  const programLabels = {
    founders: "AI for Founders",
    operators: "AI for Operators",
    engineers: "AI for Engineers",
    doctors: "AI for Doctors",
    businesses: "AI for Businesses",
  };
  const programLabel = programLabels[program] || "AI for Founders";

  const priorityLine = priority
    ? `\n\nYou mentioned: _"${priority.slice(0, 120)}"_ — that's exactly the kind of problem we tackle.`
    : "";

  return (
    `Hi ${name}! 👋 I'm the program manager for *${programLabel}*. I saw your application just came in.${priorityLine}\n\n` +
    `I'm here to help you understand if and how the program fits your situation. What would you like to know first?`
  );
}

async function fetchNewLeads(config) {
  if (!config.leadsAdminToken || !config.leadsApiUrl) return [];
  try {
    const res = await fetch(config.leadsApiUrl, {
      headers: { Authorization: `Bearer ${config.leadsAdminToken}` }
    });
    if (!res.ok) return [];
    const { leads } = await res.json();
    return Array.isArray(leads) ? leads : [];
  } catch (err) {
    console.error("[proactive] fetch leads error:", err.message);
    return [];
  }
}

async function runProactiveCheck(client, config, loadState, agentPendingBodies) {
  if (!config.leadsAdminToken || config.dryRun) return;

  const ownerDigits = (config.ownerNotifyNumber || "").replace(/\D/g, "").slice(-10);

  const leads = await fetchNewLeads(config);
  const seen = loadSeen();
  const now = Date.now();
  let changed = false;

  for (const lead of leads) {
    if (!lead.id || !lead.phone) continue;
    // Only act on new leads (status === "new")
    if (lead.status !== "new") continue;
    // Never initiate to owner's own number
    const leadDigits = cleanPhone(lead.phone || "").slice(-10);
    if (ownerDigits && leadDigits === ownerDigits) continue;

    const createdAt = new Date(lead.createdAt || lead.created_at || 0).getTime();
    const ageMs = now - createdAt;

    if (!seen[lead.id]) {
      // First time seeing this lead — record it
      seen[lead.id] = { seenAt: now, initiated: false };
      changed = true;
      console.log(`[proactive] New lead spotted: ${lead.name} (${lead.phone}) — waiting 1 min`);
      continue;
    }

    if (seen[lead.id].initiated) continue; // already sent

    const seenFor = now - seen[lead.id].seenAt;
    // Wait at least 1 minute since we first saw it AND since it was created
    if (seenFor < 60_000 || ageMs < 60_000) continue;

    // Check if they've already texted WhatsApp
    const state = loadState();
    if (hasLeadTexted(state, lead.phone)) {
      console.log(`[proactive] ${lead.name} already texted — skipping proactive`);
      seen[lead.id].initiated = true;
      changed = true;
      continue;
    }

    // Rate limit checks before sending
    const dailyCount  = countRecentInitiations(seen, 24 * 60 * 60 * 1000);
    const hourlyCount = countRecentInitiations(seen, 60 * 60 * 1000);
    const lastAt      = lastInitiationAt(seen);
    const gapMs       = Date.now() - lastAt;

    if (dailyCount >= MAX_PER_DAY) {
      console.log(`[proactive] Daily limit reached (${MAX_PER_DAY}/day) — pausing outreach`);
      break;
    }
    if (hourlyCount >= MAX_PER_HOUR) {
      console.log(`[proactive] Hourly limit reached (${MAX_PER_HOUR}/hour) — will retry next poll`);
      continue;
    }
    if (lastAt && gapMs < MIN_GAP_MS) {
      const waitSec = Math.ceil((MIN_GAP_MS - gapMs) / 1000);
      console.log(`[proactive] Gap too short — waiting ${waitSec}s before next initiation`);
      continue;
    }

    // Send first message
    const waId = toWhatsAppId(lead.phone);
    if (!waId) {
      console.log(`[proactive] Could not parse phone for ${lead.name}: ${lead.phone}`);
      seen[lead.id].initiated = true;
      changed = true;
      continue;
    }

    const msg = buildFirstMessage(lead);
    console.log(`[proactive] Initiating chat with ${lead.name} (${waId}) [day:${dailyCount+1}/${MAX_PER_DAY} hour:${hourlyCount+1}/${MAX_PER_HOUR}]`);

    try {
      agentPendingBodies.add(msg);
      await client.sendMessage(waId, msg);
      agentPendingBodies.delete(msg);
      seen[lead.id].initiated = true;
      seen[lead.id].initiatedAt = Date.now();
      changed = true;
      console.log(`[proactive] Sent to ${lead.name}`);
    } catch (err) {
      agentPendingBodies.delete(msg);
      // Mark as initiated (failed) so we don't keep retrying every 30s
      seen[lead.id].initiated = true;
      seen[lead.id].failed = true;
      seen[lead.id].failReason = err.message.slice(0, 100);
      changed = true;
      console.error(`[proactive] Failed to send to ${lead.name} (${waId}): ${err.message.slice(0, 80)}`);
      // Notify Sami so he can check/fix the phone number
      if (config.ownerNotifyNumber) {
        const to = `${config.ownerNotifyNumber}@c.us`;
        const alert = `⚠️ *Proactive send failed*\nLead: ${lead.name}\nPhone: ${lead.phone}\nCould not reach on WhatsApp — check number format in admin panel.`;
        agentPendingBodies.add(alert);
        client.sendMessage(to, alert).catch(() => {}).finally(() => agentPendingBodies.delete(alert));
      }
    }
  }

  if (changed) saveSeen(seen);
}

module.exports = { runProactiveCheck };
