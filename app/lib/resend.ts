import "server-only";

type LeadEmail = {
  business: string;
  business_stage?: string | null;
  email: string;
  name: string;
  phone: string;
  problem_statement: string;
  program: string;
  role: string;
  source_domain: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatLeadText(lead: LeadEmail) {
  return [
    `Name: ${lead.name}`,
    `Phone: ${lead.phone}`,
    `Email: ${lead.email}`,
    `Program: ${lead.program}`,
    `Source: ${lead.source_domain}`,
    `Business: ${lead.business}`,
    `Role: ${lead.role}`,
    `Stage: ${lead.business_stage || "-"}`,
    "",
    "Problem:",
    lead.problem_statement,
  ].join("\n");
}

function formatLeadHtml(lead: LeadEmail) {
  const rows = [
    ["Name", lead.name],
    ["Phone", lead.phone],
    ["Email", lead.email],
    ["Program", lead.program],
    ["Source", lead.source_domain],
    ["Business", lead.business],
    ["Role", lead.role],
    ["Stage", lead.business_stage || "-"],
  ];

  return `
    <h2>New lead: ${escapeHtml(lead.name)}</h2>
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(
              value,
            )}</td></tr>`,
        )
        .join("")}
    </table>
    <h3>Problem</h3>
    <p>${escapeHtml(lead.problem_statement)}</p>
  `;
}

export async function sendLeadNotification(lead: LeadEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_NOTIFICATION_FROM;
  const to = process.env.LEAD_NOTIFICATION_TO;

  if (!apiKey || !from || !to) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((email) => email.trim()).filter(Boolean),
      subject: `New ${lead.source_domain} lead: ${lead.name}`,
      html: formatLeadHtml(lead),
      text: formatLeadText(lead),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend notification failed: ${errorText}`);
  }
}
