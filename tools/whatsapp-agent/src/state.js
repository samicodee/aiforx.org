const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");

function ensureStateFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ chats: {} }, null, 2));
  }
}

function loadState() {
  ensureStateFile();
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  ensureStateFile();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getChatState(chatId, contactName) {
  const state = loadState();
  if (!state.chats[chatId]) {
    state.chats[chatId] = {
      chatId,
      contactName,
      contactNumber: "",
      stage: "new",
      category: "unknown",
      industry: "",
      summary: "",
      company: "",
      cohort: "",
      email: "",
      aiPriority: "",
      fromForm: false,
      supabaseLeadId: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      pausedUntil: null,
      messages: []
    };
    saveState(state);
  }
  return state.chats[chatId];
}

function updateChatState(chatId, patch) {
  const state = loadState();
  state.chats[chatId] = { ...(state.chats[chatId] || { chatId }), ...patch };
  saveState(state);
  return state.chats[chatId];
}

function appendMessage(chatId, message) {
  const state = loadState();
  const chat = state.chats[chatId] || { chatId, messages: [] };
  chat.messages = [...(chat.messages || []), message].slice(-40);
  state.chats[chatId] = chat;
  saveState(state);
}

module.exports = {
  STATE_FILE,
  loadState,
  saveState,
  getChatState,
  updateChatState,
  appendMessage
};
