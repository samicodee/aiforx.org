require("dotenv").config();
const fs = require("fs");
const envPath = require("path").join(__dirname, "..", ".env");

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

module.exports = {
  dryRun: boolEnv("DRY_RUN", false),
  ownerName: process.env.AGENT_OWNER_NAME || "Sami",
  ownerNotifyNumber: process.env.AGENT_OWNER_NOTIFY_NUMBER || "",
  ownerChatId: process.env.AGENT_OWNER_CHAT_ID || "",
  leadsAdminToken: process.env.LEADS_ADMIN_TOKEN || "",
  isPaused: () => {
    try { return fs.readFileSync(envPath, "utf8").includes("AGENT_PAUSED=1"); } catch { return false; }
  },
  leadsApiUrl: process.env.LEADS_API_URL || "https://aiforx.org/api/leads",
  pauseAfterHumanMinutes: numberEnv("AGENT_PAUSE_AFTER_HUMAN_MINUTES", 60),
  replyDelaySeconds: numberEnv("AGENT_REPLY_DELAY_SECONDS", 8),
  replyDelayMaxSeconds: numberEnv("AGENT_REPLY_DELAY_MAX_SECONDS", 12),
  enableStudentOps: boolEnv("AGENT_ENABLE_STUDENT_OPS", true),
  chromeExecutablePath:
    process.env.CHROME_EXECUTABLE_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  authMode: process.env.AGENT_AUTH_MODE || "local",
  browserUrl: process.env.AGENT_BROWSER_URL || "",
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR || "",
  chromeProfileDirectory: process.env.CHROME_PROFILE_DIRECTORY || "",
  brain: {
    provider: process.env.AGENT_BRAIN_PROVIDER || "rules",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENAI_MODEL || "gpt-5-mini",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "gemma4:e2b"
  },
  program: {
    name: process.env.PROGRAM_NAME || "AI for Founders",
    fee: process.env.PROGRAM_FEE || "",
    paymentDetails: process.env.PROGRAM_PAYMENT_DETAILS || "",
    batchDate: process.env.PROGRAM_BATCH_DATE || "",
    seatLimit: process.env.PROGRAM_SEAT_LIMIT || ""
  }
};
