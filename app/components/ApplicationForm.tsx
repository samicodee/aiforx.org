"use client";

import { useState } from "react";
import type { Program } from "@/app/data/programs";

type ApplicationFormProps = {
  defaultProgram?: string;
  programs?: Program[];
  showProgramSelect?: boolean;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function ApplicationForm({
  defaultProgram = "",
  programs = [],
  showProgramSelect = true,
}: ApplicationFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        errors?: Record<string, string>;
        message?: string;
      };

      if (!response.ok) {
        const firstError = result.errors
          ? Object.values(result.errors)[0]
          : result.message;
        throw new Error(firstError ?? "Could not submit application.");
      }

      form.reset();
      setSubmitState("success");
      setMessage(result.message ?? "Application received.");
    } catch (error) {
      setSubmitState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not submit application. Please try again.",
      );
    }
  }

  return (
    <form className="application-form" onSubmit={handleSubmit}>
      <input type="hidden" name="source_domain" value="aiforx.org" />
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
      {!showProgramSelect ? (
        <input type="hidden" name="program" value={defaultProgram} />
      ) : (
        <label>
          Program interest
          <select name="program" required defaultValue={defaultProgram}>
            <option value="" disabled>
              Select one
            </option>
            {programs.map((program) => (
              <option value={program.slug} key={program.slug}>
                {program.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Name
        <input name="name" type="text" autoComplete="name" required />
      </label>
      <label>
        Phone / WhatsApp
        <input name="phone" type="tel" autoComplete="tel" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Business name
        <input name="business" type="text" required />
      </label>
      <label>
        Your role
        <input
          name="role"
          type="text"
          placeholder="Founder, operator, CEO, partner..."
          required
        />
      </label>
      <label>
        Biggest operating problem you want AI to help with
        <textarea name="problem_statement" rows={4} required />
      </label>
      <button
        className="button primary"
        type="submit"
        disabled={submitState === "submitting"}
      >
        {submitState === "submitting" ? "Sending..." : "Send Application"}
      </button>
      <p
        className={`form-note ${
          submitState === "success" ? "is-success" : ""
        } ${submitState === "error" ? "is-error" : ""}`}
        role={submitState === "idle" ? undefined : "status"}
      >
        {message ||
          "Application call required. Payment details depend on the selected program."}
      </p>
    </form>
  );
}
