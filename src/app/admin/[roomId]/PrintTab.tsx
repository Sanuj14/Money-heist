"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, Clue, Team } from "@/lib/types";

export default function PrintTab({
  room, clues, teams,
}: {
  room: Room; clues: Clue[]; teams: Team[];
}) {
  const [mode, setMode] = useState<"token" | "url">("token");
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="eyebrow">Field kit</p>
          <h2 className="display mt-1 text-[30px] text-bone">Print &amp; tape</h2>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-bone/50">
            One card per clue. Cut them out and tape each one at the place that
            clue describes — not at the place it&apos;s handed out.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-ink-line p-1">
            <button onClick={() => setMode("token")} className={`tabbtn ${mode === "token" ? "tabbtn-on" : ""}`}>Token</button>
            <button onClick={() => setMode("url")} className={`tabbtn ${mode === "url" ? "tabbtn-on" : ""}`}>URL</button>
          </div>
          <button onClick={() => window.print()} className="pill-gold">Print sheet</button>
        </div>
      </div>

      <p className="mt-3 rounded-lg border border-ink-line bg-ink p-3 font-mono text-[10px] leading-relaxed text-bone/40 print:hidden">
        {mode === "token"
          ? "Token mode: the QR holds just the code. Players scan it inside the app — safest, nothing leaks if a QR is photographed."
          : `URL mode: the QR holds ${site}/s/<token>, so any phone camera opens the app. Convenient, but the token is visible in the address bar.`}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
        {clues.map((c, i) => (
          <QrCard
            key={c.id}
            index={i + 1}
            clue={c}
            room={room}
            value={mode === "token" ? c.qr_token : `${site}/s/${c.qr_token}`}
          />
        ))}
        {clues.length === 0 && (
          <p className="paper col-span-full px-6 py-16 text-center eyebrow">
            Write some clues first
          </p>
        )}
      </div>

      {/* team code slips */}
      {teams.length > 0 && (
        <>
          <h3 className="display mt-12 text-[24px] text-bone print:mt-8 print:text-ink">Team code slips</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 print:grid-cols-3">
            {teams.map((t) => (
              <div key={t.id} className="rounded-[14px] bg-bone p-5 text-center text-ink">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/45">Room</p>
                <p className="font-mono text-[16px] tracking-[0.25em]">{room.code}</p>
                <p className="display mt-3 text-[20px]">{t.name}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/45">Team code</p>
                <p className="display text-[30px] tracking-[0.15em] text-dali">{t.join_code}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <style jsx global>{`
        @media print {
          body { background: #fff !important; }
          header, nav, .print\\:hidden { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function QrCard({
  index, clue, room, value,
}: {
  index: number; clue: Clue; room: Room; value: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        if (dead || !ref.current) return;
        await QRCode.toCanvas(ref.current, value, {
          width: 320, margin: 1,
          color: { dark: "#14110F", light: "#FFFFFF" },
          errorCorrectionLevel: "M",
        });
      } catch { if (!dead) setErr(true); }
    })();
    return () => { dead = true; };
  }, [value]);

  function download() {
    const url = ref.current?.toDataURL("image/png");
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${room.code}-clue${index}-${clue.qr_token}.png`;
    a.click();
  }

  return (
    <div className="qr-card rounded-[14px] bg-bone p-5 text-ink">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
          {room.code} · clue {index}
        </span>
        <span className="display text-[16px] text-dali">#{index}</span>
      </div>
      <p className="display mt-1 truncate text-[17px]">{clue.title}</p>
      {clue.location_label && (
        <p className="mt-0.5 truncate font-mono text-[10px] text-ink/50">
          Tape at: {clue.location_label}
        </p>
      )}

      <div className="mt-3 grid place-items-center rounded-lg bg-white p-3">
        {err ? (
          <p className="py-10 text-center font-mono text-[10px] text-ink/40">QR failed to render</p>
        ) : (
          <canvas ref={ref} className="h-auto w-full max-w-[220px]" />
        )}
      </div>

      <p className="mt-2 break-all text-center font-mono text-[10px] tracking-[0.1em] text-ink/60">
        {clue.qr_token}
      </p>
      <button onClick={download} className="mt-3 w-full rounded-full bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-bone print:hidden">
        Download PNG
      </button>
    </div>
  );
}
