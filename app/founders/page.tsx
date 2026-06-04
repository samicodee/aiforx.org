import type { Metadata } from "next";
import { Header } from "@/app/components/Header";

export const metadata: Metadata = {
  title: "AI for Founders",
  description:
    "Practical AI for founders and business owners. Build your founder operating system with AI — decisions, sales, delegation, hiring, and reporting.",
  alternates: { canonical: "/founders/" },
};

const outcomes = [
  {
    title: "Founder Decision Workflows",
    copy: "Turn scattered business context into decision briefs, tradeoff notes, weekly priorities, and execution reviews.",
  },
  {
    title: "Sales & Proposal Leverage",
    copy: "Build repeatable workflows for lead qualification, follow-ups, proposals, and founder-led closing support.",
  },
  {
    title: "Delegation Systems",
    copy: "Create JDs, hiring scorecards, task briefs, review checklists, and manager-ready operating templates.",
  },
];

export default function FoundersPage() {
  return (
    <>
      <Header />
      <main>
        <section className="program-hero">
          <img
            src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=2200&q=84"
            alt=""
            aria-hidden="true"
          />
          <div className="program-hero-overlay" aria-hidden="true" />
          <div className="program-hero-inner">
            <p className="kicker">AIforX · Founders Track</p>
            <h1>Build your founder operating system with AI.</h1>
            <p>
              For founders and business owners who carry decisions, sales, people,
              and operations in their head. This track builds repeatable AI workflows
              for the work you do every day.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a className="button primary" href="#apply">Apply for Founders Track</a>
              <a className="button secondary" href="https://www.aiforfounders.org" target="_blank" rel="noopener noreferrer">
                aiforfounders.org ↗
              </a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading wide">
            <p className="kicker">Track Outcomes</p>
            <h2>Three working systems, not theory.</h2>
            <p>
              Every founder cohort ends with usable workflows, templates, and operating
              habits — not a certificate. You leave with AI-powered systems for your
              actual daily work.
            </p>
          </div>
          <div className="outcome-grid">
            {outcomes.map((o, i) => (
              <article key={o.title}>
                <span className="number">{String(i + 1).padStart(2, "0")}</span>
                <h3>{o.title}</h3>
                <p>{o.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="cta-band">
          <div className="cta-band-inner">
            <div>
              <h2>The full founders program lives at aiforfounders.org</h2>
              <p>Curriculum, cohort dates, pricing, and the full application.</p>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a
                className="button white"
                href="https://www.aiforfounders.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Go to aiforfounders.org →
              </a>
              <a className="button white-outline" href="/#apply">Apply via AIforX</a>
            </div>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <span className="wordmark">AI for <span>X</span></span>
        <span>Part of the AIforX brand family.</span>
      </footer>
    </>
  );
}
