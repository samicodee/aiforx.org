import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/app/components/Header";
import { ThankYouClient } from "./ThankYouClient";

export const metadata: Metadata = {
  title: "Application Received",
  description:
    "Thank you for applying. The team will review your cohort interest and follow up.",
  alternates: {
    canonical: "/thank-you/",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; company?: string; cohort?: string; priority?: string; status?: string }>;
}) {
  const params = await searchParams;
  const name = params.name || "";
  const company = params.company || "";
  const cohort = params.cohort || "founders";
  const priority = params.priority || "";

  return (
    <>
      <Header />
      <main className="thank-you-page">
        <Suspense fallback={<section className="thank-you-panel"><p>Loading…</p></section>}>
          <ThankYouClient
            name={name}
            company={company}
            cohort={cohort}
            priority={priority}
          />
        </Suspense>
      </main>
    </>
  );
}
