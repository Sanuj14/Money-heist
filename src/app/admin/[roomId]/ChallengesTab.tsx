"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Team, Challenge } from "@/lib/types";

const IDEAS = [
  ["Bella Ciao", "Whole crew sings the chorus to the nearest marshal.", 200],
  ["Red alert", "Every member wears something red for the next two clues.", 150],
  ["Silent run", "Not a word between you until the next scan.", 300],
  ["The Professor's call", "Answer a trivia question from the marshal on the spot.", 250],
  ["Human vault", "Build a five-person pyramid and photograph it.", 400],
] as const;

export default function ChallengesTab({
  room, teams, flash, refreshState,
}: {
  room: Room; teams: Team[]; flash: (m: string) => void; refreshState: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [list, setList] = useState<Challenge[]>([]);
  const [awards, setAwards] = useState<Record<string, string[]>>({});
  const [f, setF] = useState({ title: "", description: "", points: 250, target: "all" as "all" | "team", team_id: "" });
  const [busy, setBusy] = useState(false);

  const pull = useCallback(async () => {
    const [{ data: ch }, { data: aw }] = await Promise.all([
      supabase.from("challenges").select("*").eq("room_id", room.id).order("created_at", { ascending: false }),
      supabase.from("challenge_awards").select("challenge_id, team_id").eq("room_id", room.id),
    ]);
    setList((ch ?? []) as Challenge[]);
    const map: Record<string, string[]> = {};
    (aw ?? []).forEach((a: any) => { (map[a.challenge_id] ||= []).push(a.team_id); });
    setAwards(map);
  }, [supabase, room.id]);

  useEffect(() => { pull(); }, [pull]);

  async function float(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("challenges").insert({
      room_id: room.id,
      title: f.title.trim(),
      description: f.description.trim(),
      points: f.points,
      target: f.target,
      team_id: f.target === "team" ? f.team_id || null : null,
    });
    setBusy(false);
    if (error) return flash(error.message);
    setF({ ...f, title: "", description: "" });
    pull();
    flash(f.target === "all" ? "Floated to every crew" : "Floated to one crew");
  }

  async function award(challengeId: string, teamId: string, points: number) {
    const { error } = await supabase.rpc("award_challenge", {
      p_challenge_id: challengeId, p_team_id: teamId, p_points: points,
    });
    if (error) return flash(error.message);
    pull(); refreshState();
    flash(`+${points} awarded`);
  }

  async function close(id: string) {
    await supabase.from("challenges").update({ status: "closed" }).eq("id", id);
    pull();
    flash("Challenge closed");
  }

  function randomise() {
    const pick = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    const pts = [100, 150, 200, 250, 300, 400, 500][Math.floor(Math.random() * 7)];
    setF({ ...f, title: pick[0], description: pick[1], points: pts });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
      <form onSubmit={float} className="paper p-6">
        <p className="eyebrow">Float a side job</p>
        <h2 className="display mt-1 text-[26px] text-bone">In-game challenge</h2>

        <div className="mt-5 space-y-4">
          <div>
            <label className="label">Title</label>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}
              placeholder="Bella Ciao" className="field" />
          </div>
          <div>
            <label className="label">What they have to do</label>
            <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })}
              rows={3} className="field resize-y" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Points</label>
              <input type="number" value={f.points} step={50}
                onChange={(e) => setF({ ...f, points: Number(e.target.value) })} className="field" />
            </div>
            <div>
              <label className="label">Target</label>
              <select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value as any })} className="field">
                <option value="all">Every crew</option>
                <option value="team">One crew</option>
              </select>
            </div>
          </div>
          {f.target === "team" && (
            <div>
              <label className="label">Which crew</label>
              <select value={f.team_id} onChange={(e) => setF({ ...f, team_id: e.target.value })} className="field">
                <option value="">Choose…</option>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={randomise} className="pill-ghost">🎲 Random</button>
          <button disabled={busy || !f.title.trim() || (f.target === "team" && !f.team_id)} className="pill-red flex-1">
            Float it
          </button>
        </div>

        <p className="mt-5 font-mono text-[10px] leading-relaxed text-bone/35">
          Floated challenges appear instantly on the players&apos; clue screen.
          You award the credits manually once a marshal confirms it.
        </p>
      </form>

      <div>
        <p className="eyebrow">Floated</p>
        <ul className="mt-4 space-y-3">
          {list.map((c) => {
            const won = awards[c.id] ?? [];
            const eligible = c.target === "all" ? teams : teams.filter((t) => t.id === c.team_id);
            return (
              <li key={c.id} className={`paper p-5 ${c.status === "closed" ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="chip !border-gold/50 !text-gold">+{c.points}</span>
                  <h3 className="display flex-1 text-[19px] text-bone">{c.title}</h3>
                  <span className="chip">{c.target === "all" ? "all crews" : "single crew"}</span>
                  {c.status === "open" && (
                    <button onClick={() => close(c.id)} className="pill-ghost !px-3 !py-1">Close</button>
                  )}
                </div>
                {c.description && <p className="mt-2 text-[13px] leading-relaxed text-bone/55">{c.description}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {eligible.map((t) => {
                    const done = won.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => award(c.id, t.id, c.points)}
                        className={`chip transition ${done ? "!border-mint/60 !text-mint" : "hover:!border-gold/60 hover:!text-gold"}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.colour }} />
                        {t.name}{done ? " ✓" : ""}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="paper px-6 py-16 text-center">
              <p className="eyebrow">Nothing floated yet</p>
              <p className="mt-3 text-[13px] text-bone/45">
                Use these to shake up a runaway lead or give a stuck crew a way back in.
              </p>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
