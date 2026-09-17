"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GeoStatus = "idle" | "asking" | "on" | "denied" | "unavailable" | "error";

export interface GeoState {
  status: GeoStatus;
  lastAt: number | null;
  accuracy: number | null;
  message: string | null;
}

/**
 * Shares the player's position with the marshals while the clue screen is open.
 *
 * Browsers do not allow background geolocation — updates stop as soon as the
 * page is hidden. We therefore pause the watch on visibilitychange rather than
 * pretending to track, and resume when they come back.
 *
 * Writes go through record_ping(), which is throttled server-side. Nothing is
 * readable by the player: the table has no select policy for them.
 */
export function useGeoPing(teamId: string, enabled: boolean) {
  const [state, setState] = useState<GeoState>({
    status: "idle", lastAt: null, accuracy: null, message: null,
  });
  const latest = useRef<GeoolocationLite | null>(null);
  const watchId = useRef<number | null>(null);
  const sending = useRef(false);

  const send = useCallback(
    async (coords: GeoolocationLite, source: "ping" | "scan") => {
      if (sending.current && source !== "scan") return;
      sending.current = true;
      try {
        const supabase = createClient();
        await supabase.rpc("record_ping", {
          p_team_id: teamId,
          p_lat: coords.lat,
          p_lng: coords.lng,
          p_accuracy: coords.accuracy,
          p_source: source,
        });
        setState((s) => ({ ...s, lastAt: Date.now(), accuracy: coords.accuracy }));
      } catch {
        /* a dropped ping is not worth interrupting the game for */
      } finally {
        sending.current = false;
      }
    },
    [teamId]
  );

  /* Called by the scan handler so a scan always carries a position. */
  const pingNow = useCallback(async () => {
    if (latest.current) await send(latest.current, "scan");
  }, [send]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((s) => ({ ...s, status: "unavailable", message: "This device has no location support." }));
      return;
    }

    setState((s) => ({ ...s, status: "asking" }));

    const start = () => {
      if (watchId.current !== null) return;
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const c = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? null,
          };
          latest.current = c;
          setState((s) => ({ ...s, status: "on", accuracy: c.accuracy, message: null }));
          send(c, "ping");
        },
        (err) => {
          setState({
            status: err.code === err.PERMISSION_DENIED ? "denied" : "error",
            lastAt: null,
            accuracy: null,
            message:
              err.code === err.PERMISSION_DENIED
                ? "Location is off. Marshals can't see your crew."
                : "Couldn't get a location fix right now.",
          });
        },
        { enableHighAccuracy: true, maximumAge: 20000, timeout: 25000 }
      );
    };

    const stop = () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [enabled, send]);

  return { ...state, pingNow };
}

interface GeoolocationLite {
  lat: number;
  lng: number;
  accuracy: number | null;
}
