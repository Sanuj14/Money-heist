"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Team, Clue } from "@/lib/types";

const PALETTE = ["#E63329", "#F5C542", "#3FB68B", "#6C8EF5", "#C77DFF", "#FF8A3D", "#4FD1E0", "#F45B9A"];

export default function TeamsTab({
  room, teams, clues, refresh, flash,
}: {
  room: Room; teams: Team[]; clues: Clue[]; refresh: () => void; flash: (m: string) => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("teams").insert({
      room_id: room.id,
      name: name.trim(),
      colour: PALETTE[teams.length % PALETTE.length],
      route: clues.map((c) => c.id), // default: everyone runs the full route in order
    });
    setBusy(false);
    if (error) return flash(error.message);
    setName("");
    refresh();
    flash("Team added with the default route");
  }

  async function patch(id: string, p: Partial<Team>) {
    const { error } = await supabase.from("teams").update(p).eq("id", id);
    if (error) return flash(error.message);
    refresh();
    flash("Saved");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return flash(error.message);
    refresh();
    flash("Team removed");
  }

  async function reset(id: string) {
    const { error } = await supabase.rpc("reset_team", { p_team_id: id });
    if (error) return flash(error.message);
    flash("Run reset — points cleared");
  }

  function shuffledRoute() {
    const ids = clues.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  async function scatterAll() {
    if (clues.length < 2) return flash("Add at least two clues first");
    for (const t of teams) {
      await supabase.from("teams").update({ route: shuffledRoute() }).eq("id", t.id);
    }
    refresh();
    flash("Every team got its own shuffled route");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_290px] lg:items-start">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">The crews</p>
            <h2 className="display mt-1 text-[30px] text-bone">Teams &amp; join codes</h2>
          </div>
          <button onClick={scatterAll} className="pill-ghost">Shuffle routes per team</button>
        </div>

        <form onSubmit={addTeam} className="paper mt-5 flex flex-wrap gap-3 p-4">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Team name — e.g. Tokyo" className="field min-w-[200px] flex-1" />
          <button disabled={busy || !name.trim()} className="pill-red shrink-0">+ Add team</button>
        </form>

        <ul className="mt-4 space-y-3">
          {teams.map((t) => {
            const routeNames = t.route
              .map((id) => clues.find((c) => c.id === id))
              .filter(Boolean) as Clue[];
            return (
              <li key={t.id} className="paper overflow-hidden">
                <button onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left">
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: t.colour }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[17px] uppercase text-bone">{t.name}</span>
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-bone/35">
                      {routeNames.length} clue route
                    </span>
                  </span>
                  <code className="shrink-0 rounded-full bg-gold px-3 py-1.5 font-mono text-[13px] tracking-[0.2em] text-ink">
                    {t.join_code}
                  </code>
                  <span className="shrink-0 text-bone/30">{openId === t.id ? "▴" : "▾"}</span>
                </button>

                {openId === t.id && (
                  <div className="border-t border-ink-line bg-ink/40 p-5">
                    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
                      <div>
                        <label className="label">Team name</label>
                        <input
                          defaultValue={t.name}
                          onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && patch(t.id, { name: e.target.value.trim() })}
                          className="field"
                        />
                      </div>
                      <div>
                        <label className="label">Bonus / penalty</label>
                        <input
                          type="number" defaultValue={t.bonus_points}
                          onBlur={(e) => patch(t.id, { bonus_points: Number(e.target.value) || 0 })}
                          className="field w-32"
                        />
                      </div>
                      <div>
                        <label className="label">Colour</label>
                        <div className="flex gap-1.5">
                          {PALETTE.map((c) => (
                            <button key={c} onClick={() => patch(t.id, { colour: c })}
                              className={`h-8 w-8 rounded-full ring-2 transition ${t.colour === c ? "ring-bone" : "ring-transparent"}`}
                              style={{ background: c }} aria-label={c} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5">
                      <label className="label">Route — the order this team walks the clues</label>
                      <ol className="space-y-1.5">
                        {routeNames.map((c, i) => (
                          <li key={c.id} className="flex items-center gap-3 rounded-lg bg-ink px-3 py-2">
                            <span className="font-mono text-[11px] text-bone/35">{i + 1}</span>
                            <span className="min-w-0 flex-1 truncate text-[13px] text-bone/80">{c.title}</span>
                            <span className="truncate font-mono text-[9px] text-bone/25">{c.location_label}</span>
                            <button
                              onClick={() => patch(t.id, { route: t.route.filter((x) => x !== c.id) })}
                              className="shrink-0 font-mono text-[10px] text-dali-soft hover:underline"
                            >remove</button>
                          </li>
                        ))}
                        {routeNames.length === 0 && (
                          <li className="rounded-lg border border-dali/40 bg-dali/10 px-3 py-3 text-[12px] text-dali-soft">
                            No route — this team can&apos;t start.
                          </li>
                        )}
                      </ol>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {clues.filter((c) => !t.route.includes(c.id)).map((c) => (
                          <button key={c.id} onClick={() => patch(t.id, { route: [...t.route, c.id] })}
                            className="chip hover:border-gold/60 hover:text-gold">+ {c.title}</button>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => patch(t.id, { route: clues.map((c) => c.id) })} className="pill-ghost">
                          Use full route in order
                        </button>
                        <button onClick={() => patch(t.id, { route: shuffledRoute() })} className="pill-ghost">
                          Shuffle this team
                        </button>
                        <button onClick={() => reset(t.id)} className="pill-ghost !text-gold">Reset run</button>
                        <button onClick={() => remove(t.id)} className="pill-ghost ml-auto !text-dali-soft">Delete team</button>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {teams.length === 0 && (
            <li className="paper px-6 py-16 text-center">
              <p className="eyebrow">No crews yet</p>
              <p className="mt-3 text-[13px] text-bone/45">
                Add a team and hand its six-character code to the players.
              </p>
            </li>
          )}
        </ul>
      </div>

      <aside className="paper p-6">
        <p className="eyebrow">Codes to hand out</p>
        <div className="mt-4 rounded-xl bg-bone p-5 text-ink">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">Room code — everyone</p>
          <p className="display mt-1 text-[34px] tracking-[0.1em]">{room.code}</p>
        </div>
        <ul className="mt-3 space-y-1.5">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg bg-ink px-3 py-2">
              <span className="h-2 w-2 rounded-full" style={{ background: t.colour }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-bone/70">{t.name}</span>
              <code className="font-mono text-[12px] tracking-[0.15em] text-gold">{t.join_code}</code>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[10px] leading-relaxed text-bone/35">
          Different teams can walk the same clues in different orders — that stops
          crews from simply following each other around.
        </p>
      </aside>
    </div>
  );
}
