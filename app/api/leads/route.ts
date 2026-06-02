import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/app/lib/admin-auth";
import {
  isLikelySpam,
  readLeads,
  saveLead,
  updateLead,
  validateLeadInput,
} from "@/app/lib/leads";
import { sendLeadNotification } from "@/app/lib/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasAdminAccess(request: NextRequest) {
  const token = process.env.LEADS_ADMIN_TOKEN;

  if (!token) {
    return hasAdminSession(request);
  }

  return (
    request.headers.get("authorization") === `Bearer ${token}` ||
    hasAdminSession(request)
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "Submit valid JSON.",
      },
      { status: 400 },
    );
  }

  const result = validateLeadInput(body);

  if (!result.ok) {
    return NextResponse.json(
      {
        message: "Check the application fields.",
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  if (isLikelySpam(result.data)) {
    return NextResponse.json({
      message: "Application received.",
    });
  }

  let lead;

  try {
    lead = await saveLead(result.data);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Could not save application. Please try again later.",
      },
      { status: 500 },
    );
  }

  try {
    await sendLeadNotification(result.data);
  } catch (error) {
    console.error(error);
  }

  return NextResponse.json(
    {
      id: lead.id,
      message: "Application received. We will review it before the next step.",
    },
    { status: 201 },
  );
}

export async function GET(request: NextRequest) {
  if (!hasAdminAccess(request)) {
    return NextResponse.json(
      {
        message: "Sign in to load leads.",
      },
      { status: 401 },
    );
  }

  let leads;

  try {
    leads = await readLeads();
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Could not read leads.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    count: leads.length,
    leads,
  });
}

export async function PATCH(request: NextRequest) {
  if (!hasAdminAccess(request)) {
    return NextResponse.json(
      {
        message: "Sign in to update leads.",
      },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "Submit valid JSON.",
      },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      {
        message: "Submit lead update fields.",
      },
      { status: 400 },
    );
  }

  const { id, ...updates } = body as {
    id?: string;
    status?: unknown;
    notes?: unknown;
    last_contacted_at?: unknown;
  };

  try {
    const lead = await updateLead(id ?? "", updates);

    return NextResponse.json({
      lead,
      message: "Lead updated.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not update lead.",
      },
      { status: 400 },
    );
  }
}
