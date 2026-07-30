// Reusable Paper Trail primitives, shared by the research app surfaces.

export function TearLine({ className = '', thick = false }) {
  return <div className={`tearline ${thick ? 'h-1' : 'h-0.5'} w-full ${className}`} aria-hidden="true" />
}

// A rubber-stamp badge. Reserve the accent tone for genuine "VERIFIED"/"LIVE"
// moments; use ink for neutral labels.
export function Stamp({ label, tone = 'accent', rotate = -7, className = '', style }) {
  const color = tone === 'ink' ? '#1a1613' : tone === 'muted' ? '#6f675b' : '#c4402e'
  return (
    <span
      className={`inline-block select-none whitespace-nowrap font-serif text-[11px] font-semibold uppercase tracking-[0.2em] ${className}`}
      style={{ color, border: `2px solid ${color}`, borderRadius: 5, padding: '2px 9px', transform: `rotate(${rotate}deg)`, opacity: 0.9, ...style }}>
      {label}
    </span>
  )
}

// A tear-off citation stub: accent dot + optional numeral + mono domain/filename.
export function SourceStub({ n, label, href, snippet, className = '' }) {
  const inner = (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] leading-relaxed text-muted transition-colors group-hover/stub:text-ink">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      {n != null && <span className="shrink-0 text-faint">{n}</span>}
      <span className="truncate">{label}</span>
    </span>
  )
  const cls = `group/stub block max-w-full ${className}`
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={snippet || label}>{inner}</a>
    : <span className={cls} title={snippet || label}>{inner}</span>
}

// A ledger line: hairline-ruled row with an optional running mono index.
export function LedgerRow({ index, children, className = '', onClick, title }) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={`flex items-center gap-3 border-b border-line py-3 ${onClick ? 'cursor-pointer transition-colors hover:bg-paper-2/60' : ''} ${className}`}>
      {index != null && <span className="w-6 shrink-0 font-mono text-[11px] text-faint">{index}</span>}
      {children}
    </div>
  )
}

// Base flat card used across Library, topic cards, source panels.
export function IndexCard({ children, className = '', as: As = 'div', ...rest }) {
  return <As className={`rounded-md border border-line bg-paper-2 ${className}`} {...rest}>{children}</As>
}
