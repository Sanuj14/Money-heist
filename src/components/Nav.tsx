import Link from "next/link";
import { Wordmark } from "./Brand";

export function Nav({
  links = [],
  right,
}: {
  links?: { href: string; label: string }[];
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-line bg-ink/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0"><Wordmark /></Link>
        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="tabbtn">{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">{right}</div>
      </div>
    </header>
  );
}
