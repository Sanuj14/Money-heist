export function Mask({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <path d="M32 4c-9 0-16 4-16 4v22c0 16 10 26 16 30 6-4 16-14 16-30V8s-7-4-16-4z" fill="#E63329" />
      <path d="M32 12c-5 0-9 2-9 2v6h18v-6s-4-2-9-2z" fill="#14110F" opacity=".85" />
      <circle cx="24" cy="30" r="4" fill="#14110F" />
      <circle cx="40" cy="30" r="4" fill="#14110F" />
      <path d="M24 44c4 3 12 3 16 0" stroke="#14110F" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Mask />
      <div className="leading-none">
        <div className="display text-[17px] text-bone">MONEY HEIST</div>
        {!compact && (
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-gold">
            Hunt for Money
          </div>
        )}
      </div>
    </div>
  );
}
