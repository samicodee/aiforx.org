import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  validateAdminCredentials,
} from "@/app/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      {
        message: "Enter username and password.",
      },
      { status: 400 },
    );
  }

  const { username, password } = body as {
    username?: unknown;
    password?: unknown;
  };

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !validateAdminCredentials(username, password)
  ) {
    return NextResponse.json(
      {
        message: "Invalid username or password.",
      },
      { status: 401 },
    );
  }

  const session = createAdminSession(username);
  const response = NextResponse.json({
    message: "Signed in.",
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, session.value, {
    httpOnly: true,
    maxAge: session.maxAge,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    message: "Signed out.",
  });

  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
