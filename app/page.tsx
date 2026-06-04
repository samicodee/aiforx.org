import { Header } from "@/app/components/Header";

const programs = [
  {
    num: "01",
    title: "AI for Founders",
    copy: "Founder leverage for decisions, sales, hiring, delegation, and weekly business rhythm. For owners who carry the company in their head.",
    href: "/founders",
  },
  {
    num: "02",
    title: "AI for Operators",
    copy: "Practical systems for reporting, SOPs, delegation, follow-ups, procurement, and team execution. For people running the business.",
    href: "/operators",
  },
  {
    num: "03",
    title: "AI for Engineers",
    copy: "For civil, mechanical, electrical, production, and project engineers who need AI for reports, site work, and documentation. No code.",
    href: "/engineers",
  },
];

const values = [
  {
    title: "No coding required",
    copy: "Every program is built for professionals who do real business and engineering work, not software people.",
  },
  {
    title: "Real workflows",
    copy: "Every session ends with working prompts, templates, dashboards, and operating habits you can use the next morning.",
  },
  {
    title: "Role-based learning",
    copy: "Founders, operators, and engineers have different problems. Each track is built for the actual daily work of that role.",
  },
];

const regions = [
  {
    name: "India",
    detail: "Hyderabad-first. Open cohorts for founders, operators, and engineers across India.",
    flag: "🇮🇳",
  },
  {
    name: "Saudi Arabia",
    detail: "Vision 2030-aligned programs for Saudi founders, operators, and engineers.",
    flag: "🇸🇦",
    link: "aiforsaudi.org",
    href: "https://www.aiforsaudi.org",
  },
  {
    name: "Middle East & Global",
    detail: "Private cohorts and company workshops for teams across the region and beyond.",
    flag: "🌍",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="hero">
          <img
            className="hero-image"
            src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2400&q=84"
            alt=""
            aria-hidden="true"
          />
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero-inner">
            <p className="kicker">AI for Founders · Operators · Engineers</p>
            <h1>Applied AI for real work.</h1>
            <p className="hero-copy">
              India first. Built for the world. Practical AI education and implementation
              for founders, operators, and engineers who need daily leverage — not coding theory.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#programs">
                Explore Programs
              </a>
              <a className="button secondary" href="#apply">
                Apply Now
              </a>
            </div>
            <div className="hero-tags" aria-label="Program highlights">
              <span>India first</span>
              <span>No coding</span>
              <span>3 role tracks</span>
              <span>Real workflows</span>
            </div>
          </div>
        </section>

        {/* Programs */}
        <section id="programs" className="programs-section">
          <div className="programs-inner">
            <div className="section-heading">
              <p className="kicker">Three tracks. One platform.</p>
              <h2>AIforX is built around the roles that run real businesses.</h2>
              <p>
                Separate learning paths for founders, operators, and engineers — each built
                around the actual daily work of that role, not a generic AI overview.
              </p>
            </div>
            <div className="programs-grid">
              {programs.map((p) => (
                <a key={p.title} className="program-card" href={p.href}>
                  <span className="program-card-num">{p.num}</span>
                  <h3>{p.title}</h3>
                  <p>{p.copy}</p>
                  <span className="program-card-link">
                    See the track →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Mission */}
        <section id="mission" className="section intro-section">
          <div className="section-heading">
            <p className="kicker">The Mission</p>
            <h2>AI should not belong only to software people.</h2>
          </div>
          <div className="intro-copy">
            <p>
              AIforX exists to help everyday professionals across India and the world
              use AI in the work they already own. The priority is not technical theory.
              It is capability: better work, better decisions, better communication,
              and better execution.
            </p>
            <p>
              The focus is founders building companies, operators running systems,
              and engineers moving work on site, in factories, and inside projects.
              AIforX shows them what AI can do in their own daily work — starting in India.
            </p>
            <blockquote>
              Real work, improved. No coding needed.
            </blockquote>
          </div>
        </section>

        {/* Values */}
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="values-grid">
            {values.map((v) => (
              <article key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Regions */}
        <section id="regions" className="dark-band">
          <div className="dark-band-inner">
            <div>
              <p className="kicker">Where We Operate</p>
              <h2>India first. Growing globally.</h2>
              <p>
                AIforX launched in India with a Hyderabad-first cohort strategy.
                Regional brands serve specific markets with locally-relevant programs
                under the same practical AI education model.
              </p>
            </div>
            <div className="region-list">
              {regions.map((r) => (
                <div key={r.name} className="region-item">
                  <span style={{ fontSize: 28 }}>{r.flag}</span>
                  <div>
                    <strong style={{ display: "block", color: "#fff", marginBottom: 4 }}>
                      {r.name}
                      {r.link && (
                        <>
                          {" "}
                          <a href={r.href} target="_blank" rel="noopener noreferrer">
                            {r.link} ↗
                          </a>
                        </>
                      )}
                    </strong>
                    <span style={{ color: "rgba(255,255,255,0.62)", fontSize: 14 }}>
                      {r.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Apply */}
        <section id="apply" className="apply-section">
          <div className="apply-inner">
            <div className="apply-copy">
              <p className="kicker" style={{ color: "rgba(100,140,255,0.9)" }}>Apply Now</p>
              <h2>Join a founder, operator, or engineer cohort.</h2>
              <p>
                Open cohorts in India and private company workshops globally.
                The first call confirms your role, program fit, and implementation goals.
              </p>
            </div>
            <form className="apply-form" action="/api/applications/" method="post">
              <input type="hidden" name="source" value="homepage" />
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required />
              </label>
              <label>
                Phone / WhatsApp
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
              <label>
                Track
                <select name="track" required defaultValue="">
                  <option value="" disabled>Select one</option>
                  <option value="founders">AI for Founders</option>
                  <option value="operators">AI for Operators</option>
                  <option value="engineers">AI for Engineers</option>
                  <option value="company">Company / Team Cohort</option>
                </select>
              </label>
              <label>
                Company / organization
                <input name="company" type="text" required />
              </label>
              <label>
                What work should AI improve first?
                <textarea name="priority" rows={3} required />
              </label>
              <p className="form-note">
                By submitting, you agree we may contact you on WhatsApp about your cohort.
              </p>
              <button className="button primary" type="submit" style={{ width: "100%" }}>
                Send Application
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="wordmark">AI for <span>X</span></span>
        <span>Applied AI for founders, operators, and engineers. India and the world.</span>
      </footer>
    </>
  );
}
