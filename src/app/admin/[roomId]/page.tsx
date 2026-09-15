import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import RoomConsole from "./RoomConsole";
import type { Room, Clue, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRoom({ params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/admin/${params.roomId}`);

  const { data: me } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) redirect("/admin/denied");

  const { data: room } = await supabase
    .from("rooms").select("*").eq("id", params.roomId).maybeSingle();
  if (!room || room.owner_id !== user.id) notFound();

  const [{ data: clues }, { data: teams }] = await Promise.all([
    supabase.from("clues").select("*").eq("room_id", room.id).order("order_index"),
    supabase.from("teams").select("*").eq("room_id", room.id).order("created_at"),
  ]);

  return (
    <RoomConsole
      room={room as Room}
      initialClues={(clues ?? []) as Clue[]}
      initialTeams={(teams ?? []) as Team[]}
    />
  );
}
