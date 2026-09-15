import Link from "next/link";
import { Mask } from "@/components/Brand";

export default function Denied() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="paper max-w-md p-9 text-center">
        <Mask className="mx-auto h-14 w-14 opacity-60" />
        <h1 className="display mt-6 text-[30px] text-bone">Control room locked</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-bone/55">
          This account isn&apos;t a marshal. Sign in with the marshal credentials,
          or ask whoever is running the round to grant access.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link href="/login?next=/admin" className="pill-gold">Marshal sign-in</Link>
          <form action="/auth/signout" method="post">
            <button className="pill-ghost">Sign out</button>
          </form>
          <Link href="/play" className="pill-ghost">Go play instead</Link>
        </div>
      </div>
    </main>
  );
}
