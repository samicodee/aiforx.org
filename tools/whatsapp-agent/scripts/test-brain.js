/**
 * Quick brain test — simulates a lead conversation via Ollama
 * Usage: node scripts/test-brain.js
 */
const readline = require("readline");
require("dotenv").config();
const { buildPrompt } = require("../src/brain");
const config = require("../src/config");

const chat = {
  chatId: "test@c.us",
  contactName: "Test Lead",
  category: "founder_lead",
  stage: "new",
  industry: "",
  messages: []
};

async function ask(text) {
  const messages = buildPrompt(text, chat, config);
  const res = await fetch(`${config.brain.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.brain.ollamaModel,
      stream: false,
      format: "json",
      think: false,
      options: { temperature: 0.1, num_predict: 600 },
      messages
    })
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const raw = body.message?.content || "";

  let decision;
  try {
    const start = raw.indexOf("{"), end = raw.lastIndexOf("}");
    decision = JSON.parse(raw.slice(start, end + 1));
  } catch {
    console.log("Raw output:", raw);
    return;
  }

  // Update simulated chat state
  chat.messages.push({ direction: "in", body: text });
  if (decision.reply) chat.messages.push({ direction: "out", body: decision.reply });
  if (decision.stage) chat.stage = decision.stage;
  if (decision.industry) chat.industry = decision.industry;
  if (decision.category) chat.category = decision.category;

  console.log(`\n🤖  ${decision.reply || "(no reply)"}`);
  console.log(`    stage=${decision.stage} | industry=${decision.industry || "-"} | escalate=${decision.escalate}`);
  if (decision.note) console.log(`    note: ${decision.note}`);
  console.log();
}

async function main() {
  console.log(`\nTesting brain with Ollama (${config.brain.ollamaModel})`);
  console.log("Type as a lead. Ctrl+C to exit.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.question("You: ", async (line) => {
    if (!line.trim()) return prompt();
    try { await ask(line.trim()); } catch (e) { console.error("Error:", e.message); }
    prompt();
  });

  prompt();
}

main();
