import { NextRequest, NextResponse } from "next/server";
import {
  createEditorSession, EDITOR_COOKIE, EDITOR_STATE_COOKIE, EDITOR_SESSION_SECONDS,
  editorIsConfigured, readEditorSession, verifyEditorPassword,
} from "@/lib/server/editorAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A process-wide limit also bounds concurrent expensive password verification.
// Multi-instance deployments should additionally rate-limit this route at the host.
const attempts = new Map<string, { count: number; resetAt: number }>();
let verifying = false;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return origin === request.nextUrl.origin
    && request.headers.get("sec-fetch-site") !== "cross-site";
}

function cookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const,
    path: "/api/editor-access" };
}

export async function GET(request: NextRequest) {
  const session = readEditorSession(request.cookies.get(EDITOR_COOKIE)?.value);
  const preference = request.cookies.get(EDITOR_STATE_COOKIE)?.value;
  const enabled = session !== null && (preference === "on" || (preference !== "off" && session.enabled));
  const response = json({ configured: editorIsConfigured(), granted: session !== null, enabled });
  if (session) {
    const renewed = createEditorSession(enabled);
    response.cookies.set(EDITOR_COOKIE, renewed.token, { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
  }
  return response;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!editorIsConfigured()) return json({ error: "Editor access has not been configured on this server." }, 503);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Invalid request." }, 400);
  const length = Number(request.headers.get("content-length"));
  if (length > 2048) return json({ error: "Invalid request." }, 413);
  // Host-wide rather than trusting a client-supplied IP address.
  const key = "editor";
  const now = Date.now();
  const entry = attempts.get(key);
  const current = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + 60_000 };
  if (verifying || current.count >= 5) return json({ error: "Too many attempts. Wait a minute and try again." }, 429);
  current.count++;
  attempts.set(key, current);
  verifying = true;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Invalid request." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    const password = body && typeof body === "object" && "password" in body ? body.password : undefined;
    if (typeof password !== "string" || !await verifyEditorPassword(password)) {
      return json({ error: "Incorrect password." }, 401);
    }
    const session = createEditorSession();
    const response = json({ configured: true, granted: true, enabled: true });
    response.cookies.set(EDITOR_COOKIE, session.token, { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
    response.cookies.set(EDITOR_STATE_COOKIE, "on", { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
    return response;
  } catch {
    return json({ error: "Could not unlock the editor. Please try again." }, 500);
  } finally {
    verifying = false;
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  const session = readEditorSession(request.cookies.get(EDITOR_COOKIE)?.value);
  const response = json({ configured: editorIsConfigured(), granted: session !== null, enabled: false });
  if (session) {
    response.cookies.set(EDITOR_COOKIE, createEditorSession(false).token, { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
    response.cookies.set(EDITOR_STATE_COOKIE, "off", { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
  }
  return response;
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return json({ error: "Request not allowed." }, 403);
  if (!readEditorSession(request.cookies.get(EDITOR_COOKIE)?.value)) {
    return json({ error: "Unlock the editor with your password first." }, 401);
  }
  const response = json({ configured: true, granted: true, enabled: true });
  response.cookies.set(EDITOR_COOKIE, createEditorSession(true).token, { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
  response.cookies.set(EDITOR_STATE_COOKIE, "on", { ...cookieOptions(), maxAge: EDITOR_SESSION_SECONDS });
  return response;
}
