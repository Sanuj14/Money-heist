"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomTeamOption } from "@/lib/types";

export interface JoinSelection {
  roomCode: string;
  roomName: string | null;
  teamId: string;
  teamName: string | null;
  teamCode: string;
  requireCode: boolean;
  ready: boolean;
}

/**
 * Room code first, then the crew's own code (or a picker when the marshal
 * has turned the code requirement off). Reports the resolved selection up.
 */
export function JoinTarget({ onChange }: { onChange: (s: JoinSelection) => void }) {
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState<string | null>(null);
  const [requireCode, setRequireCode] = useState(true);
  const [teams, setTeams] = useState<RoomTeamOption[]>([]);

  const [teamCode, setTeamCode] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamColour, setTeamColour] = useState("#E63329");

  const [roomBusy, setRoomBusy] = useState(false);
  const [teamBusy, setTeamBusy] = useState(false);
  const [roomErr, setRoomErr] = useState<string | null>(null);

  /* ---- room code ---- */
  const lookupRoom = useCallback(async (code: string) => {
    setRoomBusy(true); setRoomErr(null);
    const supabase = createClient();
    const { data } = await supabase.rpc("room_public_info", { p_room_code: code });
    const room = data?.[0];
    setRoomBusy(false);
    if (!room) { setRoomName(null); setTeams([]); return; }
    if (room.status === "ended") {
      setRoomName(null); setTeams([]);
      setRoomErr("That heist has already wrapped.");
      return;
    }
    setRoomName(room.name);
    const needs = room.require_team_code !== false;
    setRequireCode(needs);
    if (!needs) {
      const { data: list } = await supabase.rpc("list_room_teams", { p_room_code: code });
      setTeams((list as RoomTeamOption[]) ?? []);
    } else {
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    setTeamId(""); setTeamName(null);
    if (roomCode.trim().length < 4) { setRoomName(null); setTeams([]); return; }
    const t = setTimeout(() => lookupRoom(roomCode.trim()), 350);
    return () => clearTimeout(t);
  }, [roomCode, lookupRoom]);

  /* ---- team code ---- */
  const lookupTeam = useCallback(async (room: string, code: string) => {
    setTeamBusy(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("peek_team", { p_room_code: room, p_team_code: code });
    const t = data?.[0];
    setTeamBusy(false);
    if (!t) { setTeamId(""); setTeamName(null); return; }
    setTeamId(t.team_id); setTeamName(t.name); setTeamColour(t.colour);
  }, []);

  useEffect(() => {
    if (!requireCode || !roomName) return;
    if (teamCode.trim().length < 4) { setTeamId(""); setTeamName(null); return; }
    const t = setTimeout(() => lookupTeam(roomCode.trim(), teamCode.trim()), 350);
    return () => clearTimeout(t);
  }, [teamCode, roomCode, roomName, requireCode, lookupTeam]);

  /* ---- report upward ---- */
  useEffect(() => {
    onChange({
      roomCode: roomCode.trim(),
      roomName,
      teamId,
      teamName,
      teamCode: teamCode.trim(),
      requireCode,
      ready: Boolean(roomName && teamId),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, roomName, teamId, teamName, teamCode, requireCode]);

  return (
    <>
      {/* step 1 — the building */}
      <div>
        <label className="label">Room code</label>
        <input
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 8))}
          placeholder="——————"
          maxLength={8}
          autoFocus
          className="field-code !text-xl"
        />
        <p className="mt-1.5 min-h-[16px] font-mono text-[10px] uppercase tracking-[0.16em]">
          {roomBusy && <span className="text-bone/35">Checking…</span>}
          {!roomBusy && roomName && <span className="text-mint">✓ {roomName}</span>}
          {!roomBusy && roomErr && <span className="text-dali-soft">{roomErr}</span>}
          {!roomBusy && !roomName && !roomErr && roomCode.trim().length >= 4 && (
            <span className="text-dali-soft">No heist under that code</span>
          )}
        </p>
      </div>

      {/* step 2 — the crew */}
      {roomName && requireCode && (
        <div className="animate-rise">
          <label className="label">Your team code</label>
          <input
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="——————"
            maxLength={8}
            className="field-code !text-xl"
          />
          <p className="mt-1.5 min-h-[16px] font-mono text-[10px] uppercase tracking-[0.16em]">
            {teamBusy && <span className="text-bone/35">Checking…</span>}
            {!teamBusy && teamName && (
              <span className="inline-flex items-center gap-2 text-mint">
                <span className="h-2 w-2 rounded-full" style={{ background: teamColour }} />
                ✓ {teamName}
              </span>
            )}
            {!teamBusy && !teamName && teamCode.trim().length >= 4 && (
              <span className="text-dali-soft">Not a valid code for this room</span>
            )}
            {!teamBusy && !teamName && teamCode.trim().length < 4 && (
              <span className="text-bone/30">The marshal gave your crew its own code</span>
            )}
          </p>
        </div>
      )}

      {/* picker fallback when the marshal has the code requirement off */}
      {roomName && !requireCode && teams.length > 0 && (
        <div className="animate-rise">
          <label className="label">Your crew</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((t) => (
              <button
                key={t.team_id}
                type="button"
                onClick={() => { setTeamId(t.team_id); setTeamName(t.name); }}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  teamId === t.team_id ? "border-gold bg-gold/10" : "border-ink-line bg-ink hover:border-bone/30"
                }`}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.colour }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[15px] uppercase text-bone">{t.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/35">
                    {t.members} member{t.members === 1 ? "" : "s"}
                  </span>
                </span>
                {teamId === t.team_id && <span className="text-gold">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {roomName && !requireCode && teams.length === 0 && (
        <p className="rounded-lg border border-gold/40 bg-gold/10 px-4 py-3 text-[12px] text-gold">
          No crews have been set up in this room yet. Ask the marshal to add them.
        </p>
      )}
    </>
  );
}
