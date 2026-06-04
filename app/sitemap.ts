import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://www.aiforsaudi.org/",
      lastModified: new Date("2026-05-31"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://www.aiforsaudi.org/thank-you/",
      lastModified: new Date("2026-06-01"),
      changeFrequency: "yearly",
      priority: 0.1,
    },
  ];
}
