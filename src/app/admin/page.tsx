import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import NewRoom from "./NewRoom";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, code, name, status, created_at, tagline")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Nav
        right={
          <form action="/auth/signout" method="post">
            <button className="pill-ghost">Sign out</button>
          </form>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <p className="eyebrow">Control room</p>
        <h1 className="display mt-2 text-[44px] text-bone sm:text-[56px]">
          Your heists
        </h1>
        <p className="mt-2 max-w-md text-[14px] text-bone/50">
          Build a room, write the clues, print the QRs, hand out team codes,
          then run the clock from one screen.
        </p>

        <NewRoom />

        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {(rooms ?? []).map((r) => (
            <li key={r.id}>
              <Link href={`/admin/${r.id}`} className="paper block p-6 transition hover:border-gold/50">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
                    {r.code}
                  </span>
                  <span className={`chip ${
                    r.status === "live" ? "!border-mint/50 !text-mint"
                    : r.status === "paused" ? "!border-gold/50 !text-gold"
                    : r.status === "ended" ? "!border-dali/50 !text-dali-soft" : ""
                  }`}>{r.status}</span>
                </div>
                <h2 className="display mt-3 text-[24px] text-bone">{r.name}</h2>
                {r.tagline && <p className="mt-1 text-[13px] text-bone/45">{r.tagline}</p>}
              </Link>
            </li>
          ))}
          {(rooms ?? []).length === 0 && (
            <li className="paper col-span-full px-6 py-14 text-center">
              <p className="eyebrow">No rooms yet — build the first one above</p>
            </li>
          )}
        </ul>
      </main>
    </div>
  );
}
