import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../../ui/Icon'
import { MagneticButton, EASE } from '../../ui/motion'

const RECEIPTS = [
  {
    q: 'How does quantum entanglement work?',
    lines: [
      'Two particles share one quantum state, so measuring',
      'one instantly fixes the other regardless of distance.',
      'It moves correlation, not information, so nothing',
      'outruns the speed of light.',
    ],
    cites: ['en.wikipedia.org', 'plato.stanford.edu', 'nature.com'],
  },
  {
    q: 'What triggered the 2008 financial crisis?',
    lines: [
      'A housing bubble built on subprime mortgages',
      'collapsed. Those loans were bundled into securities',
      'rated far too safe, so losses cascaded through',
      'the over-leveraged banks that held them.',
    ],
    cites: ['federalreserve.gov', 'imf.org', 'en.wikipedia.org'],
  },
  {
    q: 'Explain CRISPR gene editing simply.',
    lines: [
      'A guide RNA finds a target DNA sequence and the',
      'Cas9 protein cuts it there. The cell repairs the',
      'break, letting researchers disable, fix, or insert',
      'a gene with real precision.',
    ],
    cites: ['nih.gov', 'broadinstitute.org', 'en.wikipedia.org'],
  },
]

// The signature interaction: type a question, a receipt prints down the page,
// its cited sources tear off as stubs, and a VERIFIED stamp thuds onto it.
function ReceiptMachine() {
  const reduce = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [typed, setTyped] = useState(0)
  const [printed, setPrinted] = useState(0)
  const [stubs, setStubs] = useState(0)
  const [stamped, setStamped] = useState(false)
  const r = RECEIPTS[idx]

  useEffect(() => {
    if (reduce) {
      setTyped(r.q.length); setPrinted(r.lines.length); setStubs(r.cites.length); setStamped(true)
      const t = setTimeout(() => reset(), 5200)
      return () => clearTimeout(t)
    }
    let alive = true
    const timers = []
    setTyped(0); setPrinted(0); setStubs(0); setStamped(false)
    // type the question
    r.q.split('').forEach((_, i) => timers.push(setTimeout(() => alive && setTyped(i + 1), 32 * i)))
    let t = r.q.length * 32 + 420
    // print answer lines
    r.lines.forEach((_, i) => { const at = t + i * 300; timers.push(setTimeout(() => alive && setPrinted(i + 1), at)) })
    t += r.lines.length * 300 + 180
    // tear off source stubs
    r.cites.forEach((_, i) => { const at = t + i * 200; timers.push(setTimeout(() => alive && setStubs(i + 1), at)) })
    t += r.cites.length * 200 + 260
    // stamp
    timers.push(setTimeout(() => alive && setStamped(true), t))
    // next
    timers.push(setTimeout(() => alive && reset(), t + 3200))
    return () => { alive = false; timers.forEach(clearTimeout) }
    function reset() { setIdx(i => (i + 1) % RECEIPTS.length) }
  }, [idx, reduce])

  return (
    <div className="relative">
      {/* printer frame */}
      <div className="rounded-lg border border-line-strong bg-paper-2 p-3 shadow-lift">
        {/* composer / slot */}
        <div className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-3.5 py-3">
          <Icon name="search" style={{ color: '#c4402e', fontSize: '18px' }} />
          <span className="flex-1 font-sans text-[0.95rem] text-ink">
            {r.q.slice(0, typed)}
            {typed < r.q.length && <span className="ml-px inline-block h-4 w-px animate-pulse bg-accent align-middle" />}
          </span>
          <span className="grid h-7 w-7 place-items-center rounded bg-accent text-on-accent">
            <Icon name="arrow_forward" style={{ fontSize: '15px' }} />
          </span>
        </div>

        {/* the printed receipt */}
        <div className="relative mt-3 overflow-hidden rounded-md border border-line bg-paper px-4 pt-3 pb-4">
          <div className="tearline h-1 -mx-4 mb-3" />
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
            <span>Fusion Research Receipt</span>
            <span>No. {String(idx + 1).padStart(4, '0')}</span>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">Q. {r.q}</p>
          <div className="tearline my-3 h-0.5" />
          <div className="min-h-[92px] font-sans text-[0.9rem] leading-relaxed text-ink">
            {r.lines.slice(0, printed).map((line, i) => (
              <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                {line}
                {i === r.lines.length - 1 && printed === r.lines.length && <sup className="ml-0.5 font-mono text-accent">1</sup>}
              </motion.div>
            ))}
          </div>
          <div className="tearline my-3 h-0.5" />
          {/* tear-off source stubs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">sources</span>
            {r.cites.slice(0, stubs).map((c, i) => (
              <motion.span
                key={c}
                initial={reduce ? false : { opacity: 0, x: -8, rotate: -4 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-line-strong bg-paper-2 px-2 py-1 font-mono text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />{c}
              </motion.span>
            ))}
          </div>

          {/* VERIFIED stamp */}
          <AnimatePresence>
            {stamped && (
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 1.5, rotate: -14 }}
                animate={{ opacity: 1, scale: 1, rotate: -9 }}
                transition={{ type: 'spring', stiffness: 320, damping: 15 }}
                className="pointer-events-none absolute bottom-4 right-4 select-none">
                <span className="font-serif text-lg font-semibold uppercase tracking-[0.2em]"
                  style={{ color: '#c4402e', border: '2.5px solid #c4402e', borderRadius: 6, padding: '2px 10px', opacity: 0.85 }}>
                  Verified
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  const navigate = useNavigate()
  return (
    <section className="relative px-5 pt-32 pb-20 sm:px-8 md:pt-40 md:pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05, ease: EASE }}
            className="mb-7 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Cited answers, printed on demand
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
            className="font-serif text-[3.25rem] font-semibold leading-[0.98] tracking-tight text-ink text-balance sm:text-6xl md:text-7xl">
            Ask anything.<br />Get answers with <em className="not-italic ruled">receipts</em>.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.26, ease: EASE }}
            className="mt-7 max-w-xl font-sans text-lg leading-relaxed text-muted">
            FusionAI reads Wikipedia and the open web in parallel, then prints one cited answer where every claim links back to a source you can check.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-3">
            <MagneticButton onClick={() => navigate('/research')} ariaLabel="Start researching free"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3.5 font-sans text-base font-semibold text-on-accent">
              Start researching free
              <Icon name="arrow_forward" style={{ fontSize: '18px' }} />
            </MagneticButton>
            <a href="#how" className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-paper px-6 py-3.5 font-sans text-base font-medium text-ink transition-colors hover:border-ink/40">
              See how it works
            </a>
          </motion.div>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Free to start. No credit card.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.28, ease: EASE }}
          className="lg:col-span-6">
          <ReceiptMachine />
        </motion.div>
      </div>
    </section>
  )
}
