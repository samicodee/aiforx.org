const { loadState, STATE_FILE } = require("./state");
const fs = require("fs");
const path = require("path");

const state = loadState();
const chats = Object.values(state.chats || {}).sort((a, b) => {
  return String(b.lastInboundAt || "").localeCompare(String(a.lastInboundAt || ""));
});

console.log(`State: ${STATE_FILE}`);
console.log("");

for (const chat of chats) {
  const paused = chat.pausedUntil && new Date(chat.pausedUntil).getTime() > Date.now();
  console.log([
    chat.contactName || chat.chatId,
    `category=${chat.category || "unknown"}`,
    `stage=${chat.stage || "new"}`,
    chat.industry ? `industry=${chat.industry}` : "",
    paused ? `pausedUntil=${chat.pausedUntil}` : ""
  ].filter(Boolean).join(" | "));
}

const alertsPath = path.join(__dirname, "..", "data", "alerts.jsonl");
if (fs.existsSync(alertsPath)) {
  const alerts = fs.readFileSync(alertsPath, "utf8").trim().split("\n").filter(Boolean).slice(-10);
  if (alerts.length) {
    console.log("");
    console.log("Recent alerts:");
    for (const line of alerts) {
      const alert = JSON.parse(line);
      console.log(`${alert.at} | ${alert.title} | ${alert.message}`);
    }
  }
}
