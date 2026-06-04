"use client";

import { useEffect, useState } from "react";

const WHATSAPP_NUMBER = "919550345280";

const COHORT_LABELS: Record<string, string> = {
  founders: "AI for Founders",
  operators: "AI for Operators",
  engineers: "AI for Engineers",
  company: "Company 1:1",
  saudi: "AI for Saudi",
};

function buildWhatsAppMessage(name: string, company: string, cohort: string, priority: string) {
  const cohortLabel = COHORT_LABELS[cohort] || cohort || "AI for Founders";
  const parts = [`Hi! I'm ${name || "there"}${company ? ` from ${company}` : ""}.`];
  parts.push(`I just applied for the ${cohortLabel} program.`);
  if (priority) parts.push(`My main AI priority: ${priority}.`);
  parts.push("Talk to your program head to understand possibilities.");
  return parts.join(" ");
}

export function ThankYouClient({
  name,
  company,
  cohort,
  priority,
}: {
  name: string;
  company: string;
  cohort: string;
  priority: string;
}) {
  const message = buildWhatsAppMessage(name, company, cohort, priority);
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    if (countdown <= 0) {
      window.location.href = waUrl;
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, waUrl]);

  const cohortLabel = COHORT_LABELS[cohort] || "AI for Founders";

  return (
    <section className="thank-you-panel">
      <p className="saudi-kicker">Application received</p>
      <h1>Thank you{name ? `, ${name}` : ""}!</h1>
      <p>
        Your application for <strong>{cohortLabel}</strong> has been received.
        The next step is a quick chat with our program head to understand possibilities.
      </p>

      {/* Program badges */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "16px 0" }}>
        {Object.values(COHORT_LABELS).map((label) => (
          <span
            key={label}
            style={{
              padding: "4px 12px",
              borderRadius: "999px",
              background: label === cohortLabel ? "#1a1a1a" : "#f0f0f0",
              color: label === cohortLabel ? "#fff" : "#555",
              fontSize: "13px",
              fontWeight: label === cohortLabel ? 600 : 400,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      <p style={{ color: "#666", fontSize: "14px" }}>
        Opening WhatsApp in {countdown > 0 ? `${countdown}s` : "now"}…
      </p>

      <div className="thank-you-actions">
        <a className="button saudi-primary" href={waUrl}>
          Message on WhatsApp →
        </a>
        <a className="button thank-you-secondary" href="/#apply">
          Submit Another Application
        </a>
      </div>
    </section>
  );
}
