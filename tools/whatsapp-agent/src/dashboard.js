/**
 * Local dashboard server — runs on http://localhost:3001
 * Tabs: Leads | Settings | Knowledge | Connect
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const logPath = path.join(dataDir, "agent.log");
const envPath = path.join(__dirname, "..", ".env");
const knowledgeDir = path.join(__dirname, "..", "knowledge");

const PORT = 3001;

let _client = null;
let _agentPendingBodies = null;
let _isClientReady = false;

// ── Log helpers ───────────────────────────────────────────────────────────────

function readLastLines(filePath, n) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n").filter(Boolean);
    return lines.slice(-n).join("\n");
  } catch {
    return "";
  }
}

// ── Agent pause/resume ────────────────────────────────────────────────────────

function isPaused() {
  try {
    const env = fs.readFileSync(envPath, "utf8");
    return env.includes("AGENT_PAUSED=1");
  } catch {
    return false;
  }
}

function setAgentPaused(paused) {
  try {
    let env = fs.readFileSync(envPath, "utf8");
    if (paused) {
      if (!env.includes("AGENT_PAUSED=")) {
        env += "\nAGENT_PAUSED=1\n";
      } else {
        env = env.replace(/AGENT_PAUSED=.*/g, "AGENT_PAUSED=1");
      }
    } else {
      env = env.replace(/\nAGENT_PAUSED=.*\n?/g, "\n").replace(/AGENT_PAUSED=.*\n?/g, "");
    }
    fs.writeFileSync(envPath, env);
    return true;
  } catch {
    return false;
  }
}

// ── Lead/chat helpers ─────────────────────────────────────────────────────────

function getChats() {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(dataDir, "state.json"), "utf8"));
    return Object.values(state.chats || {})
      .filter(c => (c.messages || []).length > 0)
      .sort((a, b) => {
        const ta = b.lastInboundAt || b.lastOutboundAt || "";
        const tb = a.lastInboundAt || a.lastOutboundAt || "";
        return ta.localeCompare(tb);
      })
      .map(c => ({
        chatId: c.chatId,
        name: c.contactName && !c.contactName.match(/^\d{12,}$/) ? c.contactName : "Unknown",
        number: c.contactNumber || "",
        stage: c.stage || "new",
        industry: c.industry || "",
        paused: !!(c.pausedUntil && new Date(c.pausedUntil).getTime() > Date.now()),
        pausedUntil: c.pausedUntil || null,
        lastInbound: c.lastInboundAt ? new Date(c.lastInboundAt).toLocaleString() : "never",
        lastMsg: (c.messages || []).filter(m => m.direction === "in").slice(-1)[0]?.body?.slice(0, 80) || "",
        lastMsgDirection: (c.messages || []).slice(-1)[0]?.direction || "",
        daysSilent: c.lastInboundAt ? Math.max(0, Math.floor((Date.now() - new Date(c.lastInboundAt).getTime()) / 86400000)) : null
      }));
  } catch { return []; }
}

function unpauseChat(chatId) {
  try {
    const statePath = path.join(dataDir, "state.json");
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    if (chatId === "all") {
      Object.values(state.chats || {}).forEach(c => { c.pausedUntil = null; });
    } else if (state.chats[chatId]) {
      state.chats[chatId].pausedUntil = null;
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    return true;
  } catch { return false; }
}

function generateFollowUpDraft(chat) {
  const firstName = (chat.contactName || "").split(" ")[0] || "there";
  const stage = chat.stage || "new";
  const msgs = chat.messages || [];
  const lastMsg = msgs[msgs.length - 1];
  const leadIsWaiting = lastMsg && lastMsg.direction === "in";
  const daysSilent = chat.lastInboundAt
    ? Math.max(0, Math.floor((Date.now() - new Date(chat.lastInboundAt).getTime()) / 86400000))
    : null;

  if (leadIsWaiting && lastMsg) {
    return { type: "reply", daysSilent, draft: null };
  }

  const urgency = daysSilent !== null && daysSilent >= 7;

  switch (stage) {
    case "ready_to_pay":
      return {
        type: "followup", daysSilent,
        draft: urgency
          ? `Hey ${firstName}, last check — should I release your seat or hold it for the next batch?`
          : `Hey ${firstName}, did you get a chance to look at the payment details? Happy to hold your seat for 24h.`
      };
    case "qualified":
    case "qualifying":
      return {
        type: "followup", daysSilent,
        draft: urgency
          ? `Hey ${firstName}, we have a few seats left in the next batch. Want me to hold one for you?`
          : `Hey ${firstName}, any questions about the program before you decide?`
      };
    case "pre_qualified":
      return {
        type: "followup", daysSilent,
        draft: `Hey ${firstName}, you applied a few days ago — still interested? Happy to answer any questions.`
      };
    case "objection":
      return {
        type: "followup", daysSilent,
        draft: `Hey ${firstName}, hope that cleared things up. Any other questions before we move forward?`
      };
    default:
      return {
        type: "followup", daysSilent,
        draft: `Hey ${firstName}, just following up — still exploring how AI can help your business?`
      };
  }
}

async function sendMessageFromDashboard(chatId, text) {
  if (!_client) throw new Error("WhatsApp client not ready yet.");
  if (_agentPendingBodies) _agentPendingBodies.add(text);
  await _client.sendMessage(chatId, text);
  if (_agentPendingBodies) _agentPendingBodies.delete(text);
  const { appendMessage, updateChatState } = require("./state");
  appendMessage(chatId, { direction: "out", fromAgent: true, body: text, at: new Date().toISOString() });
  updateChatState(chatId, { lastOutboundAt: new Date().toISOString() });
}

function getLeadStats() {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(dataDir, "state.json"), "utf8"));
    const chats = Object.values(state.chats || {});
    const total = chats.length;
    const readyToPay = chats.filter(c => c.stage === "ready_to_pay").length;
    const qualified = chats.filter(c => c.stage === "qualified").length;
    const active = chats.filter(c => {
      if (!c.lastInboundAt) return false;
      return Date.now() - new Date(c.lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
    }).length;
    return { total, readyToPay, qualified, active };
  } catch {
    return { total: 0, readyToPay: 0, qualified: 0, active: 0 };
  }
}

// ── Settings helpers ──────────────────────────────────────────────────────────

const EDITABLE_KEYS = new Set([
  "AGENT_OWNER_NAME", "AGENT_OWNER_NOTIFY_NUMBER",
  "PROGRAM_NAME", "PROGRAM_FEE", "PROGRAM_PAYMENT_DETAILS",
  "PROGRAM_BATCH_DATE", "PROGRAM_SEAT_LIMIT",
  "AGENT_REPLY_DELAY_SECONDS", "AGENT_REPLY_DELAY_MAX_SECONDS",
  "AGENT_BRAIN_PROVIDER", "OLLAMA_MODEL", "OLLAMA_BASE_URL", "DRY_RUN"
]);

function readEnvValues() {
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    const result = {};
    raw.split("\n").forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) result[m[1]] = m[2].trim();
    });
    return result;
  } catch { return {}; }
}

function writeEnvValues(updates) {
  try {
    let raw = fs.readFileSync(envPath, "utf8");
    Object.entries(updates).forEach(([key, value]) => {
      if (!EDITABLE_KEYS.has(key)) return; // only whitelisted keys
      const re = new RegExp(`^${key}=.*$`, "m");
      if (re.test(raw)) {
        raw = raw.replace(re, `${key}=${value}`);
      } else {
        raw = raw.trimEnd() + `\n${key}=${value}\n`;
      }
    });
    fs.writeFileSync(envPath, raw);
    return true;
  } catch (e) {
    console.error("[settings] write error:", e.message);
    return false;
  }
}

function readKnowledgeFile(name) {
  if (!["program", "learnings"].includes(name)) return null;
  try {
    return fs.readFileSync(path.join(knowledgeDir, `${name}.md`), "utf8");
  } catch { return ""; }
}

function writeKnowledgeFile(name, content) {
  if (!["program", "learnings"].includes(name)) return false;
  try {
    fs.mkdirSync(knowledgeDir, { recursive: true });
    fs.writeFileSync(path.join(knowledgeDir, `${name}.md`), content);
    return true;
  } catch { return false; }
}

// ── HTML ──────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#0f0f0f">
<title>HumainW Agent — 2imlabs</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f0f; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

  /* ── Header ─────────────────────────────────────────────── */
  header { background: #111; border-bottom: 1px solid #222; padding: 0 16px 0 20px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; gap: 12px; height: 52px; }
  .brand { display: flex; flex-direction: column; gap: 1px; line-height: 1; }
  .brand-name { font-size: 15px; font-weight: 700; color: #fff; letter-spacing: -.2px; }
  .brand-name span { color: #3b82f6; }
  .brand-by { font-size: 9px; font-weight: 600; color: #facc15; text-transform: uppercase; letter-spacing: 1.2px; }
  .fullscreen-btn { background: none; border: 1px solid #2a2a2a; border-radius: 5px; color: #555; font-size: 12px; padding: 4px 8px; cursor: pointer; transition: .15s; flex-shrink: 0; }
  .fullscreen-btn:hover { color: #e0e0e0; border-color: #444; }
  .status { display: flex; align-items: center; gap: 8px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
  .dot.off { background: #ef4444; animation: none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .status-text { font-size: 13px; color: #aaa; }
  .toggle-wrap { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .toggle-label { font-size: 13px; color: #aaa; }
  .toggle { position: relative; width: 44px; height: 24px; cursor: pointer; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: #333; border-radius: 24px; transition: .3s; }
  .slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
  input:checked + .slider { background: #22c55e; }
  input:checked + .slider:before { transform: translateX(20px); }

  /* ── Tab nav ─────────────────────────────────────────────── */
  .nav-bar { background: #141414; border-bottom: 1px solid #222; padding: 0 16px; display: flex; flex-shrink: 0; }
  .nav-tab { background: none; border: none; border-bottom: 2px solid transparent; color: #555; font: inherit; font-size: 12px; font-weight: 500; padding: 9px 16px; cursor: pointer; transition: .15s; letter-spacing: .2px; }
  .nav-tab:hover { color: #bbb; }
  .nav-tab.active { color: #e0e0e0; border-bottom-color: #3b82f6; }

  /* ── Banners ─────────────────────────────────────────────── */
  .paused-banner { background: #7f1d1d; color: #fca5a5; padding: 6px 20px; font-size: 13px; font-weight: 600; text-align: center; display: none; flex-shrink: 0; }
  .paused-banner.visible { display: block; }
  .setup-banner { background: #1c1407; color: #fbbf24; border-bottom: 1px solid #78350f; padding: 7px 20px; font-size: 12px; text-align: center; display: none; flex-shrink: 0; cursor: pointer; }
  .setup-banner:hover { background: #291e0a; }
  .setup-banner.visible { display: block; }

  /* ── Stats bar ───────────────────────────────────────────── */
  .stats { display: flex; gap: 10px; padding: 10px 20px; background: #0f0f0f; border-bottom: 1px solid #1a1a1a; flex-shrink: 0; }
  .stat { background: #161616; border: 1px solid #1e1e1e; border-radius: 8px; padding: 7px 14px; min-width: 76px; }
  .stat-num { font-size: 20px; font-weight: 700; color: #fff; }
  .stat-lbl { font-size: 10px; color: #555; margin-top: 1px; text-transform: uppercase; letter-spacing: .3px; }
  .stat.hot .stat-num { color: #f97316; }

  /* ── Tab content ─────────────────────────────────────────── */
  .tab-content { display: none; flex: 1; overflow: hidden; }
  .tab-content.active { display: flex; }
  #tab-leads.active { flex-direction: row; }
  #tab-settings.active, #tab-knowledge.active, #tab-connect.active { flex-direction: column; }

  /* ── Leads tab ───────────────────────────────────────────── */
  .leads-panel { width: 300px; flex-shrink: 0; border-right: 1px solid #2a2a2a; overflow-y: auto; background: #0f0f0f; }
  .leads-header { padding: 10px 14px; font-size: 11px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: .6px; border-bottom: 1px solid #1e1e1e; display: flex; justify-content: space-between; align-items: center; }
  .unpause-all { font-size: 11px; cursor: pointer; background: none; border-radius: 4px; padding: 2px 8px; transition: background .2s; }
  .unpause-all.none-paused { color: #22c55e; border: 1px solid #22c55e44; }
  .unpause-all.none-paused:hover { background: #22c55e22; }
  .unpause-all.some-paused { color: #ef4444; border: 1px solid #ef444444; }
  .unpause-all.some-paused:hover { background: #ef444422; }
  .lead-item { padding: 10px 14px; border-bottom: 1px solid #1a1a1a; }
  .lead-item:hover { background: #141414; }
  .lead-name { font-size: 13px; font-weight: 600; color: #e0e0e0; }
  .lead-meta { font-size: 11px; color: #555; margin-top: 2px; }
  .lead-msg { font-size: 11px; color: #555; margin-top: 3px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lead-row { display: flex; justify-content: space-between; align-items: center; }
  .stage-badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 600; flex-shrink: 0; }
  .stage-ready_to_pay { background: #431407; color: #fb923c; }
  .stage-qualified { background: #052e16; color: #34d399; }
  .stage-qualifying, .stage-pre_qualified, .stage-collecting_info { background: #1e1b4b; color: #a78bfa; }
  .stage-human_needed { background: #450a0a; color: #f87171; }
  .stage-new { background: #1c1c1c; color: #555; }
  .stage-objection { background: #1c1407; color: #facc15; }
  .paused-tag { font-size: 10px; color: #f59e0b; }
  .unpause-btn { font-size: 10px; color: #f59e0b; cursor: pointer; background: none; border: 1px solid #f59e0b44; border-radius: 4px; padding: 1px 6px; white-space: nowrap; }
  .unpause-btn:hover { background: #f59e0b22; }
  .followup-btn { font-size: 10px; color: #60a5fa; cursor: pointer; background: none; border: 1px solid #60a5fa44; border-radius: 4px; padding: 1px 6px; white-space: nowrap; margin-left: 4px; }
  .followup-btn:hover { background: #60a5fa22; }
  .log-container { flex: 1; overflow-y: auto; padding: 12px 20px; }
  .log-line { font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; line-height: 1.7; padding: 1px 0; border-bottom: 1px solid #141414; white-space: pre-wrap; word-break: break-all; }
  .log-line.info { color: #9ca3af; }
  .log-line.error { color: #f87171; }
  .log-line.reply { color: #34d399; }
  .log-line.escalate { color: #fb923c; }
  .log-line.owner { color: #a78bfa; }
  .log-line.pause { color: #facc15; }
  .log-line.ready { color: #22d3ee; font-weight: 600; }

  /* ── Settings tab ────────────────────────────────────────── */
  .settings-scroll { flex: 1; overflow-y: auto; padding: 28px 28px 40px; }
  .settings-grid { max-width: 680px; }
  .settings-section { margin-bottom: 32px; }
  .settings-section-title { font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #1e1e1e; }
  .field-row { display: grid; grid-template-columns: 200px 1fr; align-items: start; gap: 6px 20px; margin-bottom: 14px; }
  .field-label { font-size: 12px; color: #aaa; padding-top: 9px; }
  .field-req { color: #f87171; font-size: 10px; margin-left: 2px; }
  .field-hint { font-size: 10px; color: #444; margin-top: 3px; }
  .field-input { background: #141414; border: 1px solid #272727; border-radius: 6px; color: #e0e0e0; font: inherit; font-size: 13px; padding: 8px 10px; width: 100%; transition: border-color .15s; }
  .field-input:focus { outline: none; border-color: #3b82f6; background: #161616; }
  .field-input.empty-required { border-color: #7f1d1d; background: #100808; }
  .field-textarea { resize: vertical; min-height: 68px; font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; line-height: 1.6; }
  .field-select { background: #141414; border: 1px solid #272727; border-radius: 6px; color: #e0e0e0; font: inherit; font-size: 13px; padding: 8px 10px; width: 100%; cursor: pointer; }
  .field-select:focus { outline: none; border-color: #3b82f6; }
  .settings-actions { display: flex; align-items: center; gap: 14px; padding-top: 4px; }
  .btn-save { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 10px 24px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
  .btn-save:hover { background: #1d4ed8; }
  .save-status { font-size: 12px; color: #22c55e; }
  .restart-note { font-size: 11px; color: #444; margin-top: 10px; }

  /* ── Knowledge tab ───────────────────────────────────────── */
  .knowledge-scroll { flex: 1; overflow-y: auto; padding: 28px 28px 40px; }
  .knowledge-grid { max-width: 860px; display: flex; flex-direction: column; gap: 32px; }
  .knowledge-block { display: flex; flex-direction: column; gap: 10px; }
  .knowledge-title { font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; }
  .knowledge-desc { font-size: 12px; color: #555; }
  .knowledge-textarea { background: #0f0f0f; border: 1px solid #222; border-radius: 6px; color: #c9d1d9; font-family: "SF Mono", "Fira Code", monospace; font-size: 12px; line-height: 1.7; padding: 14px; resize: vertical; min-height: 260px; width: 100%; transition: border-color .15s; }
  .knowledge-textarea:focus { outline: none; border-color: #3b82f6; }
  .knowledge-actions { display: flex; align-items: center; gap: 12px; }
  .k-save-status { font-size: 12px; color: #22c55e; }

  /* ── Connect tab ─────────────────────────────────────────── */
  .connect-scroll { flex: 1; overflow-y: auto; padding: 40px 20px; }
  .connect-center { display: flex; flex-direction: column; align-items: center; gap: 22px; max-width: 400px; margin: 0 auto; text-align: center; }
  .connect-status-box { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .connect-dot-wrap { width: 52px; height: 52px; border-radius: 50%; background: #1a1a1a; display: flex; align-items: center; justify-content: center; border: 2px solid #2a2a2a; }
  .connect-dot { width: 18px; height: 18px; border-radius: 50%; background: #555; }
  .connect-dot.on { background: #22c55e; box-shadow: 0 0 10px #22c55e66; animation: pulse 2s infinite; }
  .connect-dot.off { background: #ef4444; }
  .connect-heading { font-size: 17px; font-weight: 700; color: #fff; }
  .connect-sub { font-size: 13px; color: #555; line-height: 1.7; }
  .btn-wa { display: flex; align-items: center; gap: 10px; background: #0f2318; color: #25D366; border: 1px solid #25D36644; border-radius: 8px; padding: 12px 22px; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: .15s; }
  .btn-wa:hover { background: #142d1f; border-color: #25D366aa; }
  .connect-how { background: #131313; border: 1px solid #1e1e1e; border-radius: 8px; padding: 16px 18px; text-align: left; width: 100%; }
  .connect-how-title { font-size: 10px; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
  .connect-how-step { display: flex; gap: 12px; align-items: flex-start; font-size: 12px; color: #666; line-height: 1.6; margin-bottom: 8px; }
  .connect-how-step:last-child { margin-bottom: 0; }
  .connect-how-step span { background: #1e1e1e; color: #3b82f6; font-size: 10px; font-weight: 700; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .connect-how-step em { color: #22c55e; font-style: normal; }
  .btn-secondary { background: none; color: #555; border: 1px solid #222; border-radius: 6px; padding: 7px 16px; font: inherit; font-size: 12px; cursor: pointer; transition: .15s; }
  .btn-secondary:hover { color: #e0e0e0; border-color: #444; }

  /* ── Follow-up modal ─────────────────────────────────────── */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.75); z-index: 100; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 20px; width: min(480px, 90vw); display: flex; flex-direction: column; gap: 12px; }
  .modal-title { font-size: 13px; font-weight: 600; color: #fff; }
  .modal-meta { font-size: 11px; color: #666; }
  .modal-textarea { background: #111; border: 1px solid #333; border-radius: 6px; color: #e0e0e0; font-family: inherit; font-size: 13px; line-height: 1.6; padding: 10px; resize: vertical; min-height: 100px; width: 100%; }
  .modal-textarea:focus { outline: none; border-color: #60a5fa; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .modal-send { background: #2563eb; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .modal-send:hover { background: #1d4ed8; }
  .modal-send:disabled { opacity: .5; cursor: not-allowed; }
  .modal-cancel { background: none; color: #888; border: 1px solid #333; border-radius: 6px; padding: 8px 14px; font: inherit; font-size: 13px; cursor: pointer; }
  .modal-cancel:hover { color: #e0e0e0; }
  .modal-status { font-size: 12px; color: #60a5fa; min-height: 18px; }

  /* ── Footer ──────────────────────────────────────────────── */
  .footer { padding: 6px 20px; background: #0f0f0f; border-top: 1px solid #1a1a1a; font-size: 11px; color: #333; display: flex; justify-content: space-between; flex-shrink: 0; }
</style>
</head>
<body>

<header>
  <div class="brand">
    <div class="brand-name">Humain<span>W</span> Agent</div>
    <div class="brand-by">by 2imlabs</div>
  </div>
  <div class="status">
    <div class="dot" id="dot"></div>
    <span class="status-text" id="statusText">Connected</span>
  </div>
  <div style="display:flex;align-items:center;gap:10px">
    <button class="fullscreen-btn" onclick="toggleFullscreen()" title="Toggle fullscreen">⛶</button>
    <div class="toggle-wrap">
      <span class="toggle-label" id="toggleLabel">Agent ON</span>
      <label class="toggle">
        <input type="checkbox" id="agentToggle" checked onchange="toggleAgent(this.checked)">
        <span class="slider"></span>
      </label>
    </div>
  </div>
</header>

<nav class="nav-bar">
  <button class="nav-tab active" data-tab="leads" onclick="switchTab('leads')">📊 Leads</button>
  <button class="nav-tab" data-tab="settings" onclick="switchTab('settings')">⚙️ Settings</button>
  <button class="nav-tab" data-tab="knowledge" onclick="switchTab('knowledge')">📚 Knowledge</button>
  <button class="nav-tab" data-tab="connect" onclick="switchTab('connect')">📱 Connect</button>
</nav>

<div class="paused-banner" id="pausedBanner">⏸ Agent is PAUSED — not replying to anyone</div>
<div class="setup-banner" id="setupBanner" onclick="switchTab('settings')">⚠️ Setup incomplete — click here to configure your agent before starting</div>

<div class="stats">
  <div class="stat"><div class="stat-num" id="s-total">0</div><div class="stat-lbl">Total Leads</div></div>
  <div class="stat"><div class="stat-num" id="s-active">0</div><div class="stat-lbl">Active Today</div></div>
  <div class="stat"><div class="stat-num" id="s-qualified">0</div><div class="stat-lbl">Qualified</div></div>
  <div class="stat hot"><div class="stat-num" id="s-ready">0</div><div class="stat-lbl">🔥 Ready to Pay</div></div>
</div>

<!-- ── Tab: Leads ───────────────────────────────────────────────────── -->
<div class="tab-content active" id="tab-leads">
  <div class="leads-panel">
    <div class="leads-header">
      <span>Leads</span>
      <button class="unpause-all none-paused" id="unpauseAllBtn" onclick="unpauseAll()">Unpause All</button>
    </div>
    <div id="leadsList"></div>
  </div>
  <div class="log-container" id="logs"></div>
</div>

<!-- ── Tab: Settings ────────────────────────────────────────────────── -->
<div class="tab-content" id="tab-settings">
  <div class="settings-scroll">
    <div class="settings-grid">

      <div class="settings-section">
        <div class="settings-section-title">Identity</div>
        <div class="field-row">
          <div>
            <div class="field-label">Your Name <span class="field-req">*</span></div>
            <div class="field-hint">How the agent refers to you in alerts</div>
          </div>
          <input class="field-input" id="s-AGENT_OWNER_NAME" placeholder="e.g. Sami" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Your WhatsApp Number <span class="field-req">*</span></div>
            <div class="field-hint">Full number with country code, no + or spaces</div>
          </div>
          <input class="field-input" id="s-AGENT_OWNER_NOTIFY_NUMBER" placeholder="919XXXXXXXXX" />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Program Details</div>
        <div class="field-row">
          <div>
            <div class="field-label">Program Name</div>
          </div>
          <input class="field-input" id="s-PROGRAM_NAME" placeholder="e.g. AI for Founders" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Fee</div>
            <div class="field-hint">Agent shares this when leads ask about price</div>
          </div>
          <input class="field-input" id="s-PROGRAM_FEE" placeholder="e.g. ₹25,000 per person" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Payment Details</div>
            <div class="field-hint">Shared only after you confirm to the lead</div>
          </div>
          <input class="field-input" id="s-PROGRAM_PAYMENT_DETAILS" placeholder="UPI ID or payment link" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Next Batch Date</div>
          </div>
          <input class="field-input" id="s-PROGRAM_BATCH_DATE" placeholder="e.g. June 27, 2025" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Seat Limit</div>
          </div>
          <input class="field-input" id="s-PROGRAM_SEAT_LIMIT" type="number" placeholder="10" style="width:100px" />
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Agent Behaviour</div>
        <div class="field-row">
          <div>
            <div class="field-label">Min Reply Delay (sec)</div>
            <div class="field-hint">Minimum seconds before agent replies</div>
          </div>
          <input class="field-input" id="s-AGENT_REPLY_DELAY_SECONDS" type="number" placeholder="8" style="width:100px" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Max Reply Delay (sec)</div>
          </div>
          <input class="field-input" id="s-AGENT_REPLY_DELAY_MAX_SECONDS" type="number" placeholder="12" style="width:100px" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Brain</div>
            <div class="field-hint">rules = fast, no GPU; ollama = local AI model</div>
          </div>
          <select class="field-select" id="s-AGENT_BRAIN_PROVIDER" style="width:180px" onchange="toggleOllamaRow()">
            <option value="rules">rules (no AI)</option>
            <option value="ollama">ollama (local AI)</option>
          </select>
        </div>
        <div class="field-row" id="ollama-row" style="display:none">
          <div>
            <div class="field-label">Ollama Model</div>
          </div>
          <input class="field-input" id="s-OLLAMA_MODEL" placeholder="llama3.1:8b" style="width:200px" />
        </div>
        <div class="field-row">
          <div>
            <div class="field-label">Mode</div>
            <div class="field-hint">Test mode logs replies but doesn't send</div>
          </div>
          <select class="field-select" id="s-DRY_RUN" style="width:180px">
            <option value="false">Live — sends real messages</option>
            <option value="true">Test — logs only, no sends</option>
          </select>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn-save" onclick="saveSettings()">Save Settings</button>
        <span class="save-status" id="settingsSaveStatus"></span>
      </div>
      <p class="restart-note">⚠️ Changes take effect after restarting the agent process.</p>

    </div>
  </div>
</div>

<!-- ── Tab: Knowledge ────────────────────────────────────────────────── -->
<div class="tab-content" id="tab-knowledge">
  <div class="knowledge-scroll">
    <div class="knowledge-grid">

      <div class="knowledge-block">
        <div class="knowledge-title">Program Script</div>
        <div class="knowledge-desc">What the agent knows about your program — positioning, objections, pricing rules. Edit this to train your agent on your specific program.</div>
        <textarea class="knowledge-textarea" id="k-program" rows="18" placeholder="Loading..."></textarea>
        <div class="knowledge-actions">
          <button class="btn-save" onclick="saveKnowledge('program')">Save Program Script</button>
          <span class="k-save-status" id="k-program-status"></span>
        </div>
      </div>

      <div class="knowledge-block">
        <div class="knowledge-title">Agent Learnings</div>
        <div class="knowledge-desc">Things the agent has learned from your WhatsApp instructions. You can review, edit, or clear entries here.</div>
        <textarea class="knowledge-textarea" id="k-learnings" rows="10" placeholder="Loading..."></textarea>
        <div class="knowledge-actions">
          <button class="btn-save" onclick="saveKnowledge('learnings')">Save Learnings</button>
          <span class="k-save-status" id="k-learnings-status"></span>
        </div>
      </div>

    </div>
  </div>
</div>

<!-- ── Tab: Connect ──────────────────────────────────────────────────── -->
<div class="tab-content" id="tab-connect">
  <div class="connect-scroll">
    <div class="connect-center">

      <div id="connectStatusBox" class="connect-status-box">
        <div class="connect-dot-wrap"><div class="connect-dot" id="connectDot"></div></div>
        <div class="connect-heading" id="connectTitle">Checking...</div>
        <div class="connect-sub" id="connectSub"></div>
      </div>

      <div id="connectBody"></div>

      <a class="btn-wa" href="https://web.whatsapp.com" target="_blank" rel="noopener">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" style="flex-shrink:0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.557 4.12 1.527 5.854L.057 23.01a.75.75 0 0 0 .933.933l5.156-1.47A11.949 11.949 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.92 0-3.73-.51-5.287-1.4l-.379-.218-3.928 1.12 1.12-3.928-.218-.379A9.722 9.722 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
        Open WhatsApp Web
      </a>

      <div class="connect-how">
        <div class="connect-how-title">How it works</div>
        <div class="connect-how-step"><span>1</span> Open WhatsApp Web in Chrome (button above)</div>
        <div class="connect-how-step"><span>2</span> Log in with your phone if prompted</div>
        <div class="connect-how-step"><span>3</span> Keep that Chrome tab open — the agent connects through it</div>
        <div class="connect-how-step"><span>4</span> Start the agent — it will show <em>Connected</em> here</div>
      </div>

      <button class="btn-secondary" onclick="refreshConnectStatus()">↻ Refresh status</button>
    </div>
  </div>
</div>

<div class="footer">
  <span style="color:#2a2a2a">HumainW Agent · 2imlabs</span>
  <span id="lastUpdate"></span>
</div>

<div class="modal-overlay" id="modalOverlay">
  <div class="modal">
    <div class="modal-title" id="modalTitle">Follow Up</div>
    <div class="modal-meta" id="modalMeta"></div>
    <textarea class="modal-textarea" id="modalText" rows="5"></textarea>
    <div class="modal-status" id="modalStatus"></div>
    <div class="modal-actions">
      <button class="modal-cancel" onclick="closeModal()">Cancel</button>
      <button class="modal-send" id="modalSendBtn" onclick="sendFollowUp()">Send</button>
    </div>
  </div>
</div>

<script>
  let paused = false;
  let modalChatId = null;

  // ── Tab switching ──────────────────────────────────────────────────────

  function switchTab(name) {
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(d => d.classList.toggle('active', d.id === 'tab-' + name));
    if (name === 'settings') loadSettings();
    if (name === 'knowledge') loadKnowledge();
    if (name === 'connect') refreshConnectStatus();
  }

  // ── Leads tab ──────────────────────────────────────────────────────────

  function colorLine(line) {
    if (line.includes('[reply:send]') || line.includes('[catch-up:send]')) return 'reply';
    if (line.includes('[escalate]') || line.includes('ready to pay') || line.includes('Ready to pay')) return 'escalate';
    if (line.includes('[owner]') || line.includes('[notify:owner]')) return 'owner';
    if (line.includes('[pause]') || line.includes('[paused]')) return 'pause';
    if (line.includes('WhatsApp agent ready')) return 'ready';
    if (line.includes('ERROR')) return 'error';
    return 'info';
  }

  function renderLogs(text) {
    const container = document.getElementById('logs');
    const lines = text.split('\\n').filter(Boolean);
    container.innerHTML = lines.map(l =>
      '<div class="log-line ' + colorLine(l) + '">' + l.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>'
    ).join('');
    container.scrollTop = container.scrollHeight;
  }

  function updateStats(s) {
    document.getElementById('s-total').textContent = s.total;
    document.getElementById('s-active').textContent = s.active;
    document.getElementById('s-qualified').textContent = s.qualified;
    document.getElementById('s-ready').textContent = s.readyToPay;
  }

  function renderLeads(leads) {
    const el = document.getElementById('leadsList');
    const btn = document.getElementById('unpauseAllBtn');
    const anyPaused = leads.some(l => l.paused);
    btn.className = 'unpause-all ' + (anyPaused ? 'some-paused' : 'none-paused');
    if (!leads.length) { el.innerHTML = '<div style="padding:14px;color:#444;font-size:12px">No leads yet</div>'; return; }
    el.innerHTML = leads.map(l => {
      const pausedHtml = l.paused
        ? '<span class="paused-tag">⏸</span><button class="unpause-btn" onclick="unpause(\\''+l.chatId+'\\')">Unpause</button>'
        : '';
      const followUpBtn = '<button class="followup-btn"' +
        ' data-chatid="' + l.chatId.replace(/"/g,'') + '"' +
        ' data-name="' + l.name.replace(/"/g,'') + '"' +
        ' data-stage="' + (l.stage||'').replace(/"/g,'') + '"' +
        ' data-dir="' + (l.lastMsgDirection||'').replace(/"/g,'') + '"' +
        ' data-silent="' + (l.daysSilent !== null ? l.daysSilent : '') + '"' +
        ' onclick="handleFollowUpClick(this)">Follow Up</button>';
      return '<div class="lead-item">' +
        '<div class="lead-row">' +
          '<span class="lead-name">' + l.name + '</span>' +
          '<span class="stage-badge stage-' + l.stage + '">' + l.stage.replace(/_/g,' ') + '</span>' +
        '</div>' +
        '<div class="lead-meta">' + (l.number||'') + (l.industry ? ' · '+l.industry : '') + '</div>' +
        '<div class="lead-row" style="margin-top:4px">' +
          '<div class="lead-msg">' + (l.lastMsg||'—') + '</div>' +
          '<div style="display:flex;align-items:center;gap:2px;flex-shrink:0">' + pausedHtml + followUpBtn + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function unpause(chatId) {
    await fetch('/api/unpause', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({chatId}) });
    await refresh();
  }

  async function unpauseAll() {
    await fetch('/api/unpause', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({chatId:'all'}) });
    await refresh();
  }

  async function refresh() {
    try {
      const [statusRes, leadsRes] = await Promise.all([fetch('/api/status'), fetch('/api/chats')]);
      const d = await statusRes.json();
      const leads = await leadsRes.json();
      renderLogs(d.logs);
      updateStats(d.stats);
      renderLeads(leads);
      paused = d.paused;
      const toggle = document.getElementById('agentToggle');
      toggle.checked = !paused;
      document.getElementById('toggleLabel').textContent = paused ? 'Agent OFF' : 'Agent ON';
      document.getElementById('dot').className = 'dot' + (paused ? ' off' : '');
      document.getElementById('statusText').textContent = paused ? 'Paused' : 'Connected';
      document.getElementById('pausedBanner').className = 'paused-banner' + (paused ? ' visible' : '');
      document.getElementById('setupBanner').className = 'setup-banner' + (d.needsSetup ? ' visible' : '');
      document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch(e) {
      document.getElementById('statusText').textContent = 'Disconnected';
      document.getElementById('dot').className = 'dot off';
    }
  }

  async function toggleAgent(on) {
    await fetch('/api/toggle', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({on}) });
    document.getElementById('toggleLabel').textContent = on ? 'Agent ON' : 'Agent OFF';
    await refresh();
  }

  // ── Follow-up modal ────────────────────────────────────────────────────

  function handleFollowUpClick(btn) {
    const chatId = btn.dataset.chatid;
    const name = btn.dataset.name;
    const stage = btn.dataset.stage;
    const lastMsgDir = btn.dataset.dir;
    const daysSilent = btn.dataset.silent !== '' ? Number(btn.dataset.silent) : null;
    openFollowUp(chatId, name, stage, lastMsgDir, daysSilent);
  }

  async function openFollowUp(chatId, name, stage, lastMsgDir, daysSilent) {
    modalChatId = chatId;
    document.getElementById('modalTitle').textContent = 'Follow up with ' + name;
    const silentNote = daysSilent > 0 ? daysSilent + ' day(s) silent' : 'active today';
    const typeNote = lastMsgDir === 'in' ? 'Their message is unanswered' : 'Waiting for their reply';
    document.getElementById('modalMeta').textContent = stage.replace(/_/g,' ') + ' · ' + silentNote + ' · ' + typeNote;
    document.getElementById('modalText').value = '';
    document.getElementById('modalStatus').textContent = 'Generating draft...';
    document.getElementById('modalSendBtn').disabled = true;
    document.getElementById('modalOverlay').classList.add('open');
    try {
      const res = await fetch('/api/followup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({chatId}) });
      const data = await res.json();
      document.getElementById('modalText').value = data.draft || '';
      document.getElementById('modalStatus').textContent = data.type === 'reply' ? '💬 Replying to their unanswered message — edit if needed' : '🔁 Follow-up draft — review before sending';
      document.getElementById('modalSendBtn').disabled = false;
    } catch(e) {
      document.getElementById('modalStatus').textContent = 'Could not generate draft — type manually.';
      document.getElementById('modalSendBtn').disabled = false;
    }
  }

  function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
    modalChatId = null;
  }

  async function sendFollowUp() {
    const text = document.getElementById('modalText').value.trim();
    if (!text || !modalChatId) return;
    document.getElementById('modalSendBtn').disabled = true;
    document.getElementById('modalStatus').textContent = 'Sending...';
    try {
      const res = await fetch('/api/send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({chatId:modalChatId, message:text}) });
      const data = await res.json();
      if (data.ok) {
        document.getElementById('modalStatus').textContent = '✅ Sent!';
        setTimeout(closeModal, 800);
        await refresh();
      } else {
        document.getElementById('modalStatus').textContent = '❌ ' + (data.error || 'Failed to send');
        document.getElementById('modalSendBtn').disabled = false;
      }
    } catch(e) {
      document.getElementById('modalStatus').textContent = '❌ ' + e.message;
      document.getElementById('modalSendBtn').disabled = false;
    }
  }

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });

  // ── Settings tab ───────────────────────────────────────────────────────

  const SETTING_KEYS = [
    'AGENT_OWNER_NAME','AGENT_OWNER_NOTIFY_NUMBER',
    'PROGRAM_NAME','PROGRAM_FEE','PROGRAM_PAYMENT_DETAILS',
    'PROGRAM_BATCH_DATE','PROGRAM_SEAT_LIMIT',
    'AGENT_REPLY_DELAY_SECONDS','AGENT_REPLY_DELAY_MAX_SECONDS',
    'AGENT_BRAIN_PROVIDER','OLLAMA_MODEL','DRY_RUN'
  ];

  async function loadSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      SETTING_KEYS.forEach(k => {
        const el = document.getElementById('s-' + k);
        if (!el) return;
        el.value = data[k] || '';
        if ((k === 'AGENT_OWNER_NAME' || k === 'AGENT_OWNER_NOTIFY_NUMBER') && !data[k]) {
          el.classList.add('empty-required');
        } else {
          el.classList.remove('empty-required');
        }
      });
      toggleOllamaRow();
    } catch(e) {
      console.error('Settings load failed', e);
    }
  }

  function toggleOllamaRow() {
    const brain = document.getElementById('s-AGENT_BRAIN_PROVIDER').value;
    document.getElementById('ollama-row').style.display = brain === 'ollama' ? '' : 'none';
  }

  async function saveSettings() {
    const updates = {};
    SETTING_KEYS.forEach(k => {
      const el = document.getElementById('s-' + k);
      if (el) updates[k] = el.value;
    });
    const statusEl = document.getElementById('settingsSaveStatus');
    statusEl.style.color = '#60a5fa';
    statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.style.color = '#22c55e';
        statusEl.textContent = '✅ Saved — restart agent to apply changes';
      } else {
        statusEl.style.color = '#f87171';
        statusEl.textContent = '❌ ' + (data.error || 'Failed to save');
      }
      setTimeout(() => { statusEl.textContent = ''; }, 5000);
      await refresh();
    } catch(e) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = '❌ ' + e.message;
    }
  }

  // ── Knowledge tab ──────────────────────────────────────────────────────

  async function loadKnowledge() {
    for (const name of ['program', 'learnings']) {
      try {
        const res = await fetch('/api/knowledge/' + name);
        const data = await res.json();
        const el = document.getElementById('k-' + name);
        if (el) el.value = data.content || '';
      } catch {}
    }
  }

  async function saveKnowledge(name) {
    const el = document.getElementById('k-' + name);
    const statusEl = document.getElementById('k-' + name + '-status');
    if (!el || !statusEl) return;
    statusEl.style.color = '#60a5fa';
    statusEl.textContent = 'Saving...';
    try {
      const res = await fetch('/api/knowledge/' + name, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ content: el.value })
      });
      const data = await res.json();
      if (data.ok) {
        statusEl.style.color = '#22c55e';
        statusEl.textContent = '✅ Saved — takes effect immediately';
      } else {
        statusEl.style.color = '#f87171';
        statusEl.textContent = '❌ Failed';
      }
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch(e) {
      statusEl.style.color = '#f87171';
      statusEl.textContent = '❌ ' + e.message;
    }
  }

  // ── Connect tab ────────────────────────────────────────────────────────

  async function refreshConnectStatus() {
    const titleEl = document.getElementById('connectTitle');
    const subEl   = document.getElementById('connectSub');
    const dotEl   = document.getElementById('connectDot');
    try {
      const res  = await fetch('/api/connect-status');
      const data = await res.json();
      if (data.connected) {
        dotEl.className     = 'connect-dot on';
        titleEl.textContent = 'WhatsApp Web Connected';
        subEl.textContent   = 'The agent is live and handling messages';
        subEl.style.color   = '#22c55e';
      } else {
        dotEl.className     = 'connect-dot off';
        titleEl.textContent = 'Not Connected';
        subEl.textContent   = 'Open WhatsApp Web in Chrome, log in, then start the agent';
        subEl.style.color   = '#555';
      }
    } catch(e) {
      dotEl.className     = 'connect-dot off';
      titleEl.textContent = 'Agent not running';
      subEl.textContent   = 'Start the agent with: node src/index.js';
      subEl.style.color   = '#f87171';
    }
  }

  // ── Fullscreen ────────────────────────────────────────────────────────
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  document.addEventListener('fullscreenchange', () => {
    const btn = document.querySelector('.fullscreen-btn');
    if (btn) btn.textContent = document.fullscreenElement ? '✕' : '⛶';
  });

  // ── Init ───────────────────────────────────────────────────────────────
  refresh();
  setInterval(refresh, 3000);
</script>
</body>
</html>`;

// ── HTTP server ───────────────────────────────────────────────────────────────

function startDashboard() {
  const server = http.createServer(async (req, res) => {

    // ── Static ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HTML);
      return;
    }

    // ── Status ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/api/status") {
      const logs = readLastLines(logPath, 120);
      const stats = getLeadStats();
      const paused = isPaused();
      const env = readEnvValues();
      const needsSetup = !env.AGENT_OWNER_NAME || !env.AGENT_OWNER_NOTIFY_NUMBER;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ logs, stats, paused, needsSetup }));
      return;
    }

    // ── Chats ───────────────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/api/chats") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getChats()));
      return;
    }

    // ── Unpause ─────────────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/api/unpause") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const { chatId } = JSON.parse(body);
          unpauseChat(chatId);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400); res.end("bad request");
        }
      });
      return;
    }

    // ── Toggle ──────────────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/api/toggle") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const { on } = JSON.parse(body);
          setAgentPaused(!on);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, paused: !on }));
        } catch {
          res.writeHead(400); res.end("bad request");
        }
      });
      return;
    }

    // ── Follow-up draft ─────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/api/followup") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { chatId } = JSON.parse(body);
          const state = JSON.parse(fs.readFileSync(path.join(dataDir, "state.json"), "utf8"));
          const chat = state.chats?.[chatId];
          if (!chat) { res.writeHead(404); res.end(JSON.stringify({ error: "Chat not found" })); return; }
          const result = generateFollowUpDraft(chat);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // ── Send message ────────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/api/send") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const { chatId, message } = JSON.parse(body);
          if (!chatId || !message) { res.writeHead(400); res.end(JSON.stringify({ error: "chatId and message required" })); return; }
          await sendMessageFromDashboard(chatId, message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── Settings GET ────────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/api/settings") {
      const env = readEnvValues();
      // Only expose editable keys
      const safe = {};
      EDITABLE_KEYS.forEach(k => { safe[k] = env[k] || ""; });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(safe));
      return;
    }

    // ── Settings POST ───────────────────────────────────────────────────────
    if (req.method === "POST" && req.url === "/api/settings") {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const updates = JSON.parse(body);
          const ok = writeEnvValues(updates);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── Knowledge GET ───────────────────────────────────────────────────────
    if (req.method === "GET" && req.url.startsWith("/api/knowledge/")) {
      const name = req.url.replace("/api/knowledge/", "").split("?")[0];
      const content = readKnowledgeFile(name);
      if (content === null) { res.writeHead(403); res.end("Forbidden"); return; }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ content }));
      return;
    }

    // ── Knowledge POST ──────────────────────────────────────────────────────
    if (req.method === "POST" && req.url.startsWith("/api/knowledge/")) {
      const name = req.url.replace("/api/knowledge/", "").split("?")[0];
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        try {
          const { content } = JSON.parse(body);
          const ok = writeKnowledgeFile(name, content || "");
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok }));
        } catch (e) {
          res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }

    // ── QR image ────────────────────────────────────────────────────────────
    if (req.method === "GET" && (req.url === "/api/qr" || req.url.startsWith("/api/qr?"))) {
      const qrPath = path.join(dataDir, "qr.png");
      if (fs.existsSync(qrPath)) {
        const img = fs.readFileSync(qrPath);
        res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
        res.end(img);
      } else {
        res.writeHead(404); res.end("No QR available");
      }
      return;
    }

    // ── Connect status ──────────────────────────────────────────────────────
    if (req.method === "GET" && req.url === "/api/connect-status") {
      const qrPath = path.join(dataDir, "qr.png");
      const hasQr = fs.existsSync(qrPath);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ connected: _isClientReady, hasQr }));
      return;
    }

    res.writeHead(404);
    res.end("not found");
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[dashboard] Running at http://127.0.0.1:${PORT}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[dashboard] Port ${PORT} already in use — skipping`);
    } else {
      console.error("[dashboard] Error:", err.message);
    }
  });

  return function setClient(client, agentPendingBodies) {
    _client = client;
    _agentPendingBodies = agentPendingBodies;
    _isClientReady = true;
  };
}

module.exports = { startDashboard };
