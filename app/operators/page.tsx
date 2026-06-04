import type { Metadata } from "next";
import { Header } from "@/app/components/Header";

export const metadata: Metadata = {
  title: "AI for Operators",
  description:
    "Practical AI for operators, managers, and execution teams. Better reporting, SOPs, follow-ups, delegation, and daily team operations.",
  alternates: { canonical: "/operators/" },
};

const outcomes = [
  {
    title: "Operations Command",
    copy: "Convert daily updates into management reports, escalation summaries, and operations dashboards your leadership can act on.",
  },
  {
    title: "SOPs & Process Systems",
    copy: "Create checklists, shift handovers, vendor follow-ups, meeting notes, and recurring process templates faster.",
  },
  {
    title: "Team & Hiring Workflows",
    copy: "Track leads, service issues, hiring pipelines, and team accountability with AI-assisted coordination systems.",
  },
];

export default function OperatorsPage() {
  return (
    <>
      <Header />
      <main>
        <section className="program-hero">
          <img
            src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2200&q=84"
            alt=""
            aria-hidden="true"
          />
          <div className="program-hero-overlay" aria-hidden="true" />
          <div className="program-hero-inner">
            <p className="kicker">AIforX · Operators Track</p>
            <h1>AI for the people running the business.</h1>
            <p>
              For operators, managers, sales leads, CXOs, and execution teams
              who need practical systems for reporting, SOPs, delegation,
              follow-ups, procurement, and daily team execution.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a className="button primary" href="#apply">Apply for Operators Track</a>
              <a className="button secondary" href="https://www.aiforoperators.org" target="_blank" rel="noopener noreferrer">
                aiforoperators.org ↗
              </a>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-heading wide">
            <p className="kicker">Track Outcomes</p>
            <h2>Operational leverage through AI.</h2>
            <p>
              Operators leave with working dashboards, SOP templates, follow-up sequences,
              and team accountability workflows they can use the next morning.
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

        <div id="apply" className="cta-band">
          <div className="cta-band-inner">
            <div>
              <h2>The full operators program is coming to aiforoperators.org</h2>
              <p>Apply now via AIforX and we'll confirm your cohort and dates.</p>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <a className="button white" href="/#apply">Apply Now →</a>
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
