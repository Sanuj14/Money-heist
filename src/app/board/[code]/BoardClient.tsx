"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mask } from "@/components/Brand";
import { mmss } from "@/lib/format";
import type { LeaderRow } from "@/lib/types";

export default function BoardClient({ code }: { code: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [room, setRoom] = useState<{ id: string; name: string; status: string } | null>(null);
  const [bumped, setBumped] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const pull = useCallback(async () => {
    const { data } = await supabase.rpc("public_leaderboard", { p_room_code: code });
    setRows((data as LeaderRow[]) ?? []);
  }, [supabase, code]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("room_public_info", { p_room_code: code });
      if (!data?.[0]) { setNotFound(true); return; }
      setRoom({ id: data[0].id, name: data[0].name, status: data[0].status });
      pull();
    })();
  }, [supabase, code, pull]);

  useEffect(() => {
    if (!room) return;
    const ch = supabase
      .channel(`board:${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "step_results", filter: `room_id=eq.${room.id}` },
        (p: any) => { setBumped(p.new?.team_id ?? null); pull(); setTimeout(() => setBumped(null), 2000); })
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_awards", filter: `room_id=eq.${room.id}` },
        (p: any) => { setBumped(p.new?.team_id ?? null); pull(); setTimeout(() => setBumped(null), 2000); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${room.id}` },
        (p: any) => setRoom((r) => (r ? { ...r, status: p.new.status } : r)))
      .subscribe();
    const poll = setInterval(pull, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [supabase, room, pull]);

  if (notFound) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="display text-[28px] text-bone/40">No heist under code {code}</p>
      </main>
    );
  }

  const leader = rows[0];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-4">
        <Mask className="h-10 w-10" />
        <div>
          <h1 className="display text-[26px] leading-none text-bone sm:text-[34px]">
            {room?.name ?? "…"}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-gold">
            Room {code} · Hunt for Money
          </p>
        </div>
        <span className={`chip ml-auto ${
          room?.status === "live" ? "!border-mint/50 !text-mint"
          : room?.status === "paused" ? "!border-gold/50 !text-gold" : ""
        }`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {room?.status ?? "—"}
        </span>
      </header>

      {leader && (
        <section className="mx-auto mt-6 max-w-6xl overflow-hidden rounded-[18px] bg-dali p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/70">
            Leading the heist
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <h2 className="display text-[10vw] leading-none text-white sm:text-[64px]">{leader.name}</h2>
            <div className="text-right">
              <div className="display text-[46px] leading-none text-ink">{leader.total_points}</div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">credits</p>
            </div>
          </div>
        </section>
      )}

      <ol className="mx-auto mt-4 max-w-6xl space-y-2">
        {rows.map((r) => {
          const pct = r.route_length ? Math.round((r.solved_count / r.route_length) * 100) : 0;
          return (
            <li
              key={r.team_id}
              className={`paper flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition duration-500 ${
                bumped === r.team_id ? "!border-gold ring-2 ring-gold/50" : ""
              }`}
            >
              <span className="display w-10 text-[24px] text-bone/25 tabular-nums">{r.rank}</span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.colour }} />
              <span className="display min-w-0 flex-1 truncate text-[20px] text-bone sm:text-[24px]">
                {r.name}
              </span>

              <div className="hidden w-40 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                  <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-bone/30">
                  {r.solved_count}/{r.route_length} clues
                  {r.finished_at && <span className="text-mint"> · cleared</span>}
                </p>
              </div>

              <span className="hidden font-mono text-[10px] text-bone/30 md:inline">
                {mmss(r.total_sec)}
              </span>

              <span className="display w-24 text-right text-[28px] text-gold tabular-nums sm:text-[32px]">
                {r.total_points}
              </span>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="paper px-6 py-14 text-center">
            <p className="eyebrow">No crews on the board yet</p>
          </li>
        )}
      </ol>

      <p className="mt-8 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-bone/20">
        Updates live · bella ciao
      </p>
    </main>
  );
}
