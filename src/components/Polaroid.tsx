export function Polaroid({
  caption,
  rotate = -3,
  tone = "red",
  children,
  className = "",
}: {
  caption: string;
  rotate?: number;
  tone?: "red" | "gold" | "ink";
  children?: React.ReactNode;
  className?: string;
}) {
  const bg =
    tone === "red"
      ? "linear-gradient(135deg,#E63329,#B01C15)"
      : tone === "gold"
      ? "linear-gradient(135deg,#F5C542,#D9A521)"
      : "linear-gradient(135deg,#2A2422,#14110F)";
  return (
    <figure
      className={`taped w-[190px] sm:w-[230px] ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div
        className="grid h-[130px] w-full place-items-center overflow-hidden sm:h-[155px]"
        style={{ background: bg }}
      >
        {children}
      </div>
      <figcaption className="absolute bottom-2 left-0 right-0 px-3 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-ink/60">
        {caption}
      </figcaption>
    </figure>
  );
}

export function StickyNote({
  children,
  rotate = -2,
  className = "",
}: {
  children: React.ReactNode;
  rotate?: number;
  className?: string;
}) {
  return (
    <div
      className={`sticky-note relative w-[190px] p-4 pt-6 text-[11px] leading-relaxed ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span className="absolute -top-2 left-1/2 h-4 w-10 -translate-x-1/2 rounded-sm bg-ink/80" />
      {children}
    </div>
  );
}
