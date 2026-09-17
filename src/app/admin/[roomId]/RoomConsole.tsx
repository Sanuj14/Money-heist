"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/Brand";
import { BackButton } from "@/components/Nav";
import type { Room, Clue, Team, AdminTeamState } from "@/lib/types";
import CluesTab from "./CluesTab";
import TeamsTab from "./TeamsTab";
import ScoringTab from "./ScoringTab";
import LiveTab from "./LiveTab";
import ChallengesTab from "./ChallengesTab";
import PrintTab from "./PrintTab";
import LocationsTab from "./LocationsTab";

const TABS = ["Live", "Locations", "Clues", "Teams", "Challenges", "Scoring", "QR sheet"] as const;
type Tab = (typeof TABS)[number];

export default function RoomConsole({
  room: initialRoom, initialClues, initialTeams,
}: {
  room: Room; initialClues: Clue[]; initialTeams: Team[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [room, setRoom] = useState(initialRoom);
  const [clues, setClues] = useState(initialClues);
  const [teams, setTeams] = useState(initialTeams);
  const [state, setState] = useState<AdminTeamState[]>([]);
  const [tab, setTab] = useState<Tab>(initialClues.length === 0 ? "Clues" : "Live");
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshClues = useCallback(async () => {
    const { data } = await supabase.from("clues").select("*").eq("room_id", room.id).order("order_index");
    setClues((data ?? []) as Clue[]);
  }, [supabase, room.id]);

  const refreshTeams = useCallback(async () => {
    const { data } = await supabase.from("teams").select("*").eq("room_id", room.id).order("created_at");
    setTeams((data ?? []) as Team[]);
  }, [supabase, room.id]);

  const refreshState = useCallback(async () => {
    const { data } = await supabase.rpc("admin_room_state", { p_room_id: room.id });
    setState((data ?? []) as AdminTeamState[]);
  }, [supabase, room.id]);

  useEffect(() => { refreshState(); }, [refreshState]);

  useEffect(() => {
    const ch = supabase
      .channel(`admin:${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "step_results", filter: `room_id=eq.${room.id}` }, refreshState)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_awards", filter: `room_id=eq.${room.id}` }, refreshState)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_progress", filter: `room_id=eq.${room.id}` }, refreshState)
      .subscribe();
    const poll = setInterval(refreshState, 10000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [supabase, room.id, refreshState]);

  async function setStatus(status: Room["status"]) {
    const { error } = await supabase.rpc("set_room_status", { p_room_id: room.id, p_status: status });
    if (error) { flash(error.message); return; }
    setRoom({ ...room, status });
    refreshState();
    flash(
      status === "live" ? "Heist is live — clocks are running"
      : status === "paused" ? "Paused"
      : status === "ended" ? "Round closed out"
      : "Back to draft"
    );
  }

  const unrouted = teams.filter((t) => t.route.length === 0).length;

  return (
    <div className="min-h-screen pb-20">
      {/* ---- console header ---- */}
      <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/92 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <BackButton href="/admin" label="All rooms" />
            <Link href="/admin"><Wordmark compact /></Link>
            <div className="min-w-0">
              <h1 className="display truncate text-[18px] text-bone">{room.name}</h1>
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-gold">
                Room {room.code}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Link href={`/board/${room.code}`} target="_blank" className="pill-ghost">Board ↗</Link>
              {room.status !== "live" ? (
                <button
                  onClick={() => setStatus("live")}
                  disabled={clues.length === 0 || teams.length === 0 || unrouted > 0}
                  className="pill-red"
                  title={unrouted > 0 ? "Every team needs a route first" : ""}
                >
                  {room.status === "paused" ? "Resume" : "Start heist"}
                </button>
              ) : (
                <button onClick={() => setStatus("paused")} className="pill-gold">Pause</button>
              )}
              {room.status !== "ended" && room.status !== "draft" && (
                <button onClick={() => setStatus("ended")} className="pill-ghost">End</button>
              )}
              <span className={`chip ${
                room.status === "live" ? "!border-mint/50 !text-mint"
                : room.status === "paused" ? "!border-gold/50 !text-gold" : ""
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />{room.status}
              </span>
            </div>
          </div>

          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`tabbtn shrink-0 ${tab === t ? "tabbtn-on" : ""}`}>
                {t}
                {t === "Clues" && clues.length > 0 && <span className="ml-1.5 opacity-50">{clues.length}</span>}
                {t === "Teams" && teams.length > 0 && <span className="ml-1.5 opacity-50">{teams.length}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {unrouted > 0 && teams.length > 0 && (
        <div className="border-b border-gold/30 bg-gold/10 px-4 py-2.5 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-gold">
          {unrouted} team{unrouted > 1 ? "s have" : " has"} no route assigned — the heist can&apos;t start
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
        {tab === "Live" && <LiveTab room={room} state={state} teams={teams} refresh={refreshState} flash={flash} />}
        {tab === "Locations" && <LocationsTab room={room} flash={flash} />}
        {tab === "Clues" && <CluesTab room={room} clues={clues} refresh={refreshClues} flash={flash} />}
        {tab === "Teams" && <TeamsTab room={room} teams={teams} clues={clues} refresh={refreshTeams} flash={flash} />}
        {tab === "Challenges" && <ChallengesTab room={room} teams={teams} flash={flash} refreshState={refreshState} />}
        {tab === "Scoring" && <ScoringTab room={room} setRoom={setRoom} flash={flash} />}
        {tab === "QR sheet" && <PrintTab room={room} clues={clues} teams={teams} />}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise rounded-full bg-bone px-6 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
