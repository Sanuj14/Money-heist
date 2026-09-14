"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { mmss } from "@/lib/format";
import type { Room, Team, AdminTeamState } from "@/lib/types";

export default function LiveTab({
  room, state, teams, refresh, flash,
}: {
  room: Room; state: AdminTeamState[]; teams: Team[];
  refresh: () => void; flash: (m: string) => void;
}) {
  const supabase = createClient();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function nudge(teamId: string, delta: number) {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const { error } = await supabase
      .from("teams")
      .update({ bonus_points: team.bonus_points + delta })
      .eq("id", teamId);
    if (error) return flash(error.message);
    refresh();
    flash(`${delta > 0 ? "+" : ""}${delta} to ${team.name}`);
  }

  const ranked = [...state].sort((a, b) => b.total_points - a.total_points);
  const totalScans = state.reduce((a, t) => a + t.solved, 0);
  const done = state.filter((t) => t.finished_at).length;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Crews" value={state.length} />
        <Stat label="Clues banked" value={totalScans} />
        <Stat label="Routes cleared" value={done} />
        <Stat label="Room code" value={room.code} mono />
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Control room</p>
          <h2 className="display mt-1 text-[30px] text-bone">Live positions</h2>
        </div>
        <Link href={`/board/${room.code}`} target="_blank" className="pill-gold">
          Projector board ↗
        </Link>
      </div>

      <ul className="mt-5 space-y-3">
        {ranked.map((t, i) => {
          const limit = room.time_limit_sec;
          const started = t.step_started_at ? new Date(t.step_started_at).getTime() : null;
          const left = started && room.status === "live" && !t.finished_at
            ? Math.max(0, Math.round((started + limit * 1000 - now) / 1000))
            : null;
          const pct = t.route_length ? Math.round((t.solved / t.route_length) * 100) : 0;

          return (
            <li key={t.team_id} className="paper p-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span className="display w-8 text-[22px] text-bone/25">{i + 1}</span>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.colour }} />
                <div className="min-w-0 flex-1">
                  <div className="display truncate text-[19px] text-bone">{t.name}</div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone/35">
                    code {t.join_code} · {t.members} signed in
                    {t.bonus !== 0 && <span className="text-gold"> · bonus {t.bonus > 0 ? "+" : ""}{t.bonus}</span>}
                  </div>
                </div>

                <div className="w-36">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink">
                    <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-bone/30">
                    clue {Math.min(t.current_index + 1, t.route_length)} of {t.route_length}
                  </p>
                </div>

                <div className="w-20 text-center">
                  {t.finished_at ? (
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mint">cleared</span>
                  ) : left !== null ? (
                    <span className={`display text-[20px] tabular-nums ${left <= 60 ? "text-dali" : "text-bone/70"}`}>
                      {mmss(left)}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone/25">idle</span>
                  )}
                </div>

                <div className="display w-20 text-right text-[26px] text-gold tabular-nums">
                  {t.total_points}
                </div>

                <div className="flex gap-1.5">
                  <button onClick={() => nudge(t.team_id, -100)} className="pill-ghost !px-3 !py-1">−100</button>
                  <button onClick={() => nudge(t.team_id, 100)} className="pill-ghost !px-3 !py-1">+100</button>
                </div>
              </div>
            </li>
          );
        })}
        {state.length === 0 && (
          <li className="paper px-6 py-16 text-center">
            <p className="eyebrow">No crews yet — add teams first</p>
          </li>
        )}
      </ul>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="paper p-5">
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-[30px] leading-none text-bone ${mono ? "font-mono tracking-[0.12em] text-gold" : "font-display"}`}>
        {value}
      </p>
    </div>
  );
}
