import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/app/components/ApplicationForm";
import { Header } from "@/app/components/Header";
import { getProgram, programs } from "@/app/data/programs";

type ProgramPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return programs.map((program) => ({
    slug: program.slug,
  }));
}

export async function generateMetadata({
  params,
}: ProgramPageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgram(slug);

  if (!program) {
    return {};
  }

  return {
    title: program.title,
    description: `${program.title} by AIforX. Practical AI workflows for ${program.audience.toLowerCase()}`,
    alternates: {
      canonical: `/programs/${program.slug}/`,
    },
  };
}

export default async function ProgramPage({ params }: ProgramPageProps) {
  const { slug } = await params;
  const program = getProgram(slug);

  if (!program) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="program-detail">
        <section className="program-hero">
          <img src={program.image} alt="" aria-hidden="true" />
          <div className="program-hero-overlay" aria-hidden="true" />
          <div className="program-hero-inner">
            <p className="kicker">AIforX program</p>
            <h1>{program.title}</h1>
            <p>{program.description}</p>
            <a className="button primary" href="#apply">
              Apply for this track
            </a>
          </div>
        </section>

        <section className="section intro-section">
          <div className="section-heading">
            <p className="kicker">Who it is for</p>
            <h2>{program.audience}</h2>
          </div>
          <div className="intro-copy">
            <p>
              This track will become a dedicated SEO and conversion page for its
              audience. The current version preserves the route and structure so
              we can expand it into a full program landing page next.
            </p>
            <blockquote>AI for real work, built around your role.</blockquote>
          </div>
        </section>

        <section className="section workflow-section">
          <div className="section-heading wide">
            <p className="kicker">Track outcomes</p>
            <h2>Practical workflows for this audience.</h2>
          </div>
          <div className="workflow-grid">
            {program.outcomes.map((outcome, index) => (
              <article key={outcome}>
                <span className="number">{String(index + 1).padStart(2, "0")}</span>
                <h3>{outcome}</h3>
                <p>
                  Designed as a reusable AI-assisted workflow, not a one-time
                  tool demo.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="apply" className="apply-section">
          <div className="apply-inner">
            <div className="apply-copy">
              <p className="kicker">Application</p>
              <h2>Apply for {program.title}.</h2>
              <p>
                Submit interest for this track. If there is fit, the next step
                is an application call.
              </p>
            </div>
            <ApplicationForm
              defaultProgram={program.slug}
              showProgramSelect={false}
            />
          </div>
        </section>
      </main>
    </>
  );
}
