"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room, Clue } from "@/lib/types";

export default function CluesTab({
  room, clues, refresh, flash,
}: {
  room: Room; clues: Clue[]; refresh: () => void; flash: (m: string) => void;
}) {
  const supabase = createClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addClue() {
    setBusy(true);
    const { data, error } = await supabase
      .from("clues")
      .insert({
        room_id: room.id,
        order_index: clues.length,
        title: `Clue ${clues.length + 1}`,
        body: "",
      })
      .select("id")
      .single();
    setBusy(false);
    if (error) return flash(error.message);
    refresh();
    setOpenId(data.id);
  }

  async function save(id: string, patch: Partial<Clue>) {
    const { error } = await supabase.from("clues").update(patch).eq("id", id);
    if (error) return flash(error.message);
    refresh();
    flash("Saved");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("clues").delete().eq("id", id);
    if (error) return flash(error.message);
    refresh();
    flash("Clue deleted");
  }

  async function move(index: number, dir: -1 | 1) {
    const other = index + dir;
    if (other < 0 || other >= clues.length) return;
    const a = clues[index], b = clues[other];
    await supabase.from("clues").update({ order_index: b.order_index }).eq("id", a.id);
    await supabase.from("clues").update({ order_index: a.order_index }).eq("id", b.id);
    refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_290px] lg:items-start">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Clue bank</p>
            <h2 className="display mt-1 text-[30px] text-bone">Write the route</h2>
          </div>
          <button onClick={addClue} disabled={busy} className="pill-red">+ Add clue</button>
        </div>

        <ul className="mt-6 space-y-3">
          {clues.map((c, i) => (
            <li key={c.id} className="paper overflow-hidden">
              <button
                onClick={() => setOpenId(openId === c.id ? null : c.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <span className="display w-8 shrink-0 text-[22px] text-bone/25">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[16px] uppercase text-bone">
                    {c.title}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-bone/35">
                    {c.location_label || "no drop-point note"} · {c.qr_token}
                  </span>
                </span>
                {!c.body && <span className="chip !border-dali/50 !text-dali-soft">empty</span>}
                <span className="shrink-0 text-bone/30">{openId === c.id ? "▴" : "▾"}</span>
              </button>

              {openId === c.id && (
                <ClueEditor
                  clue={c}
                  room={room}
                  onSave={(p) => save(c.id, p)}
                  onDelete={() => remove(c.id)}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  first={i === 0}
                  last={i === clues.length - 1}
                />
              )}
            </li>
          ))}
          {clues.length === 0 && (
            <li className="paper px-6 py-16 text-center">
              <p className="eyebrow">No clues yet</p>
              <p className="mt-3 text-[13px] text-bone/45">
                Every clue carries its own QR token. Print it, tape it where the
                clue points, and scanning it unlocks the next one.
              </p>
            </li>
          )}
        </ul>
      </div>

      <aside className="paper p-6">
        <p className="eyebrow">How a clue works</p>
        <ol className="mt-4 space-y-4 text-[13px] leading-relaxed text-bone/55">
          <li><b className="text-bone">1.</b> The <b className="text-gold">body</b> is what the team reads — it should point at a physical place.</li>
          <li><b className="text-bone">2.</b> The <b className="text-gold">QR token</b> for this clue gets printed and taped at that place.</li>
          <li><b className="text-bone">3.</b> Scanning it banks the points for this clue and reveals the next one.</li>
          <li><b className="text-bone">4.</b> The <b className="text-gold">hint</b> auto-unlocks halfway through the window.</li>
        </ol>
        <p className="mt-5 rounded-lg border border-ink-line bg-ink p-3 font-mono text-[10px] leading-relaxed text-bone/40">
          Clue text never reaches a player&apos;s browser until it&apos;s their turn —
          it&apos;s served through a locked-down database function, so nobody can
          read ahead from devtools.
        </p>
      </aside>
    </div>
  );
}

function ClueEditor({
  clue, room, onSave, onDelete, onUp, onDown, first, last,
}: {
  clue: Clue; room: Room;
  onSave: (p: Partial<Clue>) => void; onDelete: () => void;
  onUp: () => void; onDown: () => void; first: boolean; last: boolean;
}) {
  const [f, setF] = useState({
    title: clue.title,
    body: clue.body,
    location_label: clue.location_label ?? "",
    hint: clue.hint ?? "",
    points: clue.points?.toString() ?? "",
    time_limit_sec: clue.time_limit_sec?.toString() ?? "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <div className="border-t border-ink-line bg-ink/40 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Title</label>
          <input value={f.title} onChange={set("title")} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Clue text — what the team reads</label>
          <textarea value={f.body} onChange={set("body")} rows={4}
            placeholder="Where the ink runs dry and the third floor sleeps, the professor left something behind the eighth spine."
            className="field resize-y" />
        </div>
        <div>
          <label className="label">Drop-point note (admin only)</label>
          <input value={f.location_label} onChange={set("location_label")}
            placeholder="Library, 3rd floor, shelf 8B" className="field" />
        </div>
        <div>
          <label className="label">Hint (unlocks at halfway)</label>
          <input value={f.hint} onChange={set("hint")} placeholder="Think Dewey, not Dali." className="field" />
        </div>
        <div>
          <label className="label">Points override</label>
          <input value={f.points} onChange={set("points")} type="number" inputMode="numeric"
            placeholder={`default ${room.base_points}`} className="field" />
        </div>
        <div>
          <label className="label">Time limit override (seconds)</label>
          <input value={f.time_limit_sec} onChange={set("time_limit_sec")} type="number" inputMode="numeric"
            placeholder={`default ${room.time_limit_sec}`} className="field" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">QR token — printed and taped at the drop point</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-ink-line bg-ink px-4 py-3 font-mono text-[13px] text-gold">
              {clue.qr_token}
            </code>
            <button
              onClick={() => { navigator.clipboard?.writeText(clue.qr_token); }}
              className="pill-ghost shrink-0"
            >Copy</button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onSave({
            title: f.title.trim() || "Untitled clue",
            body: f.body,
            location_label: f.location_label.trim() || null,
            hint: f.hint.trim() || null,
            points: f.points ? Number(f.points) : null,
            time_limit_sec: f.time_limit_sec ? Number(f.time_limit_sec) : null,
          })}
          className="pill-gold"
        >Save clue</button>
        <button onClick={onUp} disabled={first} className="pill-ghost">↑</button>
        <button onClick={onDown} disabled={last} className="pill-ghost">↓</button>
        <button onClick={onDelete} className="pill-ghost ml-auto !text-dali-soft hover:!border-dali/50">
          Delete
        </button>
      </div>
    </div>
  );
}
