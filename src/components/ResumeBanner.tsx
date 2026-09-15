import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Shows a way back into a run that is still going: the player is on a crew,
 * the room has not ended, and the crew has not cleared its route. Renders
 * nothing otherwise, so it can be dropped onto any page.
 */
export async function ResumeBanner({ className = "" }: { className?: string }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rows } = await supabase
    .from("team_members")
    .select("team_id, teams:team_id(name, colour, rooms:room_id(name, code, status))")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(5);

  if (!rows?.length) return null;

  const live = (rows as any[]).filter(
    (r) => r.teams?.rooms && r.teams.rooms.status !== "ended"
  );
  if (!live.length) return null;

  const teamIds = live.map((r) => r.team_id);
  const { data: progress } = await supabase
    .from("team_progress")
    .select("team_id, finished_at, current_index")
    .in("team_id", teamIds);

  const finished = new Set(
    (progress ?? []).filter((p) => p.finished_at).map((p) => p.team_id)
  );

  const active = live.find((r) => !finished.has(r.team_id));
  if (!active) return null;

  const team = active.teams;
  const room = team.rooms;
  const status: string = room.status;

  return (
    <div className={`mx-auto max-w-2xl ${className}`}>
      <Link
        href={`/play/${active.team_id}`}
        className="paper flex items-center gap-4 p-4 transition hover:border-gold/60 sm:p-5"
      >
        <span className="relative flex h-3 w-3 shrink-0">
          {status === "live" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-dali opacity-70" />
          )}
          <span className="relative inline-flex h-3 w-3 rounded-full"
                style={{ background: team.colour || "#E63329" }} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="eyebrow block">
            {status === "live" ? "Your hunt is running" : status === "paused" ? "Your hunt is paused" : "Your hunt hasn't started"}
          </span>
          <span className="display mt-1 block truncate text-[19px] text-bone">
            {team.name} · {room.name}
          </span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-bone/35">
            Room {room.code}
          </span>
        </span>

        <span className="pill-gold shrink-0 !px-4 !py-2">Resume →</span>
      </Link>
    </div>
  );
}
