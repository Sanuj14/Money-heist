"use client";

import { useEffect, useState } from "react";
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

  /* Escape closes; body scroll locks while open. */
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setConfirming(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [confirming, busy]);

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
    <>
      <div className="paper overflow-hidden">
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
      </div>

      {/* Rendered outside the card: a fixed, centred dialog can't be clipped by
          the card's height or overlap the cards beside it. */}
      {confirming && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink/90 p-4 backdrop-blur-sm"
          onClick={() => { if (!busy) setConfirming(false); }}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="paper my-auto w-full max-w-md animate-rise border-dali/40 p-6 sm:p-7"
          >
            <p className="eyebrow !text-dali-soft">This cannot be undone</p>
            <h2 className="display mt-2 text-[24px] text-bone">Delete {room.name}?</h2>

            <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-bone/55">
              <li>· Every clue, and the QR tokens printed for them</li>
              <li>· Every crew and their join codes</li>
              <li>· All scans, points, challenges and standings</li>
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-bone/40">
              Printed QR codes for this room stop working immediately.
            </p>

            <div className="mt-5">
              <label className="label">Type <span className="text-gold">{room.code}</span> to confirm</label>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase())}
                placeholder={room.code}
                autoFocus
                className="field text-center font-mono uppercase tracking-[0.3em]"
              />
            </div>

            {err && (
              <p className="mt-3 rounded-lg border border-dali/40 bg-dali/10 px-3 py-2 text-[12px] text-dali-soft">
                {err}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirming(false)} disabled={busy} className="pill-ghost flex-1">
                Cancel
              </button>
              <button
                onClick={remove}
                disabled={busy || typed !== room.code}
                className="pill-red flex-1"
              >
                {busy ? "Deleting…" : "Delete room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
