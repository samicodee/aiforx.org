const READY_WORDS = ["pay", "payment", "fee", "price", "cost", "enroll", "enrol", "seat", "batch"];
const FORM_SIGNALS = ["i just applied for the", "talk to your program head", "my main ai priority", "i filled the ai for founders form"];
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const GREETING_WORDS = ["hi", "hello", "hey", "salam", "assalam", "interested", "details", "info"];
const BOT_DETECT_WORDS = ["are you human", "human or bot", "bot or human", "are you a bot", "are you robot", "is this a bot", "is this bot", "talking to bot", "real person", "real human"];
const FRUSTRATION_WORDS = [
  "mad man", "looks like a robot", "you are robot", "you're a robot",
  "stop asking", "same question", "you mad", "irritating", "annoying", "go away",
  "be gentle", "can't you answer", "cant you answer", "not answering", "why not answering",
  "answer my question", "asking again", "again same", "repeating", "asked me again",
  "already told", "i told you", "i said both", "i'm betting", "dude stop",
  "why repeating", "stop repeating", "you keep asking", "same thing again"
];
const ABUSIVE_WORDS = ["fuck", "bastard", "idiot", "stupid bot", "useless", "scam", "fraud", "cheat", "hate you", "block you"];

function normalize(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function classify(text) {
  const t = normalize(text);
  if (
    t.includes("ai for founders") || t.includes("aiforfounders") ||
    t.includes("founders program") || t.includes("founder program")
  ) return "founder_lead";
  if (t.includes("online class") || t.includes("attend online") || t.includes("offline class")) return "student_ops";
  if (t.includes("chest") || t.includes("mri") || t.includes("numbness")) return "human_needed";
  return "unknown";
}

function inferIndustry(text) {
  const t = normalize(text);
  if (t.includes("restaurant") || t.includes("hotel") || t.includes("cafe") || t.includes("food")) return "restaurant";
  if (t.includes("builder") || t.includes("construction") || t.includes("site") || t.includes("contractor")) return "construction";
  if (t.includes("doctor") || t.includes("clinic") || t.includes("hospital")) return "healthcare";
  if (t.includes("venture capital") || t.includes(" vc ") || t.includes("vc,") || t.includes("i'm a vc") || t.includes("i am a vc")) return "venture_capital";
  if (t.includes("real estate") || t.includes("property")) return "real_estate";
  if (t.includes("retail") || t.includes("ecommerce") || t.includes("e-commerce") || t.includes("online store")) return "retail";
  if (t.includes("manufacturing") || t.includes("factory") || t.includes("production")) return "manufacturing";
  return "";
}

function hasReadySignal(text) {
  const t = normalize(text);
  if (t.includes("can i join") || t.includes("can join") || t.includes("eligible")) return false;
  if (t.includes("want to join") || t.includes("ready to join")) return true;
  return READY_WORDS.some((word) => t.includes(word));
}

function hasFounderOpeningSignal(text) {
  const t = normalize(text);
  if (!t) return false;
  if (GREETING_WORDS.some((word) => t === word || t.includes(word))) return true;
  if (t.includes("filled") && t.includes("form")) return true;
  if (t.includes("program") || t.includes("founder") || t.includes("ai")) return true;
  return false;
}

function isBotDetect(text) {
  const t = normalize(text);
  return BOT_DETECT_WORDS.some((phrase) => t.includes(phrase));
}

function isFrustrated(text) {
  const t = normalize(text);
  return FRUSTRATION_WORDS.some((phrase) => t.includes(phrase));
}

function isAbusive(text) {
  const t = normalize(text);
  return ABUSIVE_WORDS.some((phrase) => t.includes(phrase));
}

function isFormSubmission(text) {
  const t = normalize(text);
  return FORM_SIGNALS.some((s) => t.includes(s));
}

function extractEmail(text) {
  const match = (text || "").match(EMAIL_REGEX);
  return match ? match[0] : "";
}

function extractFormData(text) {
  // Parse the pre-filled WhatsApp message from the form
  // Format: "Hi! I'm [name] from [company]. I just applied for the [cohort] program. My main AI priority: [priority]. Talk to your program head..."
  const nameMatch = text.match(/I'm ([^.]+?) from ([^.]+?)\./i) ||
                    text.match(/I'm ([^.]+?)\./i);
  const cohortMatch = text.match(/applied for the (.+?) program/i);
  const priorityMatch = text.match(/AI priority:\s*([^.]+)/i) ||
                        text.match(/priority:\s*([^.]+)/i);

  const name = nameMatch ? nameMatch[1].replace(/^Hi!\s*/i, "").trim() : "";
  const company = nameMatch && nameMatch[2] ? nameMatch[2].trim() : "";
  const cohort = cohortMatch ? normalize(cohortMatch[1]).replace(/\s+/g, "_") : "founders";
  const aiPriority = priorityMatch ? priorityMatch[1].trim() : "";

  return { name, company, cohort, aiPriority };
}

function cohortToCategory(cohort) {
  if (!cohort) return "founder_lead";
  const c = normalize(cohort);
  if (c.includes("engineer")) return "engineer_lead";
  if (c.includes("operator")) return "operator_lead";
  if (c.includes("saudi")) return "saudi_lead";
  if (c.includes("company") || c.includes("1:1")) return "company_lead";
  return "founder_lead";
}

// Count how many of the last N inbound messages were frustrated
function countRecentFrustration(chat, lookback = 5) {
  const inbound = (chat.messages || [])
    .filter((m) => m.direction === "in")
    .slice(-lookback);
  return inbound.filter((m) => isFrustrated(m.body || "")).length;
}

// Check if enough context is known to pitch the program
function isQualified(chat) {
  return (
    (chat.industry && chat.industry !== "") &&
    (chat.stage === "qualified" || chat.stage === "qualifying") &&
    (chat.summary || chat.industry)
  );
}

function pitchForIndustry(industry, config) {
  const name = config.program.name;
  const ind = normalize(industry).replace(/\s+/g, "_");
  switch (ind) {
    case "venture_capital":
      return `For VCs, AI can auto-collect portfolio reports, flag missing ones, and give you a one-line summary per company — so you're not chasing founders every month. Does that sound useful for your situation?`;
    case "restaurant":
      return `For restaurants, AI can track daily sales vs target, flag wastage, and send you a quick summary each morning — without you asking. Is that the kind of thing that would help you?`;
    case "construction":
      return `For construction, AI can pull together site updates, flag delays, and keep clients informed automatically — so you're not the middleman for every update. Does that fit what you're dealing with?`;
    case "healthcare":
      return `For clinics, AI can follow up with patients, track appointments, and flag gaps — so your staff focuses on care, not admin. Is that the bottleneck you're facing?`;
    case "real_estate":
      return `For real estate, AI can follow up with leads, track enquiries, and send you a daily summary — so nothing slips. Does that match what's costing you time?`;
    case "retail":
      return `For retail, AI can alert you on low stock, summarise daily sales, and flag slow-moving items — before they become a problem. Is that useful for you?`;
    case "manufacturing":
      return `For manufacturing, AI can consolidate daily production numbers, flag quality issues, and follow up with vendors — so you get a clear picture without chasing people. Does that match your situation?`;
    default:
      return `${name} is for founders who want AI handling repetitive decisions, follow-ups, and reporting — so you focus on what matters. What's the one thing eating the most time in your week?`;
  }
}

function founderReply(text, chat, config) {
  const t = normalize(text);
  const industry = inferIndustry(text) || chat.industry || "";

  if (hasReadySignal(text) && config.program.fee && config.program.paymentDetails) {
    return {
      stage: "ready_to_pay",
      industry,
      escalate: true,
      reply:
        `This looks like a fit. I can block your seat for ${config.program.name}. ` +
        `Fee is ${config.program.fee}. Payment details: ${config.program.paymentDetails}. ` +
        "Once done, share the screenshot here and I will confirm your onboarding."
    };
  }

  if (hasReadySignal(text)) {
    return {
      stage: "ready_to_pay",
      industry,
      escalate: true,
      reply:
        "This looks like a great fit! Two options:\n\n" +
        "1️⃣ *Cohort (June 27)* — $1000/person, up to 10 founders/executives learning together\n" +
        "2️⃣ *Company 1:1* — $4500, full engagement for your company, scheduled as per your availability\n\n" +
        "Only 10 seats left in the June 27 batch. Which one works better for you?"
    };
  }

  if (t.includes("not convinced") || t.includes("doubt") || t.includes("not sure")) {
    return {
      stage: "objection",
      industry,
      reply: "Fair. You should join only if it is directly useful. What is the main doubt: results, time commitment, fee, or whether AI can help your work? Tell me one repeated business problem you face weekly and I will show how we convert it into a simple workflow."
    };
  }

  if (t.includes("not a tech") || t.includes("non tech") || t.includes("coding")) {
    return {
      stage: "objection",
      industry,
      reply: "You do not need to be technical. This is not a coding program. It is for founders who can use WhatsApp and basic Sheets/Excel. We focus on decisions, follow-up, reporting, sales, delegation, and simple business systems."
    };
  }

  if (t.includes("gpt") || t.includes("save cost") || t.includes("save time")) {
    return {
      stage: "objection",
      industry,
      reply: "Using GPT casually does not save time. The saving comes when repeated work becomes a fixed workflow — daily numbers, complaints, staff issues, follow-ups all go into one format. AI then gives decisions, reminders, and next actions. The program teaches you to build those repeatable workflows for your business."
    };
  }

  // If industry is known and lead has been qualifying — pitch now
  if (industry && isQualified({ ...chat, industry })) {
    return {
      stage: "qualified",
      industry,
      reply: pitchForIndustry(industry, config)
    };
  }

  // Industry known but not yet pitched
  if (industry) {
    return {
      stage: "qualified",
      industry,
      reply: pitchForIndustry(industry, config)
    };
  }

  return {
    stage: chat.stage === "new" ? "qualifying" : chat.stage,
    industry,
    reply:
      `${config.program.name} is for founders and business owners who want AI for real work: decisions, sales, hiring, delegation, tracking, and weekly reviews. ` +
      "What kind of business are you running?"
  };
}

function studentOpsReply(text) {
  const t = normalize(text);
  if (t.includes("11th june") || t.includes("11 june")) {
    return {
      stage: "resolved",
      category: "student_ops",
      reply: "Wa alaikum assalam. Okay, attend online till 11 June only because of the exam clash. Attend every online class properly, complete all class work/assignments, and come offline immediately after exams. Keep the team updated if any class is missed."
    };
  }
  return {
    stage: "resolved",
    category: "student_ops",
    reply: "Wa alaikum assalam. Okay, attend online for today only. Make sure you do not miss the class work, and from the next class attend offline properly."
  };
}

function directFunnelReply(text, chat, config) {
  const name = chat.contactName && !chat.contactName.match(/^\d+$/) ? chat.contactName.split(" ")[0] : null;
  const industry = inferIndustry(text) || chat.industry || "";
  const t = normalize(text);

  // Step 1 — if we don't know their name yet, ask
  if (!name && chat.stage === "new") {
    return {
      stage: "collecting_info",
      category: "founder_lead",
      reply: "Hey! 👋 Welcome to AI for Founders. What's your name?"
    };
  }

  // Step 2 — if we have name but no industry/company, ask about their business
  if (!chat.industry && (chat.stage === "new" || chat.stage === "collecting_info")) {
    const greeting = name ? `Nice to meet you, ${name}!` : "Great!";
    return {
      stage: "collecting_info",
      category: "founder_lead",
      reply: `${greeting} What kind of business are you running?`
    };
  }

  // Step 3 — if email explicitly given, save it and continue
  const emailFound = extractEmail(text);
  if (emailFound && !chat.email) {
    return {
      stage: chat.stage || "qualifying",
      category: chat.category || "founder_lead",
      email: emailFound,
      reply: `Got it! I've noted your email. ${pitchForIndustry(industry, config)}`
    };
  }

  // Step 4 — industry known, pitch
  if (industry && chat.stage !== "qualified" && chat.stage !== "objection" && chat.stage !== "ready_to_pay") {
    return { category: "founder_lead", stage: "qualifying", industry, reply: pitchForIndustry(industry, config) };
  }

  // Fall through to main founderReply
  return null;
}

function generateReply(text, chat, config) {
  const category = classify(text);

  // Abusive → silent escalate, no reply
  if (isAbusive(text)) {
    return {
      category: chat.category || "unknown",
      stage: "human_needed",
      escalate: true,
      reply: null,
      note: "Abusive message. Do not reply — human should decide."
    };
  }

  // Form submission message — pre-qualify immediately
  if (isFormSubmission(text)) {
    const data = extractFormData(text);
    const cat = cohortToCategory(data.cohort);
    const industry = inferIndustry(data.aiPriority) || inferIndustry(data.company) || chat.industry || "";
    const nameStr = data.name || chat.contactName || "";
    const hi = nameStr ? `Hi ${nameStr.split(" ")[0]}!` : "Hi!";
    const prioritySnippet = data.aiPriority ? ` You mentioned: _"${data.aiPriority}"_.` : "";
    return {
      category: cat,
      stage: "pre_qualified",
      industry,
      company: data.company,
      cohort: data.cohort,
      aiPriority: data.aiPriority,
      fromForm: true,
      contactName: data.name || chat.contactName,
      escalate: false,
      reply: `${hi} Great to connect!${prioritySnippet} That's exactly the kind of problem we tackle in the program.\n\nQuick question — what does your typical week look like right now? Which task is eating the most time?`
    };
  }

  // Bot detection → honest answer, keep going
  if (isBotDetect(text)) {
    return {
      category: chat.category || "founder_lead",
      stage: chat.stage || "qualifying",
      escalate: true,
      note: "Lead asked if this is a bot — Sami should follow up personally.",
      reply: "I'm the program manager for AI for Founders. Sami will also personally connect with you shortly. What would you like to know about the program?"
    };
  }

  // Frustration — check severity
  if (isFrustrated(text)) {
    const frustrationCount = countRecentFrustration(chat, 5);
    const industry = chat.industry || "";

    if (frustrationCount >= 3) {
      return {
        category: chat.category || "founder_lead",
        stage: "human_needed",
        escalate: true,
        reply: "I understand you're frustrated. Let me have Sami reach out to you directly right now.",
        note: "Lead frustrated 3+ times. Needs immediate human takeover."
      };
    }

    const pitch = industry ? pitchForIndustry(industry, config) : null;
    return {
      category: chat.category || "founder_lead",
      stage: chat.stage || "qualifying",
      escalate: false,
      reply: pitch
        ? `Sorry for repeating myself! Here's what matters: ${pitch}`
        : "Sorry for the confusion — what specific problem in your business takes up the most time each week?"
    };
  }

  if (category === "human_needed") {
    return { category, stage: "human_needed", escalate: true, reply: null, note: "Sensitive message. Human should handle." };
  }

  if (category === "student_ops" && config.enableStudentOps) {
    return studentOpsReply(text);
  }

  // Pre-qualified leads (from form) — skip discovery, go to bottleneck/pitch
  if (chat.stage === "pre_qualified" || chat.fromForm) {
    return { category: chat.category || "founder_lead", ...founderReply(text, chat, config) };
  }

  if (category === "founder_lead" || chat.category === "founder_lead" || inferIndustry(text) || hasFounderOpeningSignal(text)) {
    // Try sequential direct funnel first
    const directReply = directFunnelReply(text, chat, config);
    if (directReply) return { category: "founder_lead", ...directReply };
    return { category: "founder_lead", ...founderReply(text, chat, config) };
  }

  // Cold unknown message — try direct funnel
  if (chat.stage === "new") {
    const directReply = directFunnelReply(text, chat, config);
    if (directReply) return directReply;
  }

  return {
    category: "unknown",
    stage: "human_needed",
    escalate: true,
    reply: null,
    note: "Unknown inbound message. Human should review."
  };
}

module.exports = {
  classify,
  generateReply,
  inferIndustry,
  hasFounderOpeningSignal,
  isBotDetect,
  isFrustrated,
  isAbusive,
  isFormSubmission,
  extractEmail,
  extractFormData
};
