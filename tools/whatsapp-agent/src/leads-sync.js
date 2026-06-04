/**
 * Syncs WhatsApp agent chat state → aiforx.org/admin/leads
 *
 * Create a lead when we have enough info.
 * Update status/notes on every stage change.
 * Agent stage → admin status mapping:
 *   new / collecting_info       → (skip, not enough yet)
 *   pre_qualified / qualifying  → "new"
 *   qualified                   → "contacted"
 *   objection / human_needed    → "contacted"
 *   ready_to_pay                → "qualified"
 */

// Valid program slugs on aiforx.org
const PROGRAM_MAP = {
  founder_lead: "founders",
  founders: "founders",
  operator_lead: "operators",
  operators: "operators",
  engineer_lead: "engineers",
  engineers: "engineers",
  company_lead: "businesses",
  businesses: "businesses",
  saudi_lead: "founders",
  doctors: "doctors",
  healthcare: "doctors",
};

const STAGE_TO_STATUS = {
  pre_qualified: "new",
  qualifying: "new",
  qualified: "contacted",
  objection: "contacted",
  human_needed: "contacted",
  ready_to_pay: "qualified",
};

function mapProgram(chat) {
  const industry = (chat.industry || "").toLowerCase();
  if (industry.includes("doctor") || industry.includes("clinic") || industry.includes("hospital")) {
    return "doctors";
  }
  const cat = chat.cohort || chat.category || "founders";
  return PROGRAM_MAP[cat] || "founders";
}

function mapRole(chat) {
  const cohort = chat.cohort || chat.category || "";
  if (cohort.includes("operator")) return "Operator / Manager";
  if (cohort.includes("engineer")) return "Engineer";
  if (cohort.includes("doctor") || (chat.industry || "").toLowerCase().includes("clinic")) return "Doctor";
  if (cohort.includes("company") || cohort.includes("business")) return "CEO / Company";
  if (cohort.includes("saudi")) return "Founder (Saudi)";
  return "Founder / Business Owner";
}

function mapStatus(stage) {
  return STAGE_TO_STATUS[stage] || null;
}

function formatPhone(number) {
  // Ensure it passes /^[+()\d\s-]{7,24}$/
  const digits = (number || "").replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";
  return `+${digits}`;
}

function isReadyToCreate(chat) {
  // Need at least a name and phone (not just a raw lid number)
  const hasName = chat.contactName && !chat.contactName.match(/^\d+$/);
  const hasPhone = chat.contactNumber && chat.contactNumber.match(/\d{7,}/);
  const hasContext = chat.company || chat.aiPriority || chat.summary || chat.industry;
  const stage = chat.stage || "new";
  const syncableStage = ["pre_qualified", "qualifying", "qualified", "objection", "ready_to_pay", "human_needed"].includes(stage);
  return hasName && hasPhone && syncableStage && hasContext;
}

async function callApi(config, method, body) {
  if (!config.leadsAdminToken || !config.leadsApiUrl) return null;
  try {
    const res = await fetch(config.leadsApiUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.leadsAdminToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error(`[leads-sync] API ${method} failed ${res.status}:`, json.message || JSON.stringify(json).slice(0, 120));
      return null;
    }
    return json;
  } catch (err) {
    console.error("[leads-sync] fetch error:", err.message);
    return null;
  }
}

// Cache of phone → leadId to avoid repeated API lookups
const phoneLeadCache = new Map();

async function findExistingLead(config, phone) {
  if (!phone) return null;

  // Check in-memory cache first
  const normalized = phone.replace(/\D/g, "").slice(-10); // last 10 digits
  if (phoneLeadCache.has(normalized)) return phoneLeadCache.get(normalized);

  try {
    const res = await fetch(config.leadsApiUrl, {
      headers: { Authorization: `Bearer ${config.leadsAdminToken}` }
    });
    if (!res.ok) return null;
    const { leads } = await res.json();
    if (!Array.isArray(leads)) return null;

    // Find any lead whose phone ends with the same last 10 digits
    const match = leads.find((lead) => {
      const leadPhone = (lead.phone || "").replace(/\D/g, "").slice(-10);
      return leadPhone === normalized && leadPhone.length >= 7;
    });

    if (match) {
      console.log(`[leads-sync] Found existing lead ${match.id} for phone ...${normalized}`);
      phoneLeadCache.set(normalized, match.id);
      return match.id;
    }
  } catch (err) {
    console.error("[leads-sync] findExistingLead error:", err.message);
  }
  return null;
}

async function createLead(config, chat) {
  const phone = formatPhone(chat.contactNumber);
  if (!phone) return null;

  const email = chat.email || `whatsapp+${chat.contactNumber || "unknown"}@pending.aiforx.org`;
  const business = chat.company || chat.industry || "Unknown";
  const problemStatement = chat.aiPriority || chat.summary || "Via WhatsApp — details in conversation.";

  const payload = {
    name: chat.contactName || "WhatsApp Lead",
    phone,
    email,
    program: mapProgram(chat),
    source_domain: "aiforx.org",
    business,
    role: mapRole(chat),
    business_stage: chat.industry || "",
    problem_statement: problemStatement.slice(0, 1200),
  };

  console.log(`[leads-sync] Creating lead for ${chat.contactName} (${phone})`);
  const result = await callApi(config, "POST", payload);
  if (result && result.id) {
    console.log(`[leads-sync] Created lead ${result.id}`);
    return result.id;
  }
  return null;
}

async function updateLead(config, leadId, chat, overrides = {}) {
  if (!leadId) return;
  const status = overrides.status || mapStatus(chat.stage);
  if (!status) return;

  const notes = buildNotes(chat);
  const payload = { id: leadId, status, notes };
  if (overrides.last_contacted_at) payload.last_contacted_at = overrides.last_contacted_at;

  console.log(`[leads-sync] Updating lead ${leadId} → status=${status}`);
  await callApi(config, "PATCH", payload);
}

function buildNotes(chat) {
  const lines = [];
  if (chat.company) lines.push(`Company: ${chat.company}`);
  if (chat.cohort) lines.push(`Cohort interest: ${chat.cohort}`);
  if (chat.industry) lines.push(`Industry: ${chat.industry}`);
  if (chat.aiPriority) lines.push(`AI Priority: ${chat.aiPriority}`);
  if (chat.email && !chat.email.includes("@pending.aiforx.org")) lines.push(`Email confirmed: ${chat.email}`);
  if (chat.summary) lines.push(`Summary: ${chat.summary}`);
  lines.push(`WhatsApp stage: ${chat.stage}`);
  lines.push(`Last inbound: ${chat.lastInboundAt || "unknown"}`);
  return lines.join("\n").slice(0, 1200);
}

/**
 * Main sync function — call after updating chat state.
 * Returns supabaseLeadId (new or existing) for storage.
 */
async function syncLeadToAdmin(config, chat) {
  if (!config.leadsAdminToken) return null;
  if (config.dryRun) return null;

  if (!isReadyToCreate(chat)) return null;

  let leadId = chat.supabaseLeadId || null;

  if (!leadId) {
    // Check if lead already exists in admin panel by phone number
    const phone = formatPhone(chat.contactNumber);
    const existingId = await findExistingLead(config, phone);

    if (existingId) {
      // Lead exists — link and update, don't duplicate
      leadId = existingId;
      console.log(`[leads-sync] Linking existing admin lead ${leadId} to WhatsApp chat`);
      await updateLead(config, leadId, chat, {
        last_contacted_at: chat.lastInboundAt || new Date().toISOString(),
      });
    } else {
      // No existing lead — create new
      leadId = await createLead(config, chat);
    }
  } else {
    await updateLead(config, leadId, chat, {
      last_contacted_at: chat.lastInboundAt || new Date().toISOString(),
    });
  }

  return leadId;
}

module.exports = { syncLeadToAdmin, mapStatus };
