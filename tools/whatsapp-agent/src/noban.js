const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const logPath = path.join(dataDir, "agent.log");
const envPath = path.join(__dirname, "..", ".env");

const REPLY_LIMIT_PER_HOUR = 20;
const BURST_LIMIT = 5;
const BURST_WINDOW_MS = 5 * 60 * 1000;
const CHECK_WINDOW_MS = 60 * 60 * 1000;
const DUPLICATE_THRESHOLD = 3;

function pauseAgent() {
  try {
    let env = fs.readFileSync(envPath, "utf8");
    if (!env.includes("AGENT_PAUSED=")) {
      env += "\nAGENT_PAUSED=1\n";
    } else {
      env = env.replace(/AGENT_PAUSED=.*/g, "AGENT_PAUSED=1");
    }
    fs.writeFileSync(envPath, env);
  } catch (e) {
    console.error("[noban] Could not pause agent:", e.message);
  }
}

function parseRecentLines(windowMs) {
  const since = Date.now() - windowMs;
  try {
    const content = fs.readFileSync(logPath, "utf8");
    return content.split("\n").filter(Boolean).filter(line => {
      const m = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\]/);
      return m && new Date(m[1]).getTime() >= since;
    });
  } catch { return []; }
}

function extractTimestamp(line) {
  const m = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.Z]+)\]/);
  return m ? new Date(m[1]).getTime() : 0;
}

function checkBanRisks() {
  const issues = [];
  const hourLines = parseRecentLines(CHECK_WINDOW_MS);

  // 1. Proactive first-contact messages
  const proactive = hourLines.filter(l =>
    l.includes("[proactive] Initiating") || l.includes("[proactive] Sent")
  );
  if (proactive.length > 0) {
    issues.push(`🚨 Proactive outreach: ${proactive.length} first-contact message(s) sent — agent must not initiate new conversations`);
  }

  // 2. Total reply volume in last hour
  const sentLines = hourLines.filter(l =>
    l.includes("[reply:send]") || l.includes("[catch-up:send]") || l.includes("[outbound]")
  );
  if (sentLines.length > REPLY_LIMIT_PER_HOUR) {
    issues.push(`⚠️ High volume: ${sentLines.length} messages sent in the last hour (limit: ${REPLY_LIMIT_PER_HOUR})`);
  }

  // 3. Burst — too many messages in a 5-minute window
  const sentTimestamps = sentLines.map(extractTimestamp).filter(Boolean).sort();
  for (let i = 0; i < sentTimestamps.length; i++) {
    const windowEnd = sentTimestamps[i] + BURST_WINDOW_MS;
    const burst = sentTimestamps.filter(t => t >= sentTimestamps[i] && t <= windowEnd).length;
    if (burst > BURST_LIMIT) {
      const when = new Date(sentTimestamps[i]).toLocaleTimeString();
      issues.push(`⚠️ Burst detected: ${burst} messages sent within 5 minutes at ~${when} (limit: ${BURST_LIMIT})`);
      break;
    }
  }

  // 4. Duplicate message bodies sent to multiple leads
  const replyTexts = sentLines.map(l => {
    const m = l.match(/\[reply:send\] [^:]+: (.+)$/);
    return m ? m[1].slice(0, 60).toLowerCase().trim() : null;
  }).filter(Boolean);
  const counts = {};
  replyTexts.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const dupes = Object.entries(counts).filter(([, n]) => n >= DUPLICATE_THRESHOLD);
  if (dupes.length > 0) {
    issues.push(`⚠️ Duplicate replies: "${dupes[0][0].slice(0, 50)}..." sent ${dupes[0][1]} times — looks like bulk messaging`);
  }

  // 5. Ban/spam errors from WhatsApp
  const banErrors = hourLines.filter(l =>
    l.includes("ERROR") &&
    (l.toLowerCase().includes("spam") || l.toLowerCase().includes("banned") ||
     l.toLowerCase().includes("blocked") || l.toLowerCase().includes("rate limit") ||
     l.toLowerCase().includes("too many request"))
  );
  if (banErrors.length > 0) {
    issues.push(`🚨 WhatsApp error: ${banErrors[0].slice(0, 120)}`);
  }

  return issues;
}

async function runNoBanCheck(client, agentPendingBodies, config) {
  const issues = checkBanRisks();

  if (issues.length === 0) {
    console.log("[noban] ✅ Check passed — no ban risks in last hour");
    return;
  }

  console.error(`[noban] ⚠️ ${issues.length} ban risk(s) detected — pausing agent`);
  pauseAgent();

  if (!client || !config.ownerNotifyNumber) return;

  const msg =
    `⚠️ *BAN RISK — Agent auto-paused*\n\n` +
    issues.join("\n") +
    `\n\n_Agent stopped itself. Review the issues above, then turn it back on from the dashboard._`;

  const to = config.ownerNotifyNumber.includes("@")
    ? config.ownerNotifyNumber
    : `${config.ownerNotifyNumber}@c.us`;

  try {
    if (agentPendingBodies) agentPendingBodies.add(msg);
    await client.sendMessage(to, msg);
    if (agentPendingBodies) agentPendingBodies.delete(msg);
    console.log("[noban] Sami notified via WhatsApp");
  } catch (e) {
    console.error("[noban] Failed to notify Sami:", e.message);
  }
}

module.exports = { runNoBanCheck };
