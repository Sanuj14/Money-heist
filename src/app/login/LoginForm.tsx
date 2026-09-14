"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Brand";
import { StickyNote } from "@/components/Polaroid";

export default function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/play";

  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  async function magicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    let res = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (res.error && /invalid login/i.test(res.error.message)) {
      const signUp = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUp.error) { setBusy(false); setErr(signUp.error.message); return; }
      res = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    }
    setBusy(false);
    if (res.error) setErr(res.error.message);
    else window.location.href = next;
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-[880px]">
        <div className="mb-8 flex justify-center"><Wordmark /></div>

        <div className="grid items-start gap-8 md:grid-cols-[1fr_auto]">
          <div className="paper p-7 sm:p-9">
            <p className="eyebrow">Step one of three</p>
            <h1 className="display mt-2 text-[34px] text-bone">Identify yourself</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
              Your email ties every scan your crew makes back to you. No alias,
              no entry.
            </p>

            <div className="mt-6 inline-flex rounded-full border border-ink-line p-1">
              <button onClick={() => setMode("link")} className={`tabbtn ${mode === "link" ? "tabbtn-on" : ""}`}>
                Magic link
              </button>
              <button onClick={() => setMode("password")} className={`tabbtn ${mode === "password" ? "tabbtn-on" : ""}`}>
                Password
              </button>
            </div>

            {sent ? (
              <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-5">
                <p className="display text-[18px] text-gold">Check your inbox</p>
                <p className="mt-2 text-[13px] text-bone/60">
                  A sign-in link is on its way to <b className="text-bone">{email}</b>.
                  Open it on the phone you&apos;ll be scanning with.
                </p>
              </div>
            ) : (
              <form onSubmit={mode === "link" ? magicLink : withPassword} className="mt-6 space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu" className="field"
                  />
                </div>
                {mode === "password" && (
                  <div>
                    <label className="label">Password</label>
                    <input
                      type="password" required minLength={6} value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters" className="field"
                    />
                    <p className="mt-1.5 font-mono text-[10px] text-bone/35">
                      New here? An account is created automatically.
                    </p>
                  </div>
                )}
                {err && (
                  <p className="rounded-lg border border-dali/40 bg-dali/10 px-3 py-2 text-[12px] text-dali-soft">
                    {err}
                  </p>
                )}
                <button disabled={busy} className="pill-red w-full !py-3.5">
                  {busy ? "Working…" : mode === "link" ? "Send sign-in link" : "Sign in"}
                </button>
              </form>
            )}

            <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone/30">
              <Link href="/" className="hover:text-bone/60">← Back to the briefing</Link>
            </p>
          </div>

          <StickyNote rotate={3} className="mx-auto !w-[210px] md:mt-10">
            <b className="block font-display text-[13px] uppercase">Heads up</b>
            Sign in on the same phone you&apos;ll scan with. The camera lives in the
            browser tab — swapping devices mid-round costs you minutes.
          </StickyNote>
        </div>
      </div>
    </main>
  );
}
