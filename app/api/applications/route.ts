import { NextResponse } from "next/server";

type ApplicationPayload = {
  name: string;
  phone: string;
  cohort: string;
  company: string;
  aiPriority: string;
  source: string;
  submittedAt: string;
};

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

async function forwardToWebhook(payload: ApplicationPayload) {
  const webhookUrl = process.env.APPLICATION_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Application webhook failed with ${response.status}`);
  }
}

async function sendApplicationEmail(payload: ApplicationPayload) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.APPLICATION_TO_EMAIL;

  if (!resendApiKey || !toEmail) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.APPLICATION_FROM_EMAIL || "AIforSaudi <onboarding@resend.dev>",
      to: [toEmail],
      subject: `New AIforSaudi application: ${payload.cohort}`,
      text: [
        "New AIforSaudi application",
        "",
        `Name: ${payload.name}`,
        `Phone / WhatsApp: ${payload.phone}`,
        `Cohort: ${payload.cohort}`,
        `Company: ${payload.company}`,
        `Priority: ${payload.aiPriority}`,
        `Source: ${payload.source}`,
        `Submitted at: ${payload.submittedAt}`,
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Application email failed with ${response.status}`);
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const redirectUrl = new URL("/thank-you", request.url);
  const payload: ApplicationPayload = {
    name: getRequiredValue(formData, "name"),
    phone: getRequiredValue(formData, "phone"),
    cohort: getRequiredValue(formData, "cohort") || getRequiredValue(formData, "program"),
    company:
      getRequiredValue(formData, "company") || getRequiredValue(formData, "business"),
    aiPriority:
      getRequiredValue(formData, "ai_priority") ||
      getRequiredValue(formData, "operating_problem"),
    source: getRequiredValue(formData, "source") || "website",
    submittedAt: new Date().toISOString(),
  };

  if (
    !payload.name ||
    !payload.phone ||
    !payload.cohort ||
    !payload.company ||
    !payload.aiPriority
  ) {
    redirectUrl.searchParams.set("status", "missing");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await Promise.all([forwardToWebhook(payload), sendApplicationEmail(payload)]);
    console.info("AIforSaudi application received", {
      cohort: payload.cohort,
      company: payload.company,
      source: payload.source,
      submittedAt: payload.submittedAt,
    });
    redirectUrl.searchParams.set("status", "received");
    // Pass form data so thank-you page can build pre-filled WhatsApp message
    redirectUrl.searchParams.set("name", payload.name);
    redirectUrl.searchParams.set("company", payload.company);
    redirectUrl.searchParams.set("cohort", payload.cohort);
    redirectUrl.searchParams.set("priority", payload.aiPriority);
  } catch (error) {
    console.error("AIforSaudi application delivery failed", error);
    redirectUrl.searchParams.set("status", "received");
  }

  return NextResponse.redirect(redirectUrl, 303);
}
