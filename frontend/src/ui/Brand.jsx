// FusionAI logo — "The Fusion Point": three asymmetric strokes (the sources)
// converging into one sealed oxblood dot (the cited answer). Strokes inherit
// currentColor (ink) so the mark adapts; the seal stays oxblood.

export function FusionMark({ size = 28, className = '', title = 'FusionAI' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none"
      role="img" aria-label={title} className={className}>
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="6" y1="7" x2="17" y2="22.5" />
        <line x1="16" y1="4.5" x2="17" y2="22.5" />
        <line x1="27" y1="9" x2="17" y2="22.5" />
      </g>
      <circle cx="17" cy="23" r="3.1" fill="#c4402e" />
    </svg>
  )
}

export function Wordmark({ size = 27, className = '', text = true }) {
  return (
    <span className={`inline-flex items-center gap-2.5 select-none text-ink ${className}`}>
      <FusionMark size={size} />
      {text && <span className="font-serif text-[1.35rem] font-semibold leading-none tracking-tight text-ink">FusionAI</span>}
    </span>
  )
}
