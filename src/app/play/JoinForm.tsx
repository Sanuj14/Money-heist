"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StickyNote } from "@/components/Polaroid";

export default function JoinForm({
  email,
  resumeTeamId,
}: {
  email: string;
  resumeTeamId: string | null;
}) {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [stage, setStage] = useState<1 | 2>(1);
  const [roomName, setRoomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function checkRoom(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("room_public_info", {
      p_room_code: roomCode.trim(),
    });
    setBusy(false);
    const room = data?.[0];
    if (error || !room) { setErr("No heist is running under that room code."); return; }
    if (room.status === "ended") { setErr("That heist has already wrapped."); return; }
    setRoomName(room.name);
    setStage(2);
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("join_game", {
      p_room_code: roomCode.trim(),
      p_team_code: teamCode.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message.replace(/^.*?:\s*/, "")); return; }
    const row = data?.[0];
    if (!row) { setErr("Could not join that team."); return; }
    router.push(`/play/${row.team_id}`);
  }

  return (
    <main className="mx-auto grid max-w-[900px] gap-8 px-4 py-12 md:grid-cols-[1fr_auto] md:items-start">
      <div className="paper p-7 sm:p-9">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-10 rounded-full ${stage >= 1 ? "bg-dali" : "bg-ink-line"}`} />
          <span className={`h-1.5 w-10 rounded-full ${stage >= 2 ? "bg-dali" : "bg-ink-line"}`} />
        </div>

        <p className="eyebrow mt-5">Signed in as {email}</p>

        {stage === 1 ? (
          <>
            <h1 className="display mt-2 text-[36px] text-bone">Room code</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
              Six characters from whoever is running the round. This gets your
              whole cohort into the same heist.
            </p>
            <form onSubmit={checkRoom} className="mt-6 space-y-4">
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="——————"
                maxLength={8}
                autoFocus
                className="field-code"
              />
              {err && <p className="text-[12px] text-dali-soft">{err}</p>}
              <button disabled={busy || roomCode.length < 4} className="pill-red w-full !py-3.5">
                {busy ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="display mt-2 text-[36px] text-bone">Team code</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
              You&apos;re at the door of <b className="text-gold">{roomName}</b>. Now prove
              which crew you run with — this one is unique to your team.
            </p>
            <form onSubmit={joinTeam} className="mt-6 space-y-4">
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="——————"
                maxLength={8}
                autoFocus
                className="field-code"
              />
              {err && <p className="text-[12px] text-dali-soft">{err}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setStage(1); setErr(null); }} className="pill-ghost">
                  Back
                </button>
                <button disabled={busy || teamCode.length < 4} className="pill-red flex-1 !py-3.5">
                  {busy ? "Joining…" : "Start the round"}
                </button>
              </div>
            </form>
          </>
        )}

        {resumeTeamId && (
          <Link
            href={`/play/${resumeTeamId}`}
            className="mt-6 block rounded-xl border border-gold/35 bg-gold/10 px-4 py-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:bg-gold/15"
          >
            Resume your run in progress →
          </Link>
        )}
      </div>

      <StickyNote rotate={-3} className="mx-auto !w-[210px] md:mt-14">
        <b className="block font-display text-[13px] uppercase">Two locks</b>
        Room code = the building. Team code = your crew. Both are needed
        before the first clue shows.
      </StickyNote>
    </main>
  );
}
