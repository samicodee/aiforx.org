"use client";

import { useMemo, useRef, useState } from "react";
import { leadStatuses, type LeadStatus } from "@/app/lib/lead-statuses";

type Lead = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  business: string;
  program: string;
  source_domain: string;
  storage_table: string;
  role: string;
  business_stage: string;
  problem_statement: string;
  status: LeadStatus;
  notes: string;
  last_contacted_at: string | null;
};

type LeadResponse = {
  count: number;
  leads: Lead[];
  message?: string;
};

type SortMode = "newest" | "oldest" | "not-contacted" | "recent-contact";
type ContactFilter = "all" | "uncontacted" | "contacted";
type MobilePane = "list" | "detail";

const statusLabels: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  accepted: "Accepted",
  rejected: "Rejected",
};

const sourceLabels: Record<string, string> = {
  "aiforx.org": "AIforX",
  "aiforfounders.org": "Founders",
  "aiforoperators.org": "Operators",
  "aiforengineers.org": "Engineers",
  "aiforsaudi.org": "Saudi",
};

const programLabels: Record<string, string> = {
  businesses: "Businesses",
  doctors: "Doctors",
  engineers: "Engineers",
  founders: "Founders",
  operators: "Operators",
};

type ProgramInfo = {
  slug: string;
  title: string;
  description: string;
  outcomes: string[];
};

const programs: ProgramInfo[] = [
  {
    slug: "founders",
    title: "AI for Founders",
    description:
      "For business owners and growth-focused leaders building with more leverage.",
    outcomes: [
      "Founder decision workflows",
      "Sales and proposal leverage",
      "Team delegation systems",
    ],
  },
  {
    slug: "operators",
    title: "AI for Operators",
    description:
      "For people running ops, sales, hiring, reporting, and daily execution.",
    outcomes: [
      "Operations command workflows",
      "Sales follow-up systems",
      "Hiring and team workflows",
    ],
  },
  {
    slug: "doctors",
    title: "AI for Doctors",
    description:
      "For doctors and clinic teams improving admin, communication, and patient workflows.",
    outcomes: [
      "Clinic admin workflows",
      "Patient communication templates",
      "Team and documentation systems",
    ],
  },
  {
    slug: "engineers",
    title: "AI for Engineers",
    description:
      "For non-tech civil, mechanical, and electrical engineers using AI in work.",
    outcomes: [
      "Project documentation workflows",
      "Site/reporting support systems",
      "Technical communication templates",
    ],
  },
  {
    slug: "businesses",
    title: "AI for Businesses",
    description:
      "For corporate and SME teams that need practical AI adoption across functions.",
    outcomes: [
      "Team AI adoption workflows",
      "Department-specific playbooks",
      "Manager review systems",
    ],
  },
];

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function normalizeWhatsappPhone(value: string) {
  const phone = normalizePhone(value);
  if (phone.startsWith("+")) return phone.slice(1);
  if (phone.startsWith("00")) return phone.slice(2);
  if (phone.length === 10) return `91${phone}`;
  if (phone.length === 11 && phone.startsWith("0")) return `91${phone.slice(1)}`;
  return phone;
}

function getWhatsappUrl(lead: Lead) {
  const phone = normalizeWhatsappPhone(lead.phone);
  const text = encodeURIComponent(
    `Hi ${lead.name}, this is Sami from AIforX. I saw your ${sourceLabels[lead.source_domain] ?? lead.source_domain} application and wanted to follow up.`,
  );
  return `https://wa.me/${phone}?text=${text}`;
}

function getProgramWhatsappUrl(lead: Lead, program: ProgramInfo) {
  const phone = normalizeWhatsappPhone(lead.phone);
  const outcomesText = program.outcomes.map((o) => `• ${o}`).join("\n");
  const message =
    `Hi ${lead.name}, here are the details for *${program.title}*:\n\n` +
    `${program.description}\n\n` +
    `*What you'll get:*\n${outcomesText}\n\n` +
    `Learn more: https://www.aiforx.org/${program.slug}\n\n` +
    `Would love to connect and walk you through this. When works for a quick call?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function csvCell(value: string | null | undefined) {
  const text = value ?? "";
  return `"${text.replaceAll('"', '""')}"`;
}

function buildCsv(leads: Lead[]) {
  const headers = [
    "created_at", "source", "program", "status", "name", "phone",
    "email", "business", "role", "stage", "problem", "notes", "last_contacted_at",
  ];
  const rows = leads.map((lead) => [
    lead.createdAt, lead.source_domain, lead.program, lead.status,
    lead.name, lead.phone, lead.email, lead.business, lead.role,
    lead.business_stage, lead.problem_statement, lead.notes, lead.last_contacted_at ?? "",
  ]);
  return [headers, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(","))
    .join("\n");
}

function downloadCsv(leads: Lead[]) {
  const blob = new Blob([buildCsv(leads)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `aiforx-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getLeadAgeDays(lead: Lead) {
  const created = new Date(lead.createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / 86_400_000));
}

async function parseJsonResponse<T extends { message?: string }>(
  response: Response,
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return {
    message: `Request failed with ${response.status}. Refresh and try again.`,
  } as T;
}

function SendProgramButton({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const suggested = programs.find((p) => p.slug === lead.program) ?? programs[0];

  return (
    <div className="send-program-wrap" ref={ref}>
      <button
        className="lead-action-send"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Send Details ▾
      </button>
      {open && (
        <div className="send-program-dropdown">
          <p className="send-program-hint">Send program info via WhatsApp</p>
          {programs.map((program) => (
            <a
              key={program.slug}
              href={getProgramWhatsappUrl(lead, program)}
              target="_blank"
              rel="noreferrer"
              className={`send-program-option${program.slug === suggested.slug ? " is-suggested" : ""}`}
              onClick={() => setOpen(false)}
            >
              <span>{program.title}</span>
              {program.slug === suggested.slug && (
                <small>matches their program</small>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminLeads() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeStatus, setActiveStatus] = useState<LeadStatus | "all">("all");
  const [activeSource, setActiveSource] = useState("all");
  const [activeProgram, setActiveProgram] = useState("all");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");

  const sources = useMemo(
    () => Array.from(new Set(leads.map((l) => l.source_domain))).sort(),
    [leads],
  );

  const programOptions = useMemo(
    () => Array.from(new Set(leads.map((l) => l.program))).sort(),
    [leads],
  );

  const counts = useMemo(
    () =>
      leadStatuses.reduce(
        (acc, status) => ({
          ...acc,
          [status]: leads.filter((l) => l.status === status).length,
        }),
        {} as Record<LeadStatus, number>,
      ),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const statusMatches = activeStatus === "all" || lead.status === activeStatus;
        const sourceMatches = activeSource === "all" || lead.source_domain === activeSource;
        const programMatches = activeProgram === "all" || lead.program === activeProgram;
        const contactMatches =
          contactFilter === "all" ||
          (contactFilter === "contacted"
            ? Boolean(lead.last_contacted_at)
            : !lead.last_contacted_at);
        const queryMatches =
          !normalizedQuery ||
          [
            lead.name, lead.phone, lead.email, lead.business, lead.role,
            lead.program, lead.source_domain, lead.business_stage,
            lead.problem_statement, lead.notes,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        return statusMatches && sourceMatches && programMatches && contactMatches && queryMatches;
      })
      .sort((a, b) => {
        if (sortMode === "oldest")
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortMode === "not-contacted")
          return Number(Boolean(a.last_contacted_at)) - Number(Boolean(b.last_contacted_at));
        if (sortMode === "recent-contact")
          return (
            new Date(b.last_contacted_at ?? 0).getTime() -
            new Date(a.last_contacted_at ?? 0).getTime()
          );
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [activeProgram, activeSource, activeStatus, contactFilter, leads, query, sortMode]);

  const selectedLead = useMemo(
    () => filteredLeads.find((l) => l.id === selectedLeadId) ?? filteredLeads[0],
    [filteredLeads, selectedLeadId],
  );

  const dashboardStats = useMemo(() => {
    const uncontacted = leads.filter((l) => !l.last_contacted_at).length;
    const qualified = leads.filter((l) =>
      ["qualified", "accepted"].includes(l.status),
    ).length;
    return {
      total: leads.length,
      new: counts.new,
      uncontacted,
      qualified,
      latest: leads[0] ? formatShortDate(leads[0].createdAt) : "-",
    };
  }, [counts.new, leads]);

  async function loadLeads() {
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/leads/");
      const result = await parseJsonResponse<LeadResponse>(response);
      if (!response.ok) throw new Error(result.message ?? "Could not load leads.");
      setLeads(result.leads);
      setSelectedLeadId((current) => current ?? result.leads[0]?.id ?? null);
      setMessage(`Loaded ${result.count} lead${result.count === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load leads.");
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/session/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await parseJsonResponse<{ message?: string }>(response);
      if (!response.ok) throw new Error(result.message ?? "Could not sign in.");
      setIsSignedIn(true);
      setPassword("");
      await loadLeads();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/admin/session/", { method: "DELETE" });
    setIsSignedIn(false);
    setLeads([]);
    setSelectedLeadId(null);
    setMessage("Signed out.");
  }

  async function updateLead(
    leadId: string,
    updates: Partial<Pick<Lead, "status" | "notes" | "last_contacted_at">>,
  ) {
    setSavingLeadId(leadId);
    setMessage("");
    try {
      const response = await fetch("/api/leads/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, ...updates }),
      });
      const result = await parseJsonResponse<{ lead?: Lead; message?: string }>(response);
      if (!response.ok || !result.lead) throw new Error(result.message ?? "Could not update lead.");
      setLeads((current) =>
        current.map((l) => (l.id === result.lead?.id ? result.lead : l)),
      );
      setMessage(result.message ?? "Lead updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update lead.");
    } finally {
      setSavingLeadId(null);
    }
  }

  function clearFilters() {
    setActiveStatus("all");
    setActiveSource("all");
    setActiveProgram("all");
    setContactFilter("all");
    setQuery("");
    setSortMode("newest");
  }

  function selectLead(id: string) {
    setSelectedLeadId(id);
    setMobilePane("detail");
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div className="admin-heading">
          <div>
            <p className="kicker">AIforX command center</p>
            <h1>Lead Dashboard</h1>
            <p>One operating view for AIforX, Founders, Engineers, and Saudi applications.</p>
          </div>
          {isSignedIn ? (
            <div className="admin-auth signed-in">
              <button className="button primary" onClick={loadLeads} type="button">
                {isLoading ? "Loading..." : "Refresh"}
              </button>
              <button
                className="admin-small-button"
                onClick={() => downloadCsv(filteredLeads)}
                type="button"
                disabled={filteredLeads.length === 0}
              >
                Export CSV
              </button>
              <button className="admin-small-button" onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          ) : (
            <form className="admin-auth" onSubmit={signIn}>
              <input
                aria-label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                type="text"
                autoComplete="username"
              />
              <input
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                autoComplete="current-password"
              />
              <button className="button primary" type="submit">
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          )}
        </div>

        {message ? <p className="admin-message">{message}</p> : null}

        {!isSignedIn ? (
          <div className="admin-login-panel">
            <div>
              <p className="kicker">Private dashboard</p>
              <h2>Sign in to manage leads.</h2>
              <p>
                Leads and counts stay hidden until you authenticate with the
                configured admin username and password.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="admin-stat-grid">
              <article>
                <span>Total leads</span>
                <strong>{dashboardStats.total}</strong>
                <small>Across all sources</small>
              </article>
              <article>
                <span>New</span>
                <strong>{dashboardStats.new}</strong>
                <small>Need first review</small>
              </article>
              <article>
                <span>Uncontacted</span>
                <strong>{dashboardStats.uncontacted}</strong>
                <small>Call or WhatsApp next</small>
              </article>
              <article>
                <span>Qualified / Accepted</span>
                <strong>{dashboardStats.qualified}</strong>
                <small>High-intent pipeline</small>
              </article>
              <article>
                <span>Latest lead</span>
                <strong>{dashboardStats.latest}</strong>
                <small>Most recent application</small>
              </article>
            </div>

            <div className="admin-control-panel">
              <label className="admin-search">
                Search
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, phone, email, company, problem..."
                  type="search"
                />
              </label>
              <label>
                Source
                <select value={activeSource} onChange={(e) => setActiveSource(e.target.value)}>
                  <option value="all">All sources</option>
                  {sources.map((s) => (
                    <option key={s} value={s}>{sourceLabels[s] ?? s}</option>
                  ))}
                </select>
              </label>
              <label>
                Program
                <select value={activeProgram} onChange={(e) => setActiveProgram(e.target.value)}>
                  <option value="all">All programs</option>
                  {programOptions.map((p) => (
                    <option key={p} value={p}>{programLabels[p] ?? p}</option>
                  ))}
                </select>
              </label>
              <label>
                Contact
                <select
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.target.value as ContactFilter)}
                >
                  <option value="all">All contact states</option>
                  <option value="uncontacted">Not contacted</option>
                  <option value="contacted">Contacted</option>
                </select>
              </label>
              <label>
                Sort
                <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="not-contacted">Uncontacted first</option>
                  <option value="recent-contact">Recently contacted</option>
                </select>
              </label>
              <button className="admin-small-button" onClick={clearFilters} type="button">
                Clear filters
              </button>
            </div>

            <div className="admin-status-bar">
              <button
                className={activeStatus === "all" ? "is-active" : ""}
                onClick={() => setActiveStatus("all")}
                type="button"
              >
                All <span>{leads.length}</span>
              </button>
              {leadStatuses.map((status) => (
                <button
                  key={status}
                  className={activeStatus === status ? "is-active" : ""}
                  onClick={() => setActiveStatus(status)}
                  type="button"
                >
                  {statusLabels[status]} <span>{counts[status]}</span>
                </button>
              ))}
            </div>

            {/* Mobile pane toggle */}
            <div className="admin-mobile-tabs">
              <button
                className={mobilePane === "list" ? "is-active" : ""}
                onClick={() => setMobilePane("list")}
                type="button"
              >
                Leads ({filteredLeads.length})
              </button>
              <button
                className={mobilePane === "detail" ? "is-active" : ""}
                onClick={() => setMobilePane("detail")}
                type="button"
                disabled={!selectedLead}
              >
                {selectedLead ? selectedLead.name : "Select a lead"}
              </button>
            </div>

            <div className={`admin-workspace mobile-pane-${mobilePane}`}>
              <div className="lead-list-panel">
                <div className="lead-list-heading">
                  <strong>{filteredLeads.length} visible leads</strong>
                  <span>{leads.length} total</span>
                </div>
                <div className="lead-list">
                  {filteredLeads.map((lead) => (
                    <button
                      className={selectedLead?.id === lead.id ? "is-active" : ""}
                      key={lead.id}
                      onClick={() => selectLead(lead.id)}
                      type="button"
                    >
                      <span className={`lead-status-dot status-${lead.status}`} />
                      <span>
                        <strong>{lead.name}</strong>
                        <small>
                          {sourceLabels[lead.source_domain] ?? lead.source_domain} ·{" "}
                          {programLabels[lead.program] ?? lead.program}
                        </small>
                        <em>{lead.business}</em>
                      </span>
                      <time>{formatShortDate(lead.createdAt)}</time>
                    </button>
                  ))}
                  {filteredLeads.length === 0 ? (
                    <div className="admin-empty-state">
                      <strong>No leads match these filters.</strong>
                      <p>Clear filters or refresh after new submissions arrive.</p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="lead-detail-panel">
                {selectedLead ? (
                  <>
                    <button
                      className="lead-back-button"
                      onClick={() => setMobilePane("list")}
                      type="button"
                    >
                      ← All leads
                    </button>

                    <div className="lead-detail-top">
                      <div>
                        <p className="kicker">
                          {sourceLabels[selectedLead.source_domain] ?? selectedLead.source_domain}
                        </p>
                        <h2>{selectedLead.name}</h2>
                        <p>{selectedLead.business} · {selectedLead.role}</p>
                      </div>
                      <span className={`lead-status-pill status-${selectedLead.status}`}>
                        {statusLabels[selectedLead.status]}
                      </span>
                    </div>

                    <div className="lead-action-row">
                      <a href={`tel:${normalizePhone(selectedLead.phone)}`}>Call</a>
                      <a href={getWhatsappUrl(selectedLead)} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                      <a href={`mailto:${selectedLead.email}`}>Email</a>
                      <SendProgramButton lead={selectedLead} />
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard?.writeText(
                            `${selectedLead.name}\n${selectedLead.phone}\n${selectedLead.email}\n${selectedLead.business}\n${selectedLead.problem_statement}`,
                          )
                        }
                      >
                        Copy
                      </button>
                    </div>

                    <div className="lead-meta-grid">
                      <article>
                        <span>Phone</span>
                        <strong>{selectedLead.phone}</strong>
                      </article>
                      <article>
                        <span>Email</span>
                        <strong>{selectedLead.email}</strong>
                      </article>
                      <article>
                        <span>Program</span>
                        <strong>
                          {programLabels[selectedLead.program] ?? selectedLead.program}
                        </strong>
                      </article>
                      <article>
                        <span>Stage / context</span>
                        <strong>{selectedLead.business_stage || "-"}</strong>
                      </article>
                      <article>
                        <span>Applied</span>
                        <strong>{formatDate(selectedLead.createdAt)}</strong>
                      </article>
                      <article>
                        <span>Last contacted</span>
                        <strong>{formatDate(selectedLead.last_contacted_at)}</strong>
                      </article>
                    </div>

                    <div className="lead-problem-card">
                      <span>What they want AI to improve</span>
                      <p>{selectedLead.problem_statement}</p>
                      <small>{getLeadAgeDays(selectedLead)} day(s) since application</small>
                    </div>

                    <div className="lead-manage-grid">
                      <label>
                        Status
                        <select
                          value={selectedLead.status}
                          onChange={(e) =>
                            updateLead(selectedLead.id, { status: e.target.value as LeadStatus })
                          }
                          disabled={savingLeadId === selectedLead.id}
                        >
                          {leadStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="button primary"
                        onClick={() =>
                          updateLead(selectedLead.id, {
                            last_contacted_at: new Date().toISOString(),
                            status:
                              selectedLead.status === "new"
                                ? "contacted"
                                : selectedLead.status,
                          })
                        }
                        type="button"
                        disabled={savingLeadId === selectedLead.id}
                      >
                        Mark Contacted Now
                      </button>
                    </div>

                    <label className="lead-notes-field">
                      Notes / next step
                      <textarea
                        key={selectedLead.id}
                        defaultValue={selectedLead.notes}
                        onBlur={(e) =>
                          updateLead(selectedLead.id, { notes: e.currentTarget.value })
                        }
                        placeholder="Call notes, fit, objections, next action, owner..."
                        rows={6}
                        disabled={savingLeadId === selectedLead.id}
                      />
                    </label>
                  </>
                ) : (
                  <div className="admin-empty-state">
                    <strong>Select a lead.</strong>
                    <p>Lead details, actions, status, and notes appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
