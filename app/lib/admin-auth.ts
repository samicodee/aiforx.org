import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "aiforx_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.LEADS_ADMIN_TOKEN || "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

export function validateAdminCredentials(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createAdminSession(username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ username, expiresAt })).toString(
    "base64url",
  );
  const signature = signPayload(payload);

  return {
    maxAge: SESSION_TTL_SECONDS,
    value: `${payload}.${signature}`,
  };
}

export function hasAdminSession(request: NextRequest) {
  const secret = getSessionSecret();
  const rawCookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (!secret || !rawCookie) {
    return false;
  }

  const [payload, signature] = rawCookie.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return false;
  }

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      expiresAt?: number;
    };

    return Boolean(session.expiresAt && session.expiresAt > Date.now() / 1000);
  } catch {
    return false;
  }
}
