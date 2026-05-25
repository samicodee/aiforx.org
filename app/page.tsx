import { Header } from "@/app/components/Header";
import { Hero } from "@/app/components/Hero";
import { programs } from "@/app/data/programs";

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />

        <section id="programs" className="program-section">
          <div className="program-inner">
            <div className="program-heading">
              <p className="system-label">Select the AIforX track for your work</p>
              <h2>Different roles need different AI systems.</h2>
            </div>
            <div className="program-grid">
              {programs.map((program) => (
                <a
                  className={`program-card ${
                    program.slug === "operators" ? "is-featured" : ""
                  }`}
                  href={`/programs/${program.slug}/`}
                  key={program.slug}
                >
                  <span>{program.order}</span>
                  <h3>{program.title}</h3>
                  <p>{program.description}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="why" className="section intro-section">
          <div className="section-heading">
            <p className="kicker">Operational intelligence, not more tool lists</p>
            <h2>
              Most businesses do not need another AI demo. They need better
              operating systems.
            </h2>
          </div>
          <div className="intro-copy">
            <p>
              AIFORX teaches non-technical business leaders how to convert daily
              work into reusable AI-assisted workflows. The focus is not coding,
              theory, or AI hype. It is execution.
            </p>
            <blockquote>
              Not taught by an AI teacher. Led by an operator who has built and
              run real businesses.
            </blockquote>
          </div>
        </section>

        <section className="section leader-section">
          <div className="leader-panel">
            <div>
              <p className="kicker">Built for two kinds of business leaders</p>
              <h2>Founders who build. Operators who run.</h2>
            </div>
            <div className="leader-grid">
              <article>
                <span>01</span>
                <h3>AI for Founders</h3>
                <p>
                  For business owners and growth-focused leaders who need more
                  leverage without adding complexity.
                </p>
              </article>
              <article>
                <span>02</span>
                <h3>AI for Operators</h3>
                <p>
                  For people responsible for ops, sales, hiring, reporting,
                  delegation, and day-to-day execution.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section id="workflows" className="section workflow-section">
          <div className="section-heading wide">
            <p className="kicker">What you build</p>
            <h2>Three working AI workflows your business can actually use.</h2>
            <p>
              Each workflow is built around practical business output, then
              converted into prompts, docs, sheets, checklists, and review steps.
            </p>
          </div>
          <div className="workflow-grid">
            <article>
              <span className="number">01</span>
              <h3>Operations</h3>
              <p>
                SOPs, daily reporting, vendor/client issue handling, MIS
                summaries, and owner-level reviews.
              </p>
            </article>
            <article>
              <span className="number">02</span>
              <h3>Sales</h3>
              <p>
                Lead qualification, follow-ups, proposals, objections, and
                CRM-style tracking in Google Sheets.
              </p>
            </article>
            <article>
              <span className="number">03</span>
              <h3>Hiring & Team</h3>
              <p>
                JD drafting, candidate screening, interview scorecards,
                onboarding, and delegation systems.
              </p>
            </article>
          </div>
        </section>

        <section className="tools-band">
          <div className="tools-inner">
            <div>
              <p className="kicker">Simple tool stack</p>
              <h2>No coding. No complex setup.</h2>
              <p>
                We use tools operators can understand quickly: ChatGPT, Claude,
                Gemini, Google Sheets, Docs, and Forms.
              </p>
            </div>
            <div className="tool-list" aria-label="Tools used">
              <span>ChatGPT</span>
              <span>Claude</span>
              <span>Gemini</span>
              <span>Sheets</span>
              <span>Docs</span>
              <span>Forms</span>
            </div>
          </div>
        </section>

        <section id="cohort" className="section cohort-section">
          <div className="cohort-copy">
            <p className="kicker">Program formats</p>
            <h2>Each track can run as a workshop, cohort, or team program.</h2>
            <p>
              Pricing, dates, and support change by track. Select the page for
              your role to see the current offer when that program is live.
            </p>
          </div>
          <div className="cohort-grid">
            <article>
              <h3>2-Day Intensives</h3>
              <p>In-person practical workshops for focused implementation.</p>
            </article>
            <article>
              <h3>Role-Based Cohorts</h3>
              <p>
                Separate tracks for founders, operators, doctors, engineers, and
                teams.
              </p>
            </article>
            <article>
              <h3>Team Programs</h3>
              <p>
                Custom workshops for corporate and SME teams that need practical
                AI adoption.
              </p>
            </article>
            <article>
              <h3>Implementation Support</h3>
              <p>
                Follow-up support depends on the selected program and cohort
                format.
              </p>
            </article>
          </div>
        </section>

        <section className="section sami-section">
          <div className="sami-card">
            <div>
              <p className="kicker">Led by Sami</p>
              <h2>Founder. Operator. Builder.</h2>
            </div>
            <div>
              <p>
                Sami is a Hyderabad-based founder and operator with 10 years
                across operations, logistics, hospitality, sales, and business
                building.
              </p>
              <p>
                Built Country Chicken Co., India&apos;s first naturally raised
                chicken brand.
              </p>
            </div>
          </div>
        </section>

        <section className="section faq-section">
          <div className="section-heading">
            <p className="kicker">Clear expectations</p>
            <h2>What this is, and what it is not.</h2>
          </div>
          <div className="faq-grid">
            <article>
              <h3>Is this technical?</h3>
              <p>
                No. It is built for non-technical founders and operators using
                AI tools, Docs, Sheets, and Forms.
              </p>
            </article>
            <article>
              <h3>Will I get a deployed app?</h3>
              <p>
                No. The promise is working operating workflows, not custom
                software or hosted apps.
              </p>
            </article>
            <article>
              <h3>I already use ChatGPT. Is this useful?</h3>
              <p>
                Yes, if your use is still ad hoc. This workshop turns AI into
                repeatable business workflows.
              </p>
            </article>
            <article>
              <h3>Why application-led?</h3>
              <p>
                The room is for operators with real business pain, decision
                authority, and implementation intent.
              </p>
            </article>
          </div>
        </section>

        <section id="apply" className="apply-section">
          <div className="apply-inner">
            <div className="apply-copy">
              <p className="kicker">Program application</p>
              <h2>Apply for AIforX.</h2>
              <p>
                If there is fit, the next step is an application call. Your seat
                is confirmed only after acceptance and payment for the selected
                program.
              </p>
            </div>
            <form
              className="application-form"
              action="mailto:hi@aiforx.org"
              method="post"
              encType="text/plain"
            >
              <label>
                Name
                <input name="name" type="text" autoComplete="name" required />
              </label>
              <label>
                Phone / WhatsApp
                <input name="phone" type="tel" autoComplete="tel" required />
              </label>
              <label>
                Program interest
                <select name="program" required defaultValue="">
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
                <textarea name="operating_problem" rows={4} required />
              </label>
              <button className="button primary" type="submit">
                Send Application
              </button>
              <p className="form-note">
                Application call required. Payment details depend on the selected
                program.
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span className="wordmark">
          AIfor<span>X</span>
        </span>
        <span>
          AI for real work. Operational intelligence for real businesses.
        </span>
      </footer>
    </>
  );
}
