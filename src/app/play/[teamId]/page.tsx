import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import GameClient from "./GameClient";

export default async function PlayRound({ params }: { params: { teamId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/play/${params.teamId}`);

  const { data: team } = await supabase
    .from("teams")
    .select("id, name, colour, room_id, rooms:room_id(code, name, status)")
    .eq("id", params.teamId)
    .maybeSingle();

  if (!team) notFound();
  const room = (team as any).rooms;

  return (
    <GameClient
      teamId={team.id}
      teamName={team.name}
      teamColour={team.colour}
      roomId={team.room_id}
      roomCode={room.code}
      roomName={room.name}
    />
  );
}
