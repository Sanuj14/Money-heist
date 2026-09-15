"use client";

import { useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Brand";
import { StickyNote } from "@/components/Polaroid";
import { JoinTarget, type JoinSelection } from "@/components/JoinTarget";

const ADMIN_EMAIL = "igs@vit.ac.in";

export default function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next");
  const [mode, setMode] = useState<"crew" | "marshal">(
    next?.startsWith("/admin") ? "marshal" : "crew"
  );

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[920px]">
        <div className="mb-7 flex justify-center"><Wordmark /></div>

        <div className="mb-6 flex justify-center">
          <div className="inline-flex rounded-full border border-ink-line p-1">
            <button onClick={() => setMode("crew")} className={`tabbtn ${mode === "crew" ? "tabbtn-on" : ""}`}>
              Crew
            </button>
            <button onClick={() => setMode("marshal")} className={`tabbtn ${mode === "marshal" ? "tabbtn-on" : ""}`}>
              Marshal
            </button>
          </div>
        </div>

        {mode === "crew" ? <CrewForm router={router} /> : <MarshalForm router={router} />}

        <p className="mt-7 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-bone/30">
          <Link href="/" className="hover:text-bone/60">← Back to the briefing</Link>
        </p>
      </div>
    </main>
  );
}

/* ===================================================================
   CREW — one screen: room code, crew, email, password
   =================================================================== */
function CrewForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [sel, setSel] = useState<JoinSelection | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChange = useCallback((s: JoinSelection) => setSel(s), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sel?.ready) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const mail = email.trim().toLowerCase();

    // Sign in first. If the account doesn't exist yet, have the server create
    // it (already confirmed, no email involved), then sign in.
    let auth = await supabase.auth.signInWithPassword({ email: mail, password });
    if (auth.error && /invalid login credentials/i.test(auth.error.message)) {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: mail,
          password,
          roomCode: sel.roomCode,
          teamCode: sel.teamCode,
        }),
      });
      const out = await res.json().catch(() => ({ ok: false, message: "Registration failed." }));
      if (!out.ok) {
        setBusy(false);
        setErr(
          /SUPABASE_SECRET_KEY/.test(out.message ?? "")
            ? "Server registration isn't configured. Add SUPABASE_SECRET_KEY to .env.local (and to Vercel), then restart."
            : out.message ?? "Could not create that account."
        );
        return;
      }
      auth = await supabase.auth.signInWithPassword({ email: mail, password });
      if (auth.error && out.existed) {
        setBusy(false);
        setErr("That email is already registered — check the password.");
        return;
      }
    }
    if (auth.error) { setBusy(false); setErr(auth.error.message); return; }

    const { data, error } = await supabase.rpc("join_room_team", {
      p_room_code: sel.roomCode,
      p_team_id: sel.teamId,
      p_team_code: sel.requireCode ? sel.teamCode : null,
    });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^.*?:\s*/, "")); return; }
    const row = data as { team_id?: string } | null;
    if (!row) { setErr("Could not join that crew."); return; }
    router.push(`/play/${row.team_id}`);
  }

  const ready = sel?.ready && email.trim() && password.length >= 6;

  return (
    <div className="grid items-start gap-8 md:grid-cols-[1fr_auto]">
      <form onSubmit={submit} className="paper p-7 sm:p-9">
        <p className="eyebrow">Register your crew</p>
        <h1 className="display mt-2 text-[34px] text-bone">Join the heist</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
          Room code gets you to the door. Your crew&apos;s own code gets you in.
          Then set the login you&apos;ll use on the phone you&apos;re scanning with.
        </p>

        <div className="mt-6 space-y-5">
          <JoinTarget onChange={onChange} />

          {sel?.ready && (
            <div className="animate-rise space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@vitstudent.ac.in" className="field"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters" className="field"
                  />
                </div>
              </div>
              <p className="font-mono text-[10px] text-bone/35">
                New here? The account is created automatically. Already registered?
                The same email and password signs you back in.
              </p>
            </div>
          )}

          {err && (
            <p className="rounded-lg border border-dali/40 bg-dali/10 px-3 py-2 text-[12px] text-dali-soft">
              {err}
            </p>
          )}

          <button disabled={busy || !ready} className="pill-red w-full !py-4">
            {busy ? "Breaking in…" : sel?.teamName ? `Join as ${sel.teamName}` : "Join the heist"}
          </button>
        </div>
      </form>

      <StickyNote rotate={3} className="mx-auto !w-[210px] md:mt-16">
        <b className="block font-display text-[13px] uppercase">Two codes</b>
        Room code = the building, same for everyone. Team code = your crew,
        and yours alone. Each teammate registers with their own email.
      </StickyNote>
    </div>
  );
}

/* ===================================================================
   MARSHAL
   =================================================================== */
function MarshalForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const mail = email.trim().toLowerCase();

    // Marshal accounts are provisioned in Supabase, never created from here —
    // a typo should read as a wrong passcode, not spawn an account.
    const auth = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (auth.error) {
      setErr(
        /invalid login credentials/i.test(auth.error.message)
          ? "Wrong email or passcode for the control room."
          : auth.error.message
      );
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} className="paper p-7 sm:p-9">
        <p className="eyebrow">Control room</p>
        <h1 className="display mt-2 text-[32px] text-bone">Marshal sign-in</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
          Runs the round: builds the clues, prints the QRs, starts the clock.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="label">Email</label>
            <input type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className="field font-mono text-[14px]" />
          </div>
          <div>
            <label className="label">Passcode</label>
            <input type="password" required value={password} autoFocus
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••" className="field font-mono tracking-[0.3em]" />
          </div>

          {err && (
            <p className="rounded-lg border border-dali/40 bg-dali/10 px-3 py-2 text-[12px] text-dali-soft">
              {err}
            </p>
          )}

          <button disabled={busy || !password} className="pill-gold w-full !py-3.5">
            {busy ? "Opening…" : "Enter the control room"}
          </button>
        </div>
      </form>
    </div>
  );
}
