const fs = require("fs");
const path = require("path");
const { generateReply, isBotDetect, isFrustrated, isAbusive } = require("./playbook");
const { readLearnings } = require("./owner");

const knowledgePath = path.join(__dirname, "..", "knowledge", "program.md");

function readKnowledge() {
  try {
    return fs.readFileSync(knowledgePath, "utf8");
  } catch {
    return "";
  }
}

function cleanJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function normalizeDecision(decision, fallback) {
  if (!decision || typeof decision !== "object") return fallback;
  const action = ["reply", "no_reply", "alert"].includes(decision.action) ? decision.action : "alert";
  const reply = typeof decision.reply === "string" ? decision.reply.trim() : "";
  return {
    category: decision.category || fallback.category || "unknown",
    stage: decision.stage || fallback.stage || "human_needed",
    industry: decision.industry || fallback.industry || "",
    escalate: Boolean(decision.escalate || action === "alert" || decision.ready_to_pay),
    reply: action === "reply" && reply ? reply : null,
    note: decision.note || decision.alert_reason || fallback.note || "",
    readyToPay: Boolean(decision.ready_to_pay)
  };
}

function formatProgramDetails(config) {
  return [
    `name: ${config.program.name}`,
    `fee: ${config.program.fee || "unknown"}`,
    `batchDate: ${config.program.batchDate || "unknown"}`,
    `seatLimit: ${config.program.seatLimit || "unknown"}`,
    `paymentDetailsConfigured: ${Boolean(config.program.paymentDetails)}`
  ].join("\n");
}

function buildPrompt(text, chat, config) {
  const recentMessages = (chat.messages || [])
    .map((message) => `${message.direction}: ${message.body}`)
    .join("\n");

  return [
    {
      role: "system",
      content:
        "You are a WhatsApp assistant for AI for Founders program. Your job: understand the lead's bottlenecks, suggest what AI can do for them, and move them toward joining the program. Return only one valid JSON object. No markdown. No prose outside JSON. " +
        "Allowed action values: reply, no_reply, alert. " +
        "CONVERSATION FLOW: " +
        "If stage=pre_qualified or fromForm=true: Lead came from the website form. You already know their name, company, cohort, and AI priority. SKIP all discovery questions. Go directly to confirming their bottleneck and suggesting how the program solves it. " +
        "If stage=new or collecting_info: Ask name first (if not known), then business/industry, then bottleneck. One question at a time. " +
        "Step 1 — Ask about their biggest bottleneck (skip if aiPriority is already filled). " +
        "Step 2 — Suggest 2-3 specific things AI can do for that problem. Brief, concrete. " +
        "Step 3 — Ask if that sounds useful. " +
        "Step 4 — If interested, share pricing and tell them Sami will personally walk them through. " +
        "If lead mentions email → note it as useful. " +
        "RULES: " +
        "(1) Suggest what AI CAN do — but NEVER actually design, build, or plan a system on chat. Suggestions should be brief (1-2 lines), not a full plan. " +
        "(2) NEVER ask the same question twice. Check the full conversation history first. " +
        "(3) Ask max ONE question per reply. Short, conversational, WhatsApp style. " +
        "(4) If asked 'are you human/bot': say you are the program manager for AI for Founders and Sami will connect personally — do NOT mention AI or bots. " +
        "(5) If frustrated: apologise briefly, give the suggestion for their bottleneck, stop asking questions. " +
        "(6) Never invent fee, batch dates, seat count, payment details, or guarantees. " +
        "(7) no_reply only for completely unrelated, abusive, or medical/legal messages."
    },
    {
      role: "user",
      content:
        `PROGRAM KNOWLEDGE:\n${readKnowledge()}\n\n` +
        `LEARNINGS FROM SAMI:\n${readLearnings() || "(none yet)"}\n\n` +
        `CONFIGURED DETAILS:\n${formatProgramDetails(config)}\n\n` +
        `CHAT STATE:\ncontact=${chat.contactName || ""}\ncategory=${chat.category || ""}\nstage=${chat.stage || ""}\nindustry=${chat.industry || ""}\ncompany=${chat.company || ""}\ncohort=${chat.cohort || ""}\naiPriority=${chat.aiPriority || ""}\nemail=${chat.email || ""}\nfromForm=${chat.fromForm || false}\nsummary=${chat.summary || ""}\n\n` +
        `RECENT MESSAGES:\n${recentMessages || "(none)"}\n\n` +
        `LATEST INBOUND:\n${text}\n\n` +
        'Return JSON exactly like: {"action":"reply","category":"founder_lead","stage":"qualifying","industry":"","ready_to_pay":false,"escalate":false,"reply":"short WhatsApp reply","note":"","alert_reason":""}'
    }
  ];
}

async function postOllama(config, messages, options = {}) {
  const response = await fetch(`${config.brain.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.brain.ollamaModel,
      stream: false,
      format: "json",
      think: false,
      options: {
        temperature: options.temperature ?? 0.1,
        num_predict: options.numPredict ?? 600
      },
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function parseOllamaJson(config, rawContent) {
  const jsonText = cleanJson(rawContent);
  if (jsonText) return JSON.parse(jsonText);

  const repair = await postOllama(config, [
    { role: "system", content: "Convert the input into one valid JSON object. Return only JSON." },
    { role: "user", content: String(rawContent || "") }
  ], { temperature: 0, numPredict: 180 });

  const repairedJson = cleanJson(repair.message && repair.message.content);
  if (!repairedJson) throw new Error(`Ollama returned non-JSON output: ${String(rawContent || "").slice(0, 240)}`);
  return JSON.parse(repairedJson);
}

async function callOllama(text, chat, config) {
  const body = await postOllama(config, buildPrompt(text, chat, config));
  return parseOllamaJson(config, body.message && body.message.content);
}

async function generateSmartReply(text, chat, config) {
  const fallback = generateReply(text, chat, config);
  const provider = config.brain.provider;

  // Handle these via rules — fast, reliable, no Ollama needed
  if (isAbusive && isAbusive(text)) return fallback;
  if (isBotDetect && isBotDetect(text)) return fallback;
  if (isFrustrated && isFrustrated(text)) return fallback;

  if (provider !== "ollama") {
    return fallback;
  }

  try {
    const decision = await callOllama(text, chat, config);
    const normalized = normalizeDecision(decision, fallback);
    if (!fallback.reply && chat.category !== "founder_lead") {
      return fallback;
    }
    if (fallback.stage === "ready_to_pay") {
      return {
        ...normalized,
        category: "founder_lead",
        stage: "ready_to_pay",
        escalate: true,
        readyToPay: true
      };
    }
    return normalized;
  } catch (error) {
    console.error(`[brain:fallback] ${error.message}`);
    return fallback;
  }
}

module.exports = {
  buildPrompt,
  generateSmartReply
};
