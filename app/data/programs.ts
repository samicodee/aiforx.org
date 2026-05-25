export type Program = {
  slug: string;
  order: string;
  title: string;
  shortTitle: string;
  description: string;
  image: string;
  audience: string;
  outcomes: string[];
};

export const programs: Program[] = [
  {
    slug: "founders",
    order: "01",
    title: "AI for Founders",
    shortTitle: "Founders",
    description:
      "For business owners and growth-focused leaders building with more leverage.",
    image:
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=2200&q=84",
    audience: "Founders, business owners, and growth-focused leaders.",
    outcomes: [
      "Founder decision workflows",
      "Sales and proposal leverage",
      "Team delegation systems",
    ],
  },
  {
    slug: "operators",
    order: "02",
    title: "AI for Operators",
    shortTitle: "Operators",
    description:
      "For people running ops, sales, hiring, reporting, and daily execution.",
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2200&q=84",
    audience: "Operators, managers, CXOs, and owner-led execution teams.",
    outcomes: [
      "Operations command workflows",
      "Sales follow-up systems",
      "Hiring and team workflows",
    ],
  },
  {
    slug: "doctors",
    order: "03",
    title: "AI for Doctors",
    shortTitle: "Doctors",
    description:
      "For doctors and clinic teams improving admin, communication, and patient workflows.",
    image:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=2200&q=84",
    audience: "Doctors, clinic owners, healthcare operators, and admin teams.",
    outcomes: [
      "Clinic admin workflows",
      "Patient communication templates",
      "Team and documentation systems",
    ],
  },
  {
    slug: "engineers",
    order: "04",
    title: "AI for Engineers",
    shortTitle: "Engineers",
    description:
      "For non-tech civil, mechanical, and electrical engineers using AI in work.",
    image:
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=2200&q=84",
    audience: "Civil, mechanical, electrical, and project engineers.",
    outcomes: [
      "Project documentation workflows",
      "Site/reporting support systems",
      "Technical communication templates",
    ],
  },
  {
    slug: "businesses",
    order: "05",
    title: "AI for Businesses",
    shortTitle: "Businesses",
    description:
      "For corporate and SME teams that need practical AI adoption across functions.",
    image:
      "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=2200&q=84",
    audience: "Corporate teams, SME teams, and department leaders.",
    outcomes: [
      "Team AI adoption workflows",
      "Department-specific playbooks",
      "Manager review systems",
    ],
  },
];

export const heroSequence = [
  ...programs.map((program) => ({
    text: program.shortTitle,
    image: program.image,
  })),
  {
    text: "Teams",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=2200&q=84",
  },
  {
    text: "Real Work",
    image:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=2200&q=84",
  },
];

export function getProgram(slug: string) {
  return programs.find((program) => program.slug === slug);
}
