"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Room } from "@/lib/types";

interface Ping {
  user_id: string;
  team_id: string;
  team_name: string;
  team_colour: string;
  player_email: string | null;
  lat: number;
  lng: number;
  accuracy_m: number | null;
  source: "ping" | "scan";
  created_at: string;
}

const STALE_AFTER_MS = 2 * 60 * 1000;

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function LocationsTab({
  room,
  flash,
}: {
  room: Room;
  flash: (m: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [pings, setPings] = useState<Ping[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState<Ping | null>(null);
  const [loading, setLoading] = useState(true);

  const pull = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_room_locations", { p_room_id: room.id });
    setLoading(false);
    if (error) {
      flash(
        /could not find the function|schema cache/i.test(error.message)
          ? "Run supabase/migration-004-locations.sql first"
          : error.message
      );
      return;
    }
    setPings((data as Ping[]) ?? []);
  }, [supabase, room.id, flash]);

  useEffect(() => { pull(); }, [pull]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    const p = setInterval(pull, 15000);
    return () => { clearInterval(t); clearInterval(p); };
  }, [pull]);

  useEffect(() => {
    const ch = supabase
      .channel(`locations:${room.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "player_pings", filter: `room_id=eq.${room.id}` },
        () => pull())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, room.id, pull]);

  async function clearAll() {
    const { error } = await supabase.rpc("clear_room_locations", { p_room_id: room.id });
    if (error) return flash(error.message);
    setPings([]); setFocus(null);
    flash("Location history wiped");
  }

  /* group by crew */
  const crews = useMemo(() => {
    const m = new Map<string, { name: string; colour: string; players: Ping[] }>();
    for (const p of pings) {
      if (!m.has(p.team_id)) m.set(p.team_id, { name: p.team_name, colour: p.team_colour, players: [] });
      m.get(p.team_id)!.players.push(p);
    }
    return [...m.entries()];
  }, [pings]);

  const live = pings.filter((p) => now - new Date(p.created_at).getTime() < STALE_AFTER_MS).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Marshals only</p>
            <h2 className="display mt-1 text-[30px] text-bone">Where the crews are</h2>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-bone/50">
              Positions update while a player has the clue screen open. Phones report
              nothing once locked or switched away — browsers don&apos;t allow
              background location, so a stale reading means pocketed, not lost.
            </p>
          </div>
          <button onClick={clearAll} className="pill-ghost !text-dali-soft hover:!border-dali/50">
            Wipe history
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Players reporting" value={pings.length} />
          <Stat label="Fresh (under 2 min)" value={live} />
          <Stat label="Crews seen" value={crews.length} />
        </div>

        {loading && <p className="eyebrow py-16 text-center">Reading positions…</p>}

        {!loading && crews.length === 0 && (
          <div className="paper mt-4 px-6 py-16 text-center">
            <p className="eyebrow">No positions yet</p>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-bone/45">
              Players report once they&apos;re on the clue screen with the round live
              and they&apos;ve allowed location on their phone.
            </p>
          </div>
        )}

        <ul className="mt-4 space-y-3">
          {crews.map(([teamId, crew]) => (
            <li key={teamId} className="paper p-5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: crew.colour }} />
                <h3 className="display flex-1 text-[19px] text-bone">{crew.name}</h3>
                <span className="chip">{crew.players.length} reporting</span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {crew.players.map((p) => {
                  const stale = now - new Date(p.created_at).getTime() >= STALE_AFTER_MS;
                  return (
                    <li key={p.user_id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink px-3 py-2">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${stale ? "bg-bone/25" : "bg-mint"}`} />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-bone/75">
                        {p.player_email ?? "player"}
                      </span>
                      {p.source === "scan" && <span className="chip !py-0.5 !text-[9px]">at scan</span>}
                      <span className="font-mono text-[10px] text-bone/35">
                        ±{p.accuracy_m ? Math.round(p.accuracy_m) : "?"}m
                      </span>
                      <span className={`font-mono text-[10px] ${stale ? "text-bone/25" : "text-mint"}`}>
                        {ago(p.created_at, now)}
                      </span>
                      <button onClick={() => setFocus(p)} className="chip hover:!border-gold/60 hover:!text-gold">
                        Map
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <aside className="paper overflow-hidden lg:sticky lg:top-40">
        {focus ? (
          <>
            <div className="border-b border-ink-line p-4">
              <p className="eyebrow">{focus.team_name}</p>
              <p className="mt-1 truncate text-[13px] text-bone/70">{focus.player_email ?? "player"}</p>
              <p className="mt-1 font-mono text-[10px] text-bone/35">
                {focus.lat.toFixed(5)}, {focus.lng.toFixed(5)} · ±
                {focus.accuracy_m ? Math.round(focus.accuracy_m) : "?"}m · {ago(focus.created_at, now)}
              </p>
            </div>
            <iframe
              title="Player location"
              className="h-[320px] w-full border-0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${focus.lng - 0.002}%2C${focus.lat - 0.0015}%2C${focus.lng + 0.002}%2C${focus.lat + 0.0015}&layer=mapnik&marker=${focus.lat}%2C${focus.lng}`}
            />
            <div className="p-4">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${focus.lat},${focus.lng}`}
                target="_blank"
                rel="noreferrer"
                className="pill-gold w-full"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </>
        ) : (
          <div className="px-6 py-20 text-center">
            <p className="eyebrow">Pick a player to map them</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="paper p-4">
      <p className="eyebrow">{label}</p>
      <p className="display mt-1 text-[26px] text-bone">{value}</p>
    </div>
  );
}
