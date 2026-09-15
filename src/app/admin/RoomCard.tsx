"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RoomCard({
  room,
}: {
  room: { id: string; code: string; name: string; tagline: string | null; status: string };
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("rooms").delete().eq("id", room.id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="paper relative overflow-hidden">
      <Link href={`/admin/${room.id}`} className="block p-6 transition hover:bg-ink/40">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
            {room.code}
          </span>
          <span className={`chip ${
            room.status === "live" ? "!border-mint/50 !text-mint"
            : room.status === "paused" ? "!border-gold/50 !text-gold"
            : room.status === "ended" ? "!border-dali/50 !text-dali-soft" : ""
          }`}>{room.status}</span>
        </div>
        <h2 className="display mt-3 text-[24px] text-bone">{room.name}</h2>
        {room.tagline && <p className="mt-1 text-[13px] text-bone/45">{room.tagline}</p>}
      </Link>

      <div className="flex items-center justify-end border-t border-ink-line px-4 py-2.5">
        <button
          onClick={() => { setConfirming(true); setTyped(""); setErr(null); }}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone/30 transition hover:text-dali-soft"
        >
          Delete room
        </button>
      </div>

      {confirming && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center gap-3 bg-ink/97 p-6 animate-rise">
          <p className="display text-[17px] text-dali">Delete {room.name}?</p>
          <p className="text-[12px] leading-relaxed text-bone/55">
            This removes the room and everything in it — clues and their QR tokens,
            every crew and join code, all scans, points and challenges. Printed QR
            codes for this room stop working. It cannot be undone.
          </p>
          <div>
            <label className="label">Type the room code to confirm</label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value.toUpperCase())}
              placeholder={room.code}
              autoFocus
              className="field !py-2.5 text-center font-mono uppercase tracking-[0.3em]"
            />
          </div>
          {err && <p className="text-[12px] text-dali-soft">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className="pill-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={remove}
              disabled={busy || typed !== room.code}
              className="pill-red flex-1"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
