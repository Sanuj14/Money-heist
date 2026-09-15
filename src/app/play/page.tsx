import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JoinForm from "./JoinForm";
import { Nav } from "@/components/Nav";

export default async function PlayEntry() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/play");

  // already on a team in a room that hasn't ended? jump straight back in
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, rooms:room_id(status)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active =
    membership && (membership as any).rooms && (membership as any).rooms.status !== "ended";

  return (
    <div className="min-h-screen">
      <Nav
        back={{ href: "/", label: "Home" }}
        right={
          <form action="/auth/signout" method="post">
            <button className="pill-ghost">Sign out</button>
          </form>
        }
      />
      <JoinForm email={user.email ?? ""} resumeTeamId={active ? (membership as any).team_id : null} />
    </div>
  );
}
