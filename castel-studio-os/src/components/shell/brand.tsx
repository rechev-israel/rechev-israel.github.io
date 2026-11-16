export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#0a0a0b" stroke="#c9a44c" strokeWidth="1.5" />
      <path d="M26.5 13.5a8 8 0 1 0 0 13" fill="none" stroke="#c9a44c" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 9.5h12M14 30.5h12" stroke="#c9a44c" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function Wordmark({ sub }: { sub?: string }) {
  return (
    <div className="leading-tight">
      <div className="font-display text-[15px] font-bold tracking-[0.18em] gold-text">CASTEL STUDIO</div>
      {sub && <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{sub}</div>}
    </div>
  );
}
