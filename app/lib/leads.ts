import "server-only";
import { createClient } from "@supabase/supabase-js";
import { programs } from "@/app/data/programs";
import { leadStatuses, type LeadStatus } from "@/app/lib/lead-statuses";

const MAX_FIELD_LENGTH = 1200;

export type LeadInput = {
  name: string;
  phone: string;
  email: string;
  program: string;
  source_domain: string;
  business: string;
  role: string;
  business_stage?: string;
  problem_statement: string;
  company_website?: string;
};

export type LeadRecord = Omit<LeadInput, "company_website"> & {
  id: string;
  createdAt: string;
  status: LeadStatus;
  notes: string;
  last_contacted_at: string | null;
};

type LeadRow = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  email: string;
  program: string;
  source_domain: string;
  business: string;
  role: string;
  business_stage: string | null;
  problem_statement: string;
  status: LeadStatus;
  notes: string | null;
  last_contacted_at: string | null;
};

export type ValidationResult =
  | {
      ok: true;
      data: LeadInput;
    }
  | {
      ok: false;
      errors: Record<string, string>;
    };

const allowedPrograms = new Set(programs.map((program) => program.slug));
const requiredFields: Array<keyof LeadInput> = [
  "name",
  "phone",
  "email",
  "program",
  "source_domain",
  "business",
  "role",
  "problem_statement",
];

function cleanText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LENGTH);
}

function cleanNullableText(value: unknown) {
  const cleaned = cleanText(value);

  return cleaned || null;
}

export function validateLeadInput(input: unknown): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: {
        form: "Submit the application form with all required fields.",
      },
    };
  }

  const source = input as Record<string, unknown>;
  const data: LeadInput = {
    name: cleanText(source.name),
    phone: cleanText(source.phone),
    email: cleanText(source.email),
    program: cleanText(source.program),
    source_domain: cleanText(source.source_domain),
    business: cleanText(source.business),
    role: cleanText(source.role),
    business_stage: cleanText(source.business_stage),
    problem_statement: cleanText(source.problem_statement),
    company_website: cleanText(source.company_website),
  };

  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    if (!data[field]) {
      errors[field] = "This field is required.";
    }
  }

  if (data.program && !allowedPrograms.has(data.program)) {
    errors.program = "Select a valid program.";
  }

  if (data.source_domain && data.source_domain !== "aiforx.org") {
    errors.source_domain = "Invalid source domain.";
  }

  if (data.phone && !/^[+()\d\s-]{7,24}$/.test(data.phone)) {
    errors.phone = "Enter a valid phone or WhatsApp number.";
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Enter a valid email address.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data };
}

export function isLikelySpam(input: LeadInput) {
  return Boolean(input.company_website);
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getLeadsTable() {
  return process.env.AIFORX_LEADS_TABLE || "aiforx_leads";
}

function mapLeadRow(row: LeadRow): LeadRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    phone: row.phone,
    email: row.email,
    program: row.program,
    source_domain: row.source_domain,
    business: row.business,
    role: row.role,
    business_stage: row.business_stage ?? "",
    problem_statement: row.problem_statement,
    status: row.status,
    notes: row.notes ?? "",
    last_contacted_at: row.last_contacted_at,
  };
}

export async function saveLead(input: LeadInput): Promise<LeadRecord> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(getLeadsTable())
    .insert({
      name: input.name,
      phone: input.phone,
      email: input.email,
      program: input.program,
      source_domain: input.source_domain,
      business: input.business,
      role: input.role,
      business_stage: input.business_stage || null,
      problem_statement: input.problem_statement,
    })
    .select(
      "id, created_at, name, phone, email, program, source_domain, business, role, business_stage, problem_statement, status, notes, last_contacted_at",
    )
    .single<LeadRow>();

  if (error) {
    throw new Error(`Could not save lead: ${error.message}`);
  }

  return mapLeadRow(data);
}

export async function readLeads(): Promise<LeadRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(getLeadsTable())
    .select(
      "id, created_at, name, phone, email, program, source_domain, business, role, business_stage, problem_statement, status, notes, last_contacted_at",
    )
    .order("created_at", { ascending: false })
    .returns<LeadRow[]>();

  if (error) {
    throw new Error(`Could not read leads: ${error.message}`);
  }

  return data.map(mapLeadRow);
}

export async function updateLead(
  id: string,
  input: {
    status?: unknown;
    notes?: unknown;
    last_contacted_at?: unknown;
  },
): Promise<LeadRecord> {
  if (!id) {
    throw new Error("Missing lead id.");
  }

  const updates: {
    status?: LeadStatus;
    notes?: string | null;
    last_contacted_at?: string | null;
  } = {};

  if (input.status !== undefined) {
    const status = cleanText(input.status);

    if (!leadStatuses.includes(status as LeadStatus)) {
      throw new Error("Invalid lead status.");
    }

    updates.status = status as LeadStatus;
  }

  if (input.notes !== undefined) {
    updates.notes = cleanNullableText(input.notes);
  }

  if (input.last_contacted_at !== undefined) {
    const lastContactedAt = cleanText(input.last_contacted_at);
    updates.last_contacted_at = lastContactedAt || null;
  }

  if (Object.keys(updates).length === 0) {
    throw new Error("No lead updates provided.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(getLeadsTable())
    .update(updates)
    .eq("id", id)
    .select(
      "id, created_at, name, phone, email, program, source_domain, business, role, business_stage, problem_statement, status, notes, last_contacted_at",
    )
    .single<LeadRow>();

  if (error) {
    throw new Error(`Could not update lead: ${error.message}`);
  }

  return mapLeadRow(data);
}
