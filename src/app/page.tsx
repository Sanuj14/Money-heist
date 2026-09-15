import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Polaroid, StickyNote } from "@/components/Polaroid";
import { Mask } from "@/components/Brand";
import { createClient } from "@/lib/supabase/server";

export default async function Landing() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <Nav
        links={[
          { href: "/play", label: "Join a heist" },
          { href: "/board", label: "Leaderboard" },
          { href: "/admin", label: "Admin" },
        ]}
        right={
          user ? (
            <>
              <Link href="/play" className="pill-gold">Play</Link>
              <form action="/auth/signout" method="post">
                <button className="pill-ghost">Sign out</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="pill-red">Sign in</Link>
          )
        }
      />

      {/* ---------------- HERO (bone band) ---------------- */}
      <section className="px-3 pt-6 sm:px-6">
        <div className="paper-bone relative mx-auto max-w-7xl overflow-hidden px-5 py-14 sm:px-12 sm:py-20">
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <p className="eyebrow !text-ink/50">Round 02 · Campus edition</p>
            <h1 className="display mt-4 text-[13vw] text-ink sm:text-[86px]">
              A HEIST OF WITS
              <br />
              <span className="text-dali">STARTS HERE</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg font-body text-[15px] leading-relaxed text-ink/65">
              Scan the QR. Crack the clue. Beat the twenty-minute clock. Every second
              you shave off is a credit in the vault — and the leaderboard is watching.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/play" className="pill-red !px-7 !py-3.5">Enter room code</Link>
              <Link href="/board" className="pill-ghost !border-ink/25 !text-ink/70 !px-7 !py-3.5">
                Watch the board
              </Link>
            </div>
          </div>

          {/* scattered evidence-board props */}
          <div className="pointer-events-none mt-12 flex flex-wrap items-start justify-center gap-6 sm:mt-4 sm:gap-10">
            <Polaroid caption="Drop point · Library steps" rotate={-5} tone="red">
              <Mask className="h-16 w-16 opacity-90" />
            </Polaroid>
            <StickyNote rotate={2} className="mt-6">
              <b className="block font-display text-[13px] uppercase">Rule one</b>
              Twenty minutes a clue. The clock never stops — not for arguments,
              not for snacks.
            </StickyNote>
            <Polaroid caption="Exhibit B · The vault QR" rotate={4} tone="ink">
              <div className="grid grid-cols-5 gap-[3px]">
                {Array.from({ length: 25 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-3.5 w-3.5 rounded-[2px]"
                    style={{ background: [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,12,17].includes(i) ? "#F4F0E4" : "transparent" }}
                  />
                ))}
              </div>
            </Polaroid>
          </div>
        </div>
      </section>

      {/* ---------------- RED BAND ---------------- */}
      <section className="px-3 py-6 sm:px-6">
        <div
          className="relative mx-auto max-w-7xl overflow-hidden rounded-[18px] px-5 py-14 sm:px-12"
          style={{
            background: "#E63329",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.10) 1px,transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        >
          <h2 className="display mx-auto max-w-3xl text-center text-[9vw] text-white sm:text-[58px]">
            Four moves. One vault.
          </h2>

          <ol className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["01", "Sign in", "Email magic link. No passwords to forget mid-chase."],
              ["02", "Two codes", "Room code gets you in the building. Team code puts you on the crew."],
              ["03", "Scan & run", "Camera opens in-browser. Right QR, right order, points banked."],
              ["04", "Bank credits", "Faster scans pay more. Miss the window and the next clue drops anyway."],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-[14px] bg-ink/90 p-5">
                <div className="font-mono text-[11px] tracking-[0.3em] text-gold">{n}</div>
                <div className="display mt-2 text-[20px] text-bone">{t}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-bone/55">{d}</p>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link href="/play" className="pill-bone !px-8 !py-3.5">I&apos;m a player</Link>
            <Link href="/admin" className="pill !bg-ink !text-bone !px-8 !py-3.5 hover:!bg-ink-soft">
              I&apos;m running the round
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- SCORING ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="paper p-7 sm:p-10">
            <p className="eyebrow">How credits are counted</p>
            <h3 className="display mt-3 text-[34px] text-bone sm:text-[42px]">
              The clock <span className="text-dali">is</span> the score
            </h3>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-bone/55">
              Each clue is worth a base pot — 1000 credits by default. That pot decays
              in a straight line across the twenty-minute window down to a floor the admin
              sets. Scan on minute one and you take almost everything. Scan at 19:58 and
              you still walk away with the floor. Let the window lapse and you take the
              timeout value, but the next clue unlocks regardless, so nobody gets stranded.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Linear decay", "Admin-tunable floor", "Per-clue overrides", "Auto-advance on timeout"].map((c) => (
                <span key={c} className="chip">{c}</span>
              ))}
            </div>
          </div>

          <div className="paper relative overflow-hidden p-7 sm:p-10">
            <p className="eyebrow">Decay curve</p>
            <svg viewBox="0 0 320 180" className="mt-4 w-full">
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E63329" stopOpacity=".5" />
                  <stop offset="100%" stopColor="#E63329" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1="34" x2="310" y1={20 + i * 30} y2={20 + i * 30} stroke="#3A322E" strokeWidth="1" />
              ))}
              <path d="M34 20 L300 125 L300 140 L34 140 Z" fill="url(#g)" />
              <path d="M34 20 L300 125" stroke="#E63329" strokeWidth="3" fill="none" strokeLinecap="round" />
              <line x1="300" y1="125" x2="310" y2="140" stroke="#F5C542" strokeWidth="3" strokeDasharray="4 3" />
              <text x="4" y="24" fill="#F4F0E4" fontSize="9" fontFamily="monospace">1000</text>
              <text x="8" y="129" fill="#F4F0E4" fontSize="9" fontFamily="monospace">250</text>
              <text x="30" y="158" fill="#8b8179" fontSize="9" fontFamily="monospace">0:00</text>
              <text x="270" y="158" fill="#8b8179" fontSize="9" fontFamily="monospace">20:00</text>
            </svg>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-bone/35">
              Gold dash = timeout value
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-line py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bone/30">
          Bella ciao · Hunt for Money Round
        </p>
      </footer>
    </div>
  );
}
