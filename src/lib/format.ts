export function mmss(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function pointsAt(elapsed: number, limit: number, base: number, floorPct: number, timeoutPts: number) {
  if (limit <= 0) return base;
  if (elapsed >= limit) return timeoutPts;
  const floor = base * (floorPct / 100);
  return Math.round(floor + (base - floor) * (1 - elapsed / limit));
}
