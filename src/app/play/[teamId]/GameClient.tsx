"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Scanner } from "@/components/Scanner";
import { Wordmark } from "@/components/Brand";
import { BackButton } from "@/components/Nav";
import { mmss } from "@/lib/format";
import { useGeoPing } from "@/lib/useGeoPing";
import type { MyClue, ScanResult, Challenge, LeaderRow } from "@/lib/types";

export default function GameClient({
  teamId, teamName, teamColour, roomId, roomCode, roomName,
}: {
  teamId: string; teamName: string; teamColour: string;
  roomId: string; roomCode: string; roomName: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [clue, setClue] = useState<MyClue | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [flash, setFlash] = useState<ScanResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const busyRef = useRef(false);
  const geoRef = useRef<{ pingNow: () => void } | null>(null);

  /* ---------------- data pulls ---------------- */
  const pullClue = useCallback(async () => {
    const { data } = await supabase.rpc("get_my_clue", { p_team_id: teamId });
    if (data?.[0]) setClue(data[0] as MyClue);
    setLoading(false);
  }, [supabase, teamId]);

  const pullBoard = useCallback(async () => {
    const { data } = await supabase.rpc("public_leaderboard", { p_room_code: roomCode });
    if (data) setBoard(data as LeaderRow[]);
  }, [supabase, roomCode]);

  const pullChallenges = useCallback(async () => {
    const { data } = await supabase
      .from("challenges").select("*")
      .eq("room_id", roomId).eq("status", "open")
      .order("created_at", { ascending: false });
    if (data) setChallenges(data as Challenge[]);
  }, [supabase, roomId]);

  useEffect(() => { pullClue(); pullBoard(); pullChallenges(); }, [pullClue, pullBoard, pullChallenges]);

  /* one-second tick drives the countdown and the live points figure */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* safety net: re-pull every 20s so a lapsed window resolves even if idle */
  useEffect(() => {
    const t = setInterval(pullClue, 20000);
    return () => clearInterval(t);
  }, [pullClue]);

  /* realtime: leaderboard, challenges, room status */
  useEffect(() => {
    const ch = supabase
      .channel(`play:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "step_results", filter: `room_id=eq.${roomId}` }, () => pullBoard())
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_awards", filter: `room_id=eq.${roomId}` }, () => pullBoard())
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `room_id=eq.${roomId}` }, () => pullChallenges())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => pullClue())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, roomId, pullBoard, pullChallenges, pullClue]);

  /* ---------------- derived clock ---------------- */
  const secsLeft = clue?.deadline ? Math.max(0, Math.round((new Date(clue.deadline).getTime() - now) / 1000)) : 0;
  const limit = clue?.time_limit_sec || 600;
  const elapsed = limit - secsLeft;
  const frac = Math.min(1, Math.max(0, secsLeft / limit));
  const floorPts = clue ? clue.max_points * ((clue.floor_pct ?? 25) / 100) : 0;
  const livePoints = clue && !clue.finished
    ? Math.max(0, Math.round(floorPts + (clue.max_points - floorPts) * frac))
    : 0;

  /* when the window lapses, ask the server to roll us forward */
  useEffect(() => {
    if (clue && !clue.finished && clue.deadline && secsLeft === 0) {
      const t = setTimeout(pullClue, 900);
      return () => clearTimeout(t);
    }
  }, [secsLeft, clue, pullClue]);

  /* ---------------- scan ---------------- */
  const submit = useCallback(async (token: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setScanOpen(false);
    geoRef.current?.pingNow();   // stamp this scan with where it happened
    const { data, error } = await supabase.rpc("submit_scan", { p_team_id: teamId, p_token: token });
    const res: ScanResult = error
      ? { ok: false, message: error.message.replace(/^.*?:\s*/, "") }
      : (data as ScanResult);
    setFlash(res);
    if (navigator.vibrate) navigator.vibrate(res.ok ? [40, 60, 40] : [160]);
    await pullClue(); await pullBoard();
    busyRef.current = false;
    setTimeout(() => setFlash(null), res.ok ? 4200 : 3200);
  }, [supabase, teamId, pullClue, pullBoard]);

  const sharingLocation =
    Boolean(clue) && clue!.room_status === "live" && !clue!.finished;
  const geo = useGeoPing(teamId, sharingLocation);

  geoRef.current = geo;

  const myRow = board.find((b) => b.team_id === teamId);
  const urgent = secsLeft <= 60 && secsLeft > 0;

  /* ---------------- render ---------------- */
  return (
    <div className="min-h-screen pb-28">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-ink-line bg-ink/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <BackButton href="/play" label="Leave" />
          <Wordmark compact />
          <div className="ml-auto text-right">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-bone/35">{roomName}</div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: teamColour }} />
              <span className="display text-[13px] text-bone">{teamName}</span>
            </div>
            {sharingLocation && (
              <div className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[8px] uppercase tracking-[0.14em]">
                {geo.status === "on" ? (
                  <span className="text-mint">◉ Location shared with marshals</span>
                ) : geo.status === "denied" ? (
                  <span className="text-bone/35">Location off</span>
                ) : (
                  <span className="text-bone/35">Locating…</span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading && <p className="eyebrow py-20 text-center">Opening the vault…</p>}

        {/* -------- waiting for the whistle -------- */}
        {!loading && clue && clue.room_status !== "live" && !clue.finished && (
          <Waiting status={clue.room_status} teamName={teamName} />
        )}

        {/* -------- finished -------- */}
        {!loading && clue?.finished && (
          <div className="paper-bone mt-6 p-8 text-center">
            <p className="eyebrow !text-ink/50">Route complete</p>
            <h1 className="display mt-3 text-[46px] text-ink">
              THE VAULT<br /><span className="text-dali">IS OPEN</span>
            </h1>
            <p className="mt-4 text-[14px] text-ink/60">
              {teamName} cleared all {clue.total_steps} clues.
            </p>
            <div className="mt-6 inline-flex items-baseline gap-2 rounded-full bg-ink px-6 py-3">
              <span className="display text-[34px] text-gold">{myRow?.total_points ?? 0}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/50">credits</span>
            </div>
            {myRow && (
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
                Currently ranked #{myRow.rank}
              </p>
            )}
          </div>
        )}

        {/* -------- active clue -------- */}
        {!loading && clue && !clue.finished && clue.room_status === "live" && (
          <>
            {/* clock */}
            <section className={`paper relative overflow-hidden p-6 ${urgent ? "border-dali/60" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Clue {clue.step_index + 1} of {clue.total_steps}</p>
                  <div className={`display mt-1 text-[58px] leading-none tabular-nums ${urgent ? "text-dali animate-pulse" : "text-bone"}`}>
                    {mmss(secsLeft)}
                  </div>
                </div>
                <div className="text-right">
                  <p className="eyebrow">Banking now</p>
                  <div className="display mt-1 text-[38px] leading-none text-gold tabular-nums">{livePoints}</div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-bone/35">
                    of {clue.max_points}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-ink">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${frac * 100}%`, background: urgent ? "#E63329" : "#F5C542" }}
                />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-bone/30">
                <span>elapsed {mmss(elapsed)}</span>
                <span>window {mmss(limit)}</span>
              </div>
            </section>

            {/* the clue itself */}
            <section className="paper-bone mt-4 p-7">
              <p className="eyebrow !text-ink/45">The clue</p>
              <h2 className="display mt-2 text-[30px] leading-tight text-ink">{clue.title}</h2>
              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink/75">
                {clue.body}
              </p>
              {clue.hint && (
                <div className="sticky-note mt-6 !rotate-0 p-4">
                  <p className="font-display text-[11px] uppercase tracking-wide">Hint unlocked</p>
                  <p className="mt-1 text-[12px] leading-relaxed">{clue.hint}</p>
                </div>
              )}
            </section>

            {/* challenges floated to us */}
            {challenges.length > 0 && (
              <section className="mt-4 space-y-3">
                {challenges.map((c) => (
                  <div key={c.id} className="rounded-[14px] border border-gold/40 bg-gold/10 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="eyebrow !text-gold">
                        {c.target === "team" ? "Challenge · your crew only" : "Challenge · all crews"}
                      </p>
                      <span className="chip !border-gold/50 !text-gold">+{c.points}</span>
                    </div>
                    <h3 className="display mt-2 text-[20px] text-bone">{c.title}</h3>
                    {c.description && (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-bone/60">{c.description}</p>
                    )}
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/35">
                      Show the marshal when you&apos;ve done it — they award the credits.
                    </p>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {/* mini leaderboard */}
        {board.length > 0 && (
          <section className="paper mt-4 p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Live board</p>
              <Link href={`/board/${roomCode}`} className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold hover:underline">
                Full board →
              </Link>
            </div>
            <ul className="mt-4 space-y-1.5">
              {board.slice(0, 6).map((r) => (
                <li
                  key={r.team_id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                    r.team_id === teamId ? "bg-dali/15 ring-1 ring-dali/40" : "bg-ink"
                  }`}
                >
                  <span className="w-6 font-mono text-[12px] text-bone/40">{r.rank}</span>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.colour }} />
                  <span className="truncate text-[13px] text-bone/85">{r.name}</span>
                  <span className="ml-auto font-mono text-[9px] text-bone/30">
                    {r.solved_count}/{r.route_length}
                  </span>
                  <span className="display w-16 text-right text-[16px] text-gold tabular-nums">
                    {r.total_points}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* scan button */}
      {clue && !clue.finished && clue.room_status === "live" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-ink/95 p-4 backdrop-blur-md">
          <button
            onClick={() => setScanOpen(true)}
            className="pill-red mx-auto flex w-full max-w-md !py-4 !text-[13px] animate-pulseRing"
          >
            ◉ Scan the QR at the drop point
          </button>
        </div>
      )}

      <Scanner open={scanOpen} onClose={() => setScanOpen(false)} onToken={submit} />

      {/* result flash */}
      {flash && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/92 p-6 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-[18px] p-8 text-center animate-rise ${
            flash.ok ? "bg-bone text-ink" : "border border-dali/50 bg-ink-soft"
          }`}>
            {flash.ok ? (
              <>
                <p className="eyebrow !text-ink/45">Clue cracked</p>
                <div className="display mt-3 text-[64px] leading-none text-dali">+{flash.points}</div>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink/50">
                  in {mmss(flash.elapsed_sec ?? 0)} · max {flash.max_points}
                </p>
                <p className="mt-5 text-[14px] text-ink/70">
                  {flash.finished ? "That was the last one. Vault cleared." : "Next clue is on your screen."}
                </p>
              </>
            ) : (
              <>
                <div className="display text-[26px] text-dali">Not this one</div>
                <p className="mt-3 text-[14px] leading-relaxed text-bone/70">{flash.message}</p>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">
                  Clock is still running
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Waiting({ status, teamName }: { status: string; teamName: string }) {
  const copy: Record<string, [string, string]> = {
    draft:  ["Standing by", "The round hasn't been opened yet. Keep this tab open — your first clue appears the second it starts."],
    paused: ["Heist paused", "The marshal has frozen the clock. Nobody is losing points. Hold position."],
    ended:  ["Heist over", "This round has been closed out. Check the board for the final standings."],
  };
  const [title, body] = copy[status] ?? copy.draft;
  return (
    <div className="paper mt-6 p-9 text-center">
      <div className="mx-auto h-3 w-3 animate-ping rounded-full bg-dali" />
      <h1 className="display mt-6 text-[36px] text-bone">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-bone/55">{body}</p>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{teamName} · ready</p>
    </div>
  );
}
