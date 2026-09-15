import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import JoinForm from "./JoinForm";
import { ResumeBanner } from "@/components/ResumeBanner";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function PlayEntry() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/play");

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
      {/* ResumeBanner handles the "already mid-run" case on its own */}
      <ResumeBanner className="px-4 pt-6" />
      <JoinForm email={user.email ?? ""} />
    </div>
  );
}
