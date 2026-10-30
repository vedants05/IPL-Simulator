import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { NextRequest } from "next/server";
import { createEditorSession, EDITOR_COOKIE, EDITOR_STATE_COOKIE, editorIsConfigured, readEditorSession, verifyEditorPassword } from "../lib/server/editorAccess";
import { GET, POST, DELETE, PATCH } from "../app/api/editor-access/route";
import { enableEditor, hasEditorAccess, lockEditor, refreshEditorAccess, unlockEditor } from "../lib/store/editorAccessStore";

async function verifyClientAccess() {
  const originalFetch = globalThis.fetch;
  try {
    assert.equal(hasEditorAccess(), false);
    const granted = { configured: true, granted: true, enabled: true };
    const locked = { configured: true, granted: true, enabled: false };
    globalThis.fetch = async () => Response.json(granted);
    assert.equal(await refreshEditorAccess(), true);
    assert.equal(hasEditorAccess(), true);

    // A status response started before disabling must never reopen access.
    let releaseStatus!: (response: Response) => void;
    globalThis.fetch = async (_url, options) => options?.method === "DELETE"
      ? Response.json(locked)
      : new Promise<Response>((resolve) => { releaseStatus = resolve; });
    const staleStatus = refreshEditorAccess();
    await lockEditor();
    assert.equal(hasEditorAccess(), false);
    releaseStatus(Response.json(granted));
    assert.equal(await staleStatus, false);
    assert.equal(hasEditorAccess(), false);

    globalThis.fetch = async () => Response.json(granted);
    await unlockEditor("test-only input");
    assert.equal(hasEditorAccess(), true);
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.method, "PATCH");
      assert.equal(options?.body, undefined);
      return Response.json(granted);
    };
    await enableEditor();
    assert.equal(hasEditorAccess(), true);
    globalThis.fetch = async () => Response.json({ configured: true, granted: false, enabled: true });
    assert.equal(await refreshEditorAccess(), false);
    globalThis.fetch = async () => { throw new Error("Offline"); };
    assert.equal(await refreshEditorAccess(), false);
    assert.equal(hasEditorAccess(), false);
  } finally { globalThis.fetch = originalFetch; }
}

async function main() {
  const originalHash = process.env.EDITOR_PASSWORD_HASH;
  const originalSecret = process.env.EDITOR_SESSION_SECRET;
  try {
    delete process.env.EDITOR_PASSWORD_HASH;
    delete process.env.EDITOR_SESSION_SECRET;
    assert.equal(editorIsConfigured(), false);
    assert.equal(await verifyEditorPassword("test-only password"), false);
    assert.equal(readEditorSession("anything"), null);

    const password = randomBytes(24).toString("hex");
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
    process.env.EDITOR_PASSWORD_HASH = `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
    process.env.EDITOR_SESSION_SECRET = randomBytes(32).toString("hex");
    assert.equal(editorIsConfigured(), true);
    assert.equal(await verifyEditorPassword(password), true);
    assert.equal(await verifyEditorPassword("wrong password"), false);

    const session = createEditorSession();
    assert.deepEqual(readEditorSession(session.token), { enabled: true });
    assert.deepEqual(readEditorSession(createEditorSession(false).token), { enabled: false });
    assert.equal(readEditorSession(`${session.token}extra`), null);
    const pieces = session.token.split(".");
    pieces[1] = "off";
    assert.equal(readEditorSession(pieces.join(".")), null);
    pieces[1] = "on";
    pieces[3] = "0".repeat(64);
    assert.equal(readEditorSession(pieces.join(".")), null);
    process.env.EDITOR_SESSION_SECRET = randomBytes(32).toString("hex");
    assert.equal(readEditorSession(session.token), null);

    const url = "http://localhost:3000/api/editor-access";
    const request = (method: string, origin = "http://localhost:3000", candidate = password) => new NextRequest(url, {
      method, headers: { origin, "content-type": "application/json" },
      ...(method === "POST" ? { body: JSON.stringify({ password: candidate }) } : {}),
    });
    const initial = await GET(new NextRequest(url));
    assert.equal((await initial.json()).enabled, false);
    assert.equal(initial.headers.get("cache-control"), "no-store");
    assert.equal((await POST(request("POST", "https://attacker.example"))).status, 403);
    assert.equal((await DELETE(request("DELETE", "https://attacker.example"))).status, 403);
    assert.equal((await PATCH(request("PATCH", "https://attacker.example"))).status, 403);
    assert.equal((await PATCH(request("PATCH"))).status, 401);
    assert.equal((await POST(request("POST", "http://localhost:3000", "wrong"))).status, 401);
    const unlocked = await POST(request("POST"));
    assert.equal(unlocked.status, 200);
    const body = await unlocked.json();
    assert.equal(body.enabled, true);
    assert.equal(body.granted, true);
    assert.equal("token" in body, false);
    assert.equal("password" in body, false);
    const cookie = unlocked.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=strict/i);
    const checked = await GET(new NextRequest(url, { headers: { cookie: cookie.split(";")[0] } }));
    assert.equal((await checked.json()).enabled, true);
    const authenticated = (method: string, cookieHeader: string) => new NextRequest(url, {
      method, headers: { origin: "http://localhost:3000", cookie: cookieHeader.split(";")[0] },
    });
    const disabled = await DELETE(authenticated("DELETE", cookie));
    assert.deepEqual(await disabled.json(), { configured: true, granted: true, enabled: false });
    const disabledCookie = disabled.headers.get("set-cookie")!;
    assert.doesNotMatch(disabledCookie, /Max-Age=0/i);
    // Refresh/reopen while off remembers the unlock but keeps editing disabled.
    const reopened = await GET(authenticated("GET", disabledCookie));
    assert.deepEqual(await reopened.json(), { configured: true, granted: true, enabled: false });
    assert.ok(reopened.headers.get("set-cookie"));
    // An in-flight GET can renew an older grant cookie after disabling; the
    // separate off preference must keep the editor disabled in that case.
    const concurrentStatus = await GET(new NextRequest(url, { headers: {
      cookie: `${cookie.split(";")[0]}; ${EDITOR_STATE_COOKIE}=off`,
    } }));
    assert.deepEqual(await concurrentStatus.json(), { configured: true, granted: true, enabled: false });
    const reenabled = await PATCH(authenticated("PATCH", disabledCookie));
    assert.deepEqual(await reenabled.json(), { configured: true, granted: true, enabled: true });
    assert.equal(readEditorSession(undefined), null);
    const token = unlocked.cookies.get(EDITOR_COOKIE)?.value;
    const originalTestHash = process.env.EDITOR_PASSWORD_HASH;
    process.env.EDITOR_PASSWORD_HASH = originalTestHash.slice(0, -1) + (originalTestHash.endsWith("f") ? "e" : "f");
    assert.equal(readEditorSession(token), null);
    delete process.env.EDITOR_PASSWORD_HASH;
    assert.equal(readEditorSession(token), null);

    process.env.EDITOR_PASSWORD_HASH = originalTestHash;
    await POST(request("POST", "http://localhost:3000", "wrong"));
    await POST(request("POST", "http://localhost:3000", "wrong"));
    await POST(request("POST", "http://localhost:3000", "wrong"));
    assert.equal((await POST(request("POST"))).status, 429);
    await verifyClientAccess();
    console.log("Editor access checks passed: one-time unlock, persistent off state, password-free re-enabling, cookies, tampering, rotation, origins, lock races and rate limit.");
  } finally {
    if (originalHash === undefined) delete process.env.EDITOR_PASSWORD_HASH;
    else process.env.EDITOR_PASSWORD_HASH = originalHash;
    if (originalSecret === undefined) delete process.env.EDITOR_SESSION_SECRET;
    else process.env.EDITOR_SESSION_SECRET = originalSecret;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
