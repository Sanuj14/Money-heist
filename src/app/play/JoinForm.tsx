"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StickyNote } from "@/components/Polaroid";
import { JoinTarget, type JoinSelection } from "@/components/JoinTarget";

export default function JoinForm({ email }: { email: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<JoinSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChange = useCallback((s: JoinSelection) => setSel(s), []);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!sel?.ready) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
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

  return (
    <main className="mx-auto grid max-w-[900px] gap-8 px-4 py-12 md:grid-cols-[1fr_auto] md:items-start">
      <form onSubmit={join} className="paper p-7 sm:p-9">
        <p className="eyebrow">Signed in as {email}</p>
        <h1 className="display mt-2 text-[34px] text-bone">Pick your heist</h1>

        <div className="mt-6 space-y-5">
          <JoinTarget onChange={onChange} />
          {err && <p className="text-[12px] text-dali-soft">{err}</p>}
          <button disabled={busy || !sel?.ready} className="pill-red w-full !py-3.5">
            {busy ? "Joining…" : sel?.teamName ? `Start as ${sel.teamName}` : "Start the round"}
          </button>
        </div>

      </form>

      <StickyNote rotate={-3} className="mx-auto !w-[210px] md:mt-14">
        <b className="block font-display text-[13px] uppercase">One crew</b>
        Once you&apos;re on a crew in a room, that&apos;s where you stay.
        Progress lives on the team, not your phone.
      </StickyNote>
    </main>
  );
}
