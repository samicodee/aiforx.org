export const leadStatuses = [
  "new",
  "contacted",
  "qualified",
  "accepted",
  "rejected",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];
