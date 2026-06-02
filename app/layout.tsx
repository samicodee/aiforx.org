import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { WhatsAppFloat } from "@/app/components/WhatsAppFloat";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AIforX | AI for Real Work",
    template: "%s | AIforX",
  },
  description:
    "Applied AI education for founders, operators, doctors, engineers, and business teams who want practical AI workflows for real work.",
  metadataBase: new URL("https://www.aiforx.org"),
  openGraph: {
    title: "AIforX | AI for Real Work",
    description:
      "Applied AI education for real business workflows across founders, operators, doctors, engineers, and teams.",
    url: "https://www.aiforx.org",
    siteName: "AIforX",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <WhatsAppFloat />
        <Analytics />
      </body>
    </html>
  );
}
