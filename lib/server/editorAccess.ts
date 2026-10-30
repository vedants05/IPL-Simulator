// Server-only: never import this module into a client component.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const EDITOR_COOKIE = "ipl-editor-access";
export const EDITOR_STATE_COOKIE = "ipl-editor-enabled";
// Browsers cap persistent cookies at 400 days; visits renew this lifetime.
export const EDITOR_SESSION_SECONDS = 400 * 24 * 60 * 60;

function configuration() {
  const hash = process.env.EDITOR_PASSWORD_HASH;
  const secret = process.env.EDITOR_SESSION_SECRET;
  if (!hash || !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash)
    || !secret || secret.length < 64) return null;
  return { hash, secret };
}

export function editorIsConfigured() {
  return configuration() !== null;
}

export async function verifyEditorPassword(password: string): Promise<boolean> {
  const config = configuration();
  if (!config || !password || password.length > 256) return false;
  const [, salt, expected] = config.hash.split(":");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(salt, "hex"), 64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key));
  });
  return timingSafeEqual(derived, Buffer.from(expected, "hex"));
}

function signature(payload: string, config: NonNullable<ReturnType<typeof configuration>>) {
  // Rotating either the password hash or signing secret invalidates old sessions.
  return createHmac("sha256", config.secret).update(`${config.hash}:${payload}`).digest("hex");
}

export function createEditorSession(enabled = true) {
  const config = configuration();
  if (!config) throw new Error("Editor access is not configured");
  const payload = `v2.${enabled ? "on" : "off"}.${randomBytes(24).toString("hex")}`;
  return { token: `${payload}.${signature(payload, config)}`, enabled };
}

export function readEditorSession(token: string | undefined): { enabled: boolean } | null {
  const config = configuration();
  if (!config || !token || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length === 4 && parts[0] === "v2" && ["on", "off"].includes(parts[1])
    && /^[a-f0-9]{48}$/.test(parts[2]) && /^[a-f0-9]{64}$/.test(parts[3])) {
    const expected = signature(parts.slice(0, 3).join("."), config);
    return timingSafeEqual(Buffer.from(parts[3], "hex"), Buffer.from(expected, "hex"))
      ? { enabled: parts[1] === "on" } : null;
  }
  // Upgrade still-valid unlocks from the original one-hour implementation.
  if (parts.length === 3 && /^\d+$/.test(parts[0]) && Number(parts[0]) > Date.now()
    && /^[a-f0-9]{48}$/.test(parts[1]) && /^[a-f0-9]{64}$/.test(parts[2])) {
    const expected = signature(parts.slice(0, 2).join("."), config);
    return timingSafeEqual(Buffer.from(parts[2], "hex"), Buffer.from(expected, "hex"))
      ? { enabled: true } : null;
  }
  return null;
}
