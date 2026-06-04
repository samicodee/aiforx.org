import type { Metadata } from "next";
import { Header } from "@/app/components/Header";

export const metadata: Metadata = {
  title: "AI for Engineers",
  description:
    "Practical AI for civil, mechanical, electrical, production, and project engineers. Better reports, documentation, and site communication. No coding.",
  alternates: { canonical: "/engineers/" },
};

const outcomes = [
  {
    title: "Project Documentation",
    copy: "Draft site reports, production summaries, quality notes, maintenance logs, and inspection checklists faster.",
  },
  {
    title: "Technical Communication",
    copy: "Explain issues clearly for management, clients, vendors, and cross-functional teams in English or local language.",
  },
  {
    title: "Planning & Risk Workflows",
    copy: "Prepare method statements, RCA drafts, material requests, risk registers, and project update summaries.",
  },
];

export default function EngineersPage() {
  return (
    <>
      <Header />
      <main>
        <section className="program-hero">
          <img
            src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=2200&q=84"
            alt=""
            aria-hidden="true"
          />
          <div className="program-hero-overlay" aria-hidden="true" />
          <div className="program-hero-inner">
            <p className="kicker">AIforX · Engineers Track</p>
            <h1>Applied AI for engineers who do real work.</h1>
            <p>
              For civil, mechanical, electrical, production, project, site, factory,
              and quality engineers who need AI for documents, reports, planning,
              and communication — without becoming software people.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a className="button primary" href="#apply">Apply for Engineers Track</a>
              <a className="button secondary" href="https://www.aiforengineers.org" target="_blank" rel="noopener noreferrer">
                aiforengineers.org ↗
              </a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading wide">
            <p className="kicker">Track Outcomes</p>
            <h2>AI for the work you already own.</h2>
            <p>
              Engineers leave with templates, prompt systems, and documentation workflows
              built around their actual site and project work — not generic AI demos.
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
              <h2>The full engineers program lives at aiforengineers.org</h2>
              <p>Full curriculum, cohort dates, and application for India and Middle East.</p>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a
                className="button white"
                href="https://www.aiforengineers.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Go to aiforengineers.org →
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
