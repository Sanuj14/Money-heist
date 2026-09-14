import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ScanLanding from "./ScanLanding";

/** Target of URL-mode QR codes: /s/<token> */
export default async function ScanRoute({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/s/${params.token}`);

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/play");

  return <ScanLanding teamId={membership.team_id} token={params.token.toUpperCase()} />;
}
