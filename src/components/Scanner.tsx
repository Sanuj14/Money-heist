"use client";

import { useEffect, useRef, useState } from "react";

/**
 * In-browser QR scanner. html5-qrcode is loaded lazily so it never lands in
 * the server bundle and never costs a player bytes until they open the camera.
 */
export function Scanner({
  open,
  onClose,
  onToken,
}: {
  open: boolean;
  onClose: () => void;
  onToken: (token: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<any>(null);
  const firedRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    firedRef.current = false;
    setErr(null);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled || !boxRef.current) return;
        const inst = new Html5Qrcode(boxRef.current.id, { verbose: false });
        instRef.current = inst;
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => {
            if (firedRef.current) return;
            firedRef.current = true;
            onToken(normalise(decoded));
          },
          () => {}
        );
      } catch (e: any) {
        if (!cancelled) {
          setErr(
            e?.message?.includes("Permission")
              ? "Camera permission denied. Type the code printed under the QR instead."
              : "Couldn't open the camera on this device. Use the manual code below."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = instRef.current;
      instRef.current = null;
      if (inst) inst.stop().then(() => inst.clear()).catch(() => {});
    };
  }, [open, onToken]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/90 p-3 backdrop-blur-sm sm:items-center">
      <div className="paper w-full max-w-md overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Point at the drop point</p>
          <button onClick={onClose} className="pill-ghost !px-3 !py-1">Close</button>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-xl bg-black">
          <div id="mhh-scanner" ref={boxRef} className="min-h-[260px] w-full [&_video]:!w-full" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-56 w-56 rounded-[18px] border-2 border-gold/70 animate-pulseRing" />
          </div>
        </div>

        {err && (
          <p className="mt-3 rounded-lg border border-dali/40 bg-dali/10 px-3 py-2 text-[12px] text-dali-soft">
            {err}
          </p>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onToken(normalise(manual)); }}
          className="mt-4 flex gap-2"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="or type MHH-XXXXXXXXXX"
            className="field !py-2.5 font-mono text-[13px] uppercase"
          />
          <button className="pill-gold shrink-0">Send</button>
        </form>
      </div>
    </div>
  );
}

/** QRs may hold a bare token or a full /s/<token> URL — accept both. */
function normalise(raw: string) {
  const v = raw.trim();
  const m = v.match(/\/s\/([A-Za-z0-9\-]+)/);
  return (m ? m[1] : v).toUpperCase();
}
