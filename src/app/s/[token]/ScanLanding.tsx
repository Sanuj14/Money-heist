"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mask } from "@/components/Brand";
import type { ScanResult } from "@/lib/types";

export default function ScanLanding({ teamId, token }: { teamId: string; token: string }) {
  const router = useRouter();
  const [res, setRes] = useState<ScanResult | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("submit_scan", { p_team_id: teamId, p_token: token });
      setRes(error ? { ok: false, message: error.message.replace(/^.*?:\s*/, "") } : (data as ScanResult));
      setTimeout(() => router.push(`/play/${teamId}`), 2200);
    })();
  }, [teamId, token, router]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <Mask className="mx-auto h-16 w-16" />
        {!res ? (
          <p className="eyebrow mt-6">Verifying the drop point…</p>
        ) : res.ok ? (
          <>
            <div className="display mt-6 text-[64px] leading-none text-gold">+{res.points}</div>
            <p className="mt-2 text-[14px] text-bone/60">Banked. Taking you to the next clue…</p>
          </>
        ) : (
          <>
            <p className="display mt-6 text-[24px] text-dali">Not this one</p>
            <p className="mt-2 max-w-xs text-[14px] text-bone/60">{res.message}</p>
          </>
        )}
      </div>
    </main>
  );
}
