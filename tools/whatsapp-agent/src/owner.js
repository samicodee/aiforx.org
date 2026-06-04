const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const knowledgeDir = path.join(__dirname, "..", "knowledge");
const learningsPath = path.join(knowledgeDir, "learnings.md");
const pendingPath = path.join(dataDir, "pending-questions.json");

function nowIso() {
  return new Date().toISOString();
}

function loadPending() {
  try {
    return JSON.parse(fs.readFileSync(pendingPath, "utf8"));
  } catch {
    return [];
  }
}

function savePending(list) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(pendingPath, JSON.stringify(list, null, 2));
}

function appendLearning(guidance, context) {
  fs.mkdirSync(knowledgeDir, { recursive: true });
  const entry = `\n## ${nowIso()}\nContext: ${context}\nGuidance: ${guidance}\n`;
  fs.appendFileSync(learningsPath, entry);
}

function readLearnings() {
  try {
    return fs.readFileSync(learningsPath, "utf8");
  } catch {
    return "";
  }
}

function isOwnerNumber(from, ownerNotifyNumber) {
  if (!ownerNotifyNumber) return false;
  const clean = ownerNotifyNumber.replace(/\D/g, "");
  // Strip @suffix and non-digits, then check suffix match (handles country code variants)
  const fromClean = (from || "").replace(/@c\.us|@lid|@s\.whatsapp\.net/g, "").split(":")[0].replace(/\D/g, "");
  if (!fromClean) return false;
  // Match if either ends with the other (handles +91 prefix or without)
  return fromClean.endsWith(clean.slice(-10)) || clean.endsWith(fromClean.slice(-10));
}

function addPendingQuestion({ leadChatId, leadName, leadMessage, industry, stage }) {
  const list = loadPending();
  list.push({
    id: Date.now().toString(),
    leadChatId,
    leadName,
    leadMessage,
    industry,
    stage,
    askedAt: nowIso(),
    answered: false
  });
  savePending(list);
}

function getUnansweredPending() {
  return loadPending().filter((q) => !q.answered);
}

function markAnswered(id) {
  const list = loadPending();
  const item = list.find((q) => q.id === id);
  if (item) item.answered = true;
  savePending(list);
}

async function ownerReply(message, text, agentPendingBodies) {
  agentPendingBodies.add(text);
  await message.reply(text);
  agentPendingBodies.delete(text);
}

async function handleOwnerMessage(message, client, config, agentPendingBodies) {
  const text = (message.body || "").trim();
  if (!text) return;

  console.log(`[owner] Message from Sami: ${text.slice(0, 80)}`);

  // Answer questions about the agent's state (with or without ?)
  const t = text.toLowerCase().replace(/\?$/, "").trim();
  const isQuestion = text.endsWith("?") || ["who am i","who ami i","who ami","who are you"].includes(t) || t.startsWith("how many") || t.startsWith("what did you") || t.startsWith("show");
  if (isQuestion) {
    if (t.includes("who am i") || t.includes("who are you")) {
      await ownerReply(message,
        `You are *${config.ownerName}* (Mohd Sami Uddin), the program head for AI for Founders. I treat all messages from your number as owner instructions.`,
        agentPendingBodies
      );
      return;
    }
    if (t.includes("how many lead") || t.includes("how many chat")) {
      const { loadState } = require("./state");
      const state = loadState();
      const count = Object.keys(state.chats || {}).length;
      await ownerReply(message, `I currently have *${count} lead chats* in memory.`, agentPendingBodies);
      return;
    }
    if (t.includes("what did you learn") || t.includes("show learning")) {
      const learnings = readLearnings();
      const preview = learnings.trim().split("\n").slice(-10).join("\n") || "(nothing yet)";
      await ownerReply(message, `*Recent learnings:*\n${preview}`, agentPendingBodies);
      return;
    }
    // Unknown question — just confirm
    await ownerReply(message, `Got your question. To teach me something, just tell me directly (no question mark). To send a message to a lead: *send to [name]: [message]*`, agentPendingBodies);
    return;
  }

  // "send to [name]: [message]" — direct relay to a lead
  const sendMatch = text.match(/^send to (.+?):\s*([\s\S]+)$/i);
  if (sendMatch) {
    const name = sendMatch[1].trim();
    const relay = sendMatch[2].trim();

    const { loadState } = require("./state");
    const state = loadState();
    const chat = Object.values(state.chats || {}).find(
      (c) => c.contactName && c.contactName.toLowerCase().includes(name.toLowerCase())
    );

    if (chat) {
      agentPendingBodies.add(relay);
      await client.sendMessage(chat.chatId, relay);
      agentPendingBodies.delete(relay);
      appendLearning(`Send to ${chat.contactName}: "${relay}"`, `Direct relay by Sami`);
      console.log(`[owner] Relayed to ${chat.contactName}: ${relay.slice(0, 60)}`);
      await ownerReply(message, `✅ Sent to ${chat.contactName}`, agentPendingBodies);
    } else {
      await ownerReply(message, `❌ No lead found named "${name}". Check spelling.`, agentPendingBodies);
    }
    return;
  }

  // "talk to [name]" — read history, generate contextual follow-up, send it
  const talkMatch = text.match(/^(?:talk to|resume|unpause|handback|hand back|agent take|continue with)\s+(.+)$/i);
  if (talkMatch) {
    const name = talkMatch[1].trim();
    const { loadState, updateChatState, appendMessage } = require("./state");
    const { generateSmartReply } = require("./brain");
    const config = require("./config");
    const state = loadState();
    const chat = Object.values(state.chats || {}).find(
      (c) => c.contactName && c.contactName.toLowerCase().includes(name.toLowerCase())
    );

    if (!chat) {
      await ownerReply(message, `❌ No lead found named "${name}". Check spelling.`, agentPendingBodies);
      return;
    }

    // Unpause first
    updateChatState(chat.chatId, { pausedUntil: null });

    // Check last message — only reply if lead's message is waiting unanswered
    const messages = chat.messages || [];
    const lastMsg = messages[messages.length - 1];
    const leadIsWaiting = lastMsg && lastMsg.direction === "in";

    if (!leadIsWaiting) {
      // Last message was from us — just unpause, wait for lead to reply
      console.log(`[owner:talk-to] Unpaused ${chat.contactName} — last message was outbound, waiting for lead`);
      await ownerReply(message, `✅ Unpaused ${chat.contactName}. Last message was yours — agent will reply when they respond.`, agentPendingBodies);
      return;
    }

    // Lead's message is unanswered — generate and send a reply
    await ownerReply(message, `🔍 ${chat.contactName} has an unanswered message — generating reply...`, agentPendingBodies);

    try {
      const decision = await generateSmartReply(lastMsg.body, chat, config);

      if (!decision.reply) {
        await ownerReply(message, `⚠️ Agent couldn't decide what to say. Send manually: send to ${name}: [your message]`, agentPendingBodies);
        return;
      }

      agentPendingBodies.add(decision.reply);
      await client.sendMessage(chat.chatId, decision.reply);
      agentPendingBodies.delete(decision.reply);

      appendMessage(chat.chatId, { direction: "out", fromAgent: true, body: decision.reply, at: new Date().toISOString() });
      updateChatState(chat.chatId, {
        lastOutboundAt: new Date().toISOString(),
        stage: decision.stage || chat.stage,
        category: decision.category || chat.category
      });

      console.log(`[owner:talk-to] Replied to ${chat.contactName}: ${decision.reply.slice(0, 60)}`);
      await ownerReply(message, `✅ Replied to ${chat.contactName}:\n\n_"${decision.reply}"_\n\nStage: ${decision.stage || chat.stage}`, agentPendingBodies);
    } catch (err) {
      console.error(`[owner:talk-to] Error: ${err.message}`);
      await ownerReply(message, `❌ Failed to generate reply: ${err.message}`, agentPendingBodies);
    }
    return;
  }

  // "learn: [guidance]" — explicit teaching
  const learnMatch = text.match(/^learn:\s*([\s\S]+)$/i);
  if (learnMatch) {
    appendLearning(learnMatch[1].trim(), "Explicit teaching from Sami");
    console.log(`[owner:learn] ${learnMatch[1].slice(0, 60)}`);
    await ownerReply(message, "✅ Learned! I'll apply this going forward.", agentPendingBodies);
    return;
  }

  // Check if there are pending unanswered questions — link reply to them
  const pending = getUnansweredPending();
  if (pending.length > 0) {
    const latest = pending[pending.length - 1];
    appendLearning(text, `Re: "${latest.leadMessage}" from ${latest.leadName} (${latest.industry || "unknown industry"})`);
    markAnswered(latest.id);
    console.log(`[owner:learn] Linked to pending Q about ${latest.leadName}: ${text.slice(0, 60)}`);

    const shouldRelay = text.length < 300 && !text.toLowerCase().startsWith("don't") && !text.toLowerCase().startsWith("no ");
    if (shouldRelay) {
      agentPendingBodies.add(text);
      await client.sendMessage(latest.leadChatId, text);
      agentPendingBodies.delete(text);
      console.log(`[owner:relay] Sent Sami's reply to ${latest.leadName}`);
      await ownerReply(message, `✅ Learned & sent to ${latest.leadName}. ${pending.length - 1} more questions pending.`, agentPendingBodies);
    } else {
      await ownerReply(message, `✅ Learned as guidance for future. ${pending.length - 1} more pending.`, agentPendingBodies);
    }
    return;
  }

  // Nothing matched — don't silently save as learning, tell Sami what commands exist
  console.log(`[owner:unrecognized] ${text.slice(0, 60)}`);
  await ownerReply(message,
    `I didn't recognise that as a command.\n\n` +
    `*What I understand:*\n` +
    `• *learn: [guidance]* — save a lesson\n` +
    `• *send to [name]: [message]* — send a message to a lead\n` +
    `• *talk to [name]* — unpause a lead, hand back to agent\n` +
    `• *what did you learn?* — show recent learnings\n` +
    `• *how many leads?* — lead count\n\n` +
    `If you want to teach me something, start with *learn:*`,
    agentPendingBodies
  );
}

async function askSami(client, config, agentPendingBodies, { leadChatId, leadName, leadNumber, leadMessage, industry, stage, chatHistory }) {
  if (!config.ownerNotifyNumber) return;

  const to = config.ownerNotifyNumber.includes("@") ? config.ownerNotifyNumber : `${config.ownerNotifyNumber}@c.us`;

  const historyPreview = (chatHistory || [])
    .slice(-4)
    .map((m) => `${m.direction === "in" ? "Lead" : "Agent"}: ${m.body}`)
    .join("\n");

  const header = leadNumber ? `${leadNumber} - ${leadName}` : leadName;

  const question =
    `*${header} - Agent needs help*\n\n` +
    `Industry: ${industry || "unknown"} | Stage: ${stage || "unknown"}\n\n` +
    `Their message: _"${leadMessage}"_\n\n` +
    (historyPreview ? `Recent chat:\n${historyPreview}\n\n` : "") +
    `How should I handle this?\n` +
    `• Reply with your guidance — I'll learn it\n` +
    `• Or: *send to ${leadName}: [your message]* to send directly`;

  addPendingQuestion({ leadChatId, leadName, leadMessage, industry, stage });

  agentPendingBodies.add(question);
  await client.sendMessage(to, question);
  agentPendingBodies.delete(question);
  console.log(`[owner:ask] Asked Sami about ${leadName}: ${leadMessage.slice(0, 50)}`);
}

module.exports = { isOwnerNumber, handleOwnerMessage, askSami, readLearnings };
