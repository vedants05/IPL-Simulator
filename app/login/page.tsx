"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { usernameAvailable, enterGuestMode, leaveGuestMode } from "@/lib/supabase/cloudSaves";

/**
 * Supabase Auth identifies accounts by email, so a username maps to a
 * synthetic internal address. Users never see or type it. Email confirmation
 * must be disabled in the Supabase dashboard for sign-up to return a session.
 */
const USERNAME_DOMAIN = "users.iplmanager.app";
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function toInternalEmail(username: string): string {
  return `${username.toLowerCase()}@${USERNAME_DOMAIN}`;
}

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Wrong username or password.";
  if (/already registered/i.test(message)) return "That username is taken.";
  if (/email not confirmed/i.test(message)) return "Email confirmation is still enabled in Supabase. Turn it off under Authentication → Providers → Email.";
  return message;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/saves";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [availability, setAvailability] = useState<"unknown" | "checking" | "free" | "taken">("unknown");

  const checkAvailability = async () => {
    const clean = username.trim().toLowerCase();
    if (mode !== "signup" || !USERNAME_RE.test(clean)) { setAvailability("unknown"); return; }
    setAvailability("checking");
    try { setAvailability((await usernameAvailable(clean)) ? "free" : "taken"); }
    catch { setAvailability("unknown"); }
  };

  const playAsGuest = () => {
    enterGuestMode();
    router.replace("/");
    router.refresh();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = username.trim().toLowerCase();
    if (!USERNAME_RE.test(clean)) {
      setMessage("Username must be 3–20 characters: letters, numbers or underscores.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    const email = toInternalEmail(clean);
    try {
      if (mode === "signup") {
        if (!(await usernameAvailable(clean))) {
          setAvailability("taken");
          throw new Error("That username is taken.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: clean } },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created but no session returned. Disable email confirmation in Supabase, then sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      leaveGuestMode();
      router.replace(next);
      router.refresh();
    } catch (error: any) {
      setMessage(friendlyError(error?.message ?? "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = "mt-1 w-full bg-bg border-2 border-border px-3 py-2 text-text-primary outline-none focus:border-text-primary";

  return (
    <form onSubmit={submit} className="w-full max-w-md border-2 border-border bg-surface p-8 space-y-5">
      <div>
        <div className="font-space-mono text-[10px] tracking-[0.3em] uppercase text-text-secondary">IPL Manager 2027</div>
        <h1 className="font-anton text-[36px] leading-none uppercase text-text-primary mt-1">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
      </div>

      <label className="block">
        <span className="font-space-mono text-[10px] tracking-widest uppercase text-text-secondary">Username</span>
        <input
          type="text" required value={username} onChange={(e) => { setUsername(e.target.value); setAvailability("unknown"); }}
          onBlur={checkAvailability}
          autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20}
          className={inputClass}
        />
        {mode === "signup" && availability !== "unknown" && (
          <span className={`block mt-1 font-space-mono text-[10px] tracking-widest uppercase ${availability === "taken" ? "text-red-500" : "text-text-secondary"}`}>
            {availability === "checking" ? "Checking…" : availability === "free" ? "Available" : "Taken"}
          </span>
        )}
      </label>
      <label className="block">
        <span className="font-space-mono text-[10px] tracking-widest uppercase text-text-secondary">Password</span>
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={inputClass}
        />
      </label>

      {message && <div className="font-space-mono text-[11px] text-text-secondary border border-border/40 px-3 py-2">{message}</div>}

      <button
        type="submit" disabled={busy}
        className="w-full font-anton text-[18px] tracking-wide py-3 border-2 border-border bg-text-primary text-bg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {busy ? "..." : mode === "signin" ? "Sign in" : "Sign up"}
      </button>

      <div className="flex items-center justify-between font-space-mono text-[11px] uppercase tracking-widest text-text-secondary">
        <button type="button" onClick={playAsGuest} disabled={busy} className="hover:text-text-primary underline underline-offset-4">
          Play as guest
        </button>
        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(null); setAvailability("unknown"); }} className="hover:text-text-primary underline underline-offset-4">
          {mode === "signin" ? "New here? Sign up" : "Have an account? Sign in"}
        </button>
      </div>
      <p className="font-space-mono text-[10px] leading-relaxed text-text-secondary">
        Guest progress stays in this browser only. Sign in later and your current game uploads to the cloud automatically.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
