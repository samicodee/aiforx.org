import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { WhatsAppFloat } from "@/app/components/WhatsAppFloat";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AIforX | Applied AI for Founders, Operators & Engineers",
    template: "%s | AIforX",
  },
  description:
    "AIforX delivers practical AI education and implementation for founders, operators, and engineers across India and the world. No coding. Real workflows. Measurable work improvement.",
  metadataBase: new URL("https://www.aiforx.org"),
  alternates: {
    canonical: "/",
  },
  keywords: [
    "AI for founders",
    "AI for operators",
    "AI for engineers",
    "AI training India",
    "AI workshops India",
    "applied AI education",
    "AI for business India",
    "AI for non-technical professionals",
    "AI implementation India",
    "Hyderabad AI training",
    "AI for real work",
    "practical AI education",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "AIforX | Applied AI for Founders, Operators & Engineers",
    description:
      "Practical AI education and implementation for founders, operators, and engineers in India and the world. Real workflows, no coding theory.",
    url: "https://www.aiforx.org",
    siteName: "AIforX",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIforX | Applied AI for Founders, Operators & Engineers",
    description:
      "Practical AI for founders, operators, and engineers. India first. Built for the world.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body>
        {children}
        <WhatsAppFloat />
        <Analytics />
      </body>
    </html>
  );
}
