const qrcode = require("qrcode-terminal");
const qrcodeImage = require("qrcode");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const { appendMessage, getChatState, loadState, updateChatState } = require("./state");
const { generateSmartReply } = require("./brain");
const { isOwnerNumber, handleOwnerMessage, askSami } = require("./owner");
const { syncLeadToAdmin } = require("./leads-sync");
const { startDashboard } = require("./dashboard");
const { runNoBanCheck } = require("./noban");

const dataDir = path.join(__dirname, "..", "data");
const logPath = path.join(dataDir, "agent.log");
const alertsPath = path.join(dataDir, "alerts.jsonl");

function writeLog(level, args) {
  fs.mkdirSync(dataDir, { recursive: true });
  const line = `[${nowIso()}] ${level} ${args.map((arg) => {
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === "string") return arg;
    return JSON.stringify(arg);
  }).join(" ")}\n`;
  fs.appendFileSync(logPath, line);
}

const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
console.log = (...args) => {
  writeLog("INFO", args);
  originalLog(...args);
};
console.error = (...args) => {
  writeLog("ERROR", args);
  originalError(...args);
};

const agentSentMessageIds = new Set();
// Populated BEFORE message.reply() so message_create doesn't race ahead of the ID
const agentPendingBodies = new Set();
// Per-chat lock — prevents two events from replying to the same chat simultaneously
const chatLocks = new Set();

// Global send mutex — only ONE chat can be in the typing+send phase at a time
// During the read-delay phase, this is NOT held (other chats can compute replies freely)
let sendMutexResolve = null;
let sendMutexLocked = false;

function acquireSendMutex() {
  if (!sendMutexLocked) {
    sendMutexLocked = true;
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const prev = sendMutexResolve;
    sendMutexResolve = () => {
      sendMutexLocked = true;
      resolve();
      sendMutexResolve = prev;
    };
  });
}

function releaseSendMutex() {
  if (sendMutexResolve) {
    sendMutexResolve();
  } else {
    sendMutexLocked = false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  const ms = (min + Math.random() * (max - min)) * 1000;
  return sleep(ms);
}

// Mimics real human texting patterns — no fixed range fingerprint
function humanReadDelay() {
  const r = Math.random();
  // 15% — glanced at phone, quick reply (8–28s)
  if (r < 0.15) return 8000 + Math.random() * 20000;
  // 45% — read and replied normally (35–110s)
  if (r < 0.60) return 35000 + Math.random() * 75000;
  // 25% — was doing something, came back (2–5 min)
  if (r < 0.85) return 120000 + Math.random() * 180000;
  // 15% — took a while (5–12 min) — looks like busy human
  return 300000 + Math.random() * 420000;
}

// Typing duration based on message length — ~40 wpm human speed
function typingDuration(text) {
  const words = (text || "").split(/\s+/).length;
  const base = (words / 40) * 60 * 1000; // ms to type at 40wpm
  const jitter = (Math.random() - 0.5) * 0.4 * base; // ±20% variance
  return Math.min(Math.max(base + jitter, 1500), 8000); // clamp 1.5s–8s
}

function nowIso() {
  return new Date().toISOString();
}

function pauseUntil(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function notifyOwner(title, message, payload, client) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.appendFileSync(alertsPath, `${JSON.stringify({ at: nowIso(), title, message, ...payload })}\n`);
  execFile("osascript", [
    "-e",
    `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`
  ], (error) => {
    if (error) console.error("Mac notification failed", error);
  });

  if (client && config.ownerNotifyNumber) {
    const num = payload.contactNumber || "";
    const name = payload.contactName || "";
    const header = num ? `${num} - ${name}` : name;
    const whatsappMsg = `*${header} - ${title}*\n\n_"${payload.inbound || message}"_\n\nStage: ${payload.stage || ""}`;
    const to = config.ownerNotifyNumber.includes("@") ? config.ownerNotifyNumber : `${config.ownerNotifyNumber}@c.us`;
    agentPendingBodies.add(whatsappMsg);
    client.sendMessage(to, whatsappMsg)
      .then(() => { agentPendingBodies.delete(whatsappMsg); console.log(`[notify:owner] Sent to ${to}`); })
      .catch((error) => { agentPendingBodies.delete(whatsappMsg); console.error(`[notify:owner:error] ${error.message}`); });
  }
}

function isPaused(chat) {
  return chat.pausedUntil && new Date(chat.pausedUntil).getTime() > Date.now();
}

// Outbound queue removed — no unsolicited sends to unknown numbers

async function replyToUnansweredRecentMessages(client) {
  const state = loadState();
  const chats = Object.values(state.chats || {});
  const recentCutoff = Date.now() - 30 * 60 * 1000;
  const MAX_CATCHUP = 3; // max catch-up replies per restart — avoids burst on reconnect
  let sent = 0;

  for (const chat of chats) {
    if (sent >= MAX_CATCHUP) {
      console.log(`[catch-up] Limit reached (${MAX_CATCHUP}) — remaining deferred to inbound`);
      break;
    }
    if (!chat.chatId || chat.chatId.endsWith("@g.us")) continue;
    if (!chat.lastInboundAt || new Date(chat.lastInboundAt).getTime() < recentCutoff) continue;
    if (chat.lastOutboundAt && new Date(chat.lastOutboundAt).getTime() >= new Date(chat.lastInboundAt).getTime()) continue;
    if (isPaused(chat)) continue;

    const lastInbound = [...(chat.messages || [])].reverse().find((message) => message.direction === "in");
    if (!lastInbound) continue;

    const decision = await generateSmartReply(lastInbound.body || "", chat, config);
    if (!decision.reply) continue;

    console.log(`[catch-up:${config.dryRun ? "dry" : "send"}] ${chat.contactName || chat.chatId}: ${decision.reply}`);
    updateChatState(chat.chatId, {
      category: decision.category || chat.category,
      stage: decision.stage || chat.stage,
      industry: decision.industry || chat.industry || "",
      summary: decision.note || chat.summary || ""
    });

    if (!config.dryRun) {
      // 30s gap between each catch-up to avoid burst on reconnect
      if (sent > 0) await sleep(30_000);
      agentPendingBodies.add(decision.reply);
      const sentMessage = await client.sendMessage(chat.chatId, decision.reply);
      agentPendingBodies.delete(decision.reply);
      if (sentMessage.id && sentMessage.id._serialized) {
        agentSentMessageIds.add(sentMessage.id._serialized);
      }
      appendMessage(chat.chatId, {
        direction: "out",
        fromAgent: true,
        body: decision.reply,
        at: nowIso()
      });
      updateChatState(chat.chatId, { lastOutboundAt: nowIso() });
      sent++;
    }
  }
}

async function main() {
  const puppeteerArgs = ["--no-sandbox", "--disable-setuid-sandbox"];
  if (config.authMode === "chrome-profile-copy" && config.chromeProfileDirectory) {
    puppeteerArgs.push(`--profile-directory=${config.chromeProfileDirectory}`);
  }

  const clientOptions = {
    puppeteer: {
      headless: true,
      executablePath: config.chromeExecutablePath,
      args: puppeteerArgs
    }
  };

  if (config.browserUrl) {
    // Connect to an existing Chrome instance (real browser, not headless)
    // Chrome must be launched with: --remote-debugging-port=9222
    console.log(`[browser] Connecting to existing Chrome at ${config.browserUrl}`);
    clientOptions.puppeteer = { browserURL: config.browserUrl };
    // No auth strategy needed — session already exists in the real browser
  } else if (config.authMode === "local") {
    clientOptions.authStrategy = new LocalAuth({ dataPath: "./.wwebjs_auth" });
  } else if (config.authMode === "chrome-profile-copy") {
    if (!config.chromeUserDataDir) {
      throw new Error("CHROME_USER_DATA_DIR is required for chrome-profile-copy mode.");
    }
    clientOptions.puppeteer.userDataDir = config.chromeUserDataDir;
  } else {
    throw new Error(`Unknown AGENT_AUTH_MODE: ${config.authMode}`);
  }

  const client = new Client({
    ...clientOptions
  });

  client.on("qr", (qr) => {
    const qrPath = path.join(dataDir, "qr.png");
    fs.mkdirSync(dataDir, { recursive: true });
    qrcodeImage.toFile(qrPath, qr, { margin: 2, width: 720 }, (error) => {
      if (error) {
        console.error("Failed to write QR image", error);
      } else {
        console.log(`QR image saved: ${qrPath}`);
      }
    });
    console.log("Scan this QR with WhatsApp > Linked devices > Link a device");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", async () => {
    console.log(`WhatsApp agent ready. dryRun=${config.dryRun}`);
    setDashboardClient(client, agentPendingBodies);
    await replyToUnansweredRecentMessages(client);
    const NoBAN_INTERVAL_MS = 30 * 60 * 1000;
    setInterval(() => runNoBanCheck(client, agentPendingBodies, config), NoBAN_INTERVAL_MS);
    console.log("[noban] Monitor active — checking every 30 minutes");
  });

  client.on("message_create", async (message) => {
    if (!message.fromMe) return;
    if (!message.to || message.to.endsWith("@g.us")) return;
    // Skip messages the agent is currently sending (body-based pre-check beats the ID race)
    if (agentPendingBodies.has(message.body)) return;
    if (agentSentMessageIds.has(message.id && message.id._serialized)) {
      agentSentMessageIds.delete(message.id._serialized);
      return;
    }

    // Never pause owner's own chat
    if (message.to === config.ownerChatId || isOwnerNumber(message.to, config.ownerNotifyNumber)) return;

    const chat = getChatState(message.to, "");
    appendMessage(message.to, {
      direction: "out",
      fromMe: true,
      body: message.body,
      at: nowIso()
    });

    updateChatState(message.to, {
      pausedUntil: pauseUntil(config.pauseAfterHumanMinutes),
      lastOutboundAt: nowIso()
    });

    console.log(`[pause] Human sent message in ${chat.contactName || message.to}. Paused.`);
  });

  client.on("message", async (message) => {
    if (message.fromMe) return;
    if (message.from.endsWith("@g.us")) return;
    if (!message.body && !message.hasMedia) return;

    // Owner message — teaching / relay / guidance
    const isOwner = message.from === config.ownerChatId ||
      isOwnerNumber(message.from, config.ownerNotifyNumber);
    if (isOwner) {
      await handleOwnerMessage(message, client, config, agentPendingBodies);
      return;
    }

    // Global pause toggle (from dashboard)
    if (config.isPaused && config.isPaused()) {
      console.log(`[paused:global] Agent paused via dashboard`);
      return;
    }

    // Per-chat lock — drop event if already processing this chat
    if (chatLocks.has(message.from)) {
      console.log(`[lock] ${message.from} already processing — queued message dropped`);
      return;
    }
    chatLocks.add(message.from);

    try {
    const contact = await message.getContact();
    const contactName = contact.pushname || contact.name || contact.number || message.from;

    // Try to get real phone number from WhatsApp Web JS store (resolves @lid → real number)
    let contactNumber = contact.number || "";
    try {
      const realNumber = await client.pupPage.evaluate((chatId) => {
        const store = window.Store || window.mR?.findModule(m => m?.default?.get && m.default.modelClass === "Contact")?.[0]?.default;
        if (!store) return null;
        const c = store.get ? store.get(chatId) : null;
        return c?.formattedUser || c?.user || null;
      }, message.from);
      if (realNumber && realNumber.length >= 7 && !realNumber.includes("@")) {
        contactNumber = realNumber;
      }
    } catch {}

    // Fallback: strip @suffix from message.from
    if (!contactNumber) {
      contactNumber = message.from.replace(/@c\.us|@lid|@s\.whatsapp\.net/g, "").split(":")[0];
    }
    const chat = getChatState(message.from, contactName);

    appendMessage(message.from, {
      direction: "in",
      body: message.body || "[media]",
      at: nowIso()
    });

    updateChatState(message.from, {
      contactName,
      contactNumber,
      lastInboundAt: nowIso()
    });

    if (isPaused(chat)) {
      console.log(`[paused] ${contactName}: ${message.body}`);
      return;
    }

    const decision = await generateSmartReply(message.body || "", chat, config);
    // Extract email from message body even if decision doesn't flag it
    const { extractEmail } = require("./playbook");
    const emailFound = extractEmail(message.body || "");
    updateChatState(message.from, {
      category: decision.category || chat.category,
      stage: decision.stage || chat.stage,
      industry: decision.industry || chat.industry || "",
      summary: decision.note || chat.summary || "",
      ...(decision.company ? { company: decision.company } : {}),
      ...(decision.cohort ? { cohort: decision.cohort } : {}),
      ...(decision.aiPriority ? { aiPriority: decision.aiPriority } : {}),
      ...(decision.fromForm ? { fromForm: true } : {}),
      ...(decision.contactName && decision.fromForm ? { contactName: decision.contactName } : {}),
      ...(emailFound && !chat.email ? { email: emailFound } : {}),
    });

    // Sync to aiforx.org/admin/leads (non-blocking)
    const updatedChat = getChatState(message.from, contactName);
    syncLeadToAdmin(config, updatedChat).then((leadId) => {
      if (leadId && leadId !== updatedChat.supabaseLeadId) {
        updateChatState(message.from, { supabaseLeadId: leadId });
        console.log(`[leads-sync] Linked to admin lead ${leadId}`);
      }
    }).catch((err) => console.error("[leads-sync]", err.message));

    if (decision.escalate) {
      console.log(`[escalate] ${contactName}: ${decision.note || decision.stage}`);
      notifyOwner(
        decision.stage === "ready_to_pay" ? "Ready to pay 🔥" : "Take over this chat",
        `${contactName}: ${decision.note || decision.stage || message.body}`,
        {
          chatId: message.from,
          contactName,
          contactNumber,
          stage: decision.stage,
          category: decision.category,
          inbound: message.body || "[media]"
        },
        client
      );
    }

    if (!decision.reply) {
      console.log(`[no-reply] ${contactName}: ${message.body}`);
      // Ask Sami when truly stuck — unknown context, new situation
      if (!config.dryRun && config.ownerNotifyNumber && decision.stage === "human_needed" && decision.category === "unknown") {
        await askSami(client, config, agentPendingBodies, {
          leadChatId: message.from,
          leadName: contactName,
          leadNumber: contactNumber,
          leadMessage: message.body || "",
          industry: chat.industry || "",
          stage: decision.stage,
          chatHistory: chat.messages || []
        });
      }
      return;
    }

    console.log(`[reply:${config.dryRun ? "dry" : "send"}] ${contactName}: ${decision.reply}`);

    if (!config.dryRun) {
      // Step 1 — read delay (free window — other chats can send during this)
      await sleep(humanReadDelay());

      // Step 2 — acquire send mutex — only ONE chat types+sends at a time
      await acquireSendMutex();
      try {
        // Step 3 — show typing indicator
        let waChat = null;
        try {
          waChat = await message.getChat();
          await waChat.sendStateTyping();
        } catch {}

        // Step 4 — typing duration (realistic)
        await sleep(typingDuration(decision.reply));

        // Step 5 — send
        if (waChat) { try { await waChat.clearState(); } catch {} }
        agentPendingBodies.add(decision.reply);
        const sentMessage = await message.reply(decision.reply);
        agentPendingBodies.delete(decision.reply);
        if (sentMessage.id && sentMessage.id._serialized) {
          agentSentMessageIds.add(sentMessage.id._serialized);
        }
        appendMessage(message.from, {
          direction: "out",
          fromAgent: true,
          body: decision.reply,
          at: nowIso()
        });
        updateChatState(message.from, { lastOutboundAt: nowIso() });
      } finally {
        releaseSendMutex();
      }
    }
  } finally {
    chatLocks.delete(message.from);
  }
  });

  await client.initialize();
  setInterval(() => {}, 60 * 60 * 1000);
}

const setDashboardClient = startDashboard();

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
