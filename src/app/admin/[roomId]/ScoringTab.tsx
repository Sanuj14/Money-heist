"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mmss, pointsAt } from "@/lib/format";
import type { Room } from "@/lib/types";

export default function ScoringTab({
  room, setRoom, flash,
}: {
  room: Room; setRoom: (r: Room) => void; flash: (m: string) => void;
}) {
  const supabase = createClient();
  const [f, setF] = useState({
    time_limit_sec: room.time_limit_sec,
    base_points: room.base_points,
    floor_pct: room.floor_pct,
    timeout_points: room.timeout_points,
    require_team_code: room.require_team_code ?? true,
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.from("rooms").update(f).eq("id", room.id);
    setBusy(false);
    if (error) return flash(error.message);
    setRoom({ ...room, ...f });
    flash("Scoring updated");
  }

  const samples = [0, 0.1, 0.25, 0.5, 0.75, 0.95, 1].map((p) => {
    const el = Math.round(f.time_limit_sec * p);
    return { el, pts: pointsAt(el, f.time_limit_sec, f.base_points, f.floor_pct, f.timeout_points) };
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="paper p-7">
        <p className="eyebrow">Rules of the round</p>
        <h2 className="display mt-1 text-[30px] text-bone">Scoring</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-bone/50">
          Points fall in a straight line from the base pot at zero seconds down
          to the floor at the buzzer. Individual clues can override the window
          and the pot from the Clues tab.
        </p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <Num label="Time per clue (seconds)" value={f.time_limit_sec} min={30} step={30}
            onChange={(v) => setF({ ...f, time_limit_sec: v })} hint={mmss(f.time_limit_sec)} />
          <Num label="Base points (instant scan)" value={f.base_points} min={10} step={50}
            onChange={(v) => setF({ ...f, base_points: v })} />
          <Num label="Floor % (points at the buzzer)" value={f.floor_pct} min={0} max={100} step={5}
            onChange={(v) => setF({ ...f, floor_pct: v })}
            hint={`${Math.round(f.base_points * f.floor_pct / 100)} pts`} />
          <Num label="Timeout points (window lapsed)" value={f.timeout_points} min={-500} step={25}
            onChange={(v) => setF({ ...f, timeout_points: v })} hint="negative = penalty" />
        </div>

        <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-xl border border-ink-line bg-ink p-4">
          <input
            type="checkbox"
            checked={f.require_team_code}
            onChange={(e) => setF({ ...f, require_team_code: e.target.checked })}
            className="mt-0.5 h-4 w-4 accent-[#E63329]"
          />
          <span>
            <span className="block font-display text-[13px] uppercase text-bone">
              Require the team code to join
            </span>
            <span className="mt-1 block text-[12px] leading-relaxed text-bone/45">
              Off: the room code alone lets a player pick any crew — fastest on
              event day. On: they must also type their crew&apos;s six-character
              code, so nobody joins a rival crew and reads their clues.
            </span>
          </span>
        </label>

        <button onClick={save} disabled={busy} className="pill-gold mt-5 !px-8">
          {busy ? "Saving…" : "Save scoring"}
        </button>

        <p className="mt-6 rounded-lg border border-ink-line bg-ink p-4 font-mono text-[10px] leading-relaxed text-bone/40">
          Timeouts always auto-advance: when the window lapses, the team banks the
          timeout value and the next clue appears immediately. Nobody gets stuck.
        </p>
      </div>

      <div className="paper p-7">
        <p className="eyebrow">What a team would earn</p>
        <table className="mt-5 w-full">
          <thead>
            <tr className="border-b border-ink-line">
              <th className="pb-2 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">Scanned at</th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">Credits</th>
              <th className="pb-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">Bar</th>
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={i} className="border-b border-ink-line/50">
                <td className="py-2.5 font-mono text-[13px] text-bone/70">{mmss(s.el)}</td>
                <td className="py-2.5 text-right font-display text-[18px] text-gold tabular-nums">{s.pts}</td>
                <td className="w-[45%] py-2.5 pl-4">
                  <div className="h-2 overflow-hidden rounded-full bg-ink">
                    <div className="h-full rounded-full"
                      style={{
                        width: `${Math.max(0, Math.min(100, (s.pts / Math.max(1, f.base_points)) * 100))}%`,
                        background: s.pts <= 0 ? "#B01C15" : "#F5C542",
                      }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone/30">
          Last row = the window lapsed
        </p>
      </div>
    </div>
  );
}

function Num({
  label, value, onChange, min, max, step = 1, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; hint?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} className="field" />
      {hint && <p className="mt-1 font-mono text-[10px] text-bone/35">{hint}</p>}
    </div>
  );
}
