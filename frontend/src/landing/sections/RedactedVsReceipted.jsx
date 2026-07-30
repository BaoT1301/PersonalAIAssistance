import { motion, useReducedMotion } from 'motion/react'
import { Reveal, StaggerGroup, staggerItem, EASE } from '../../ui/motion'

const QUESTION = 'What is the termination fee in this contract?'

// A blacked-out fragment: the real words sit in the DOM, but a solid ink bar
// covers them. On first scroll into view the bar wipes in from the left,
// like a censor's marker landing on the page.
function RedactBar({ children, delay = 0 }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className="inline-block rounded-sm bg-ink px-1 text-transparent select-none"
      style={{ transformOrigin: '0% 50%' }}
      initial={reduce ? false : { scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: EASE }}>
      {children}
    </motion.span>
  )
}

function SourceStub({ n, label }) {
  return (
    <div className="flex items-center gap-2.5 font-mono text-xs text-ink-soft">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span className="text-faint">{n}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}

export default function RedactedVsReceipted() {
  const reduce = useReducedMotion()
  const hover = reduce ? undefined : { y: -4, transition: { duration: 0.3, ease: EASE } }

  return (
    <section className="px-5 sm:px-8 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="md:flex md:items-end md:justify-between md:gap-10">
            <h2 className="max-w-xl font-serif text-4xl font-semibold tracking-tight text-balance text-ink md:text-5xl">
              Most AI asks you to <em className="not-italic ruled">just trust it.</em>
            </h2>
            <p className="mt-4 max-w-xs font-mono text-sm text-muted md:mt-0 md:text-right">
              Same question, asked twice. Only one answer holds up.
            </p>
          </div>
        </Reveal>

        <StaggerGroup className="mt-14 grid gap-6 md:mt-16 md:gap-8 lg:grid-cols-2">
          {/* LEFT, typical AI: confident, unsourced, and quietly evasive */}
          <motion.div
            variants={staggerItem}
            whileHover={hover}
            className="flex flex-col rounded-lg border border-line bg-paper-2 p-7 md:p-8">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                Typical AI
              </span>
              <p className="mt-5 font-sans text-base font-medium text-ink-soft md:text-lg">
                &ldquo;{QUESTION}&rdquo;
              </p>
            </div>

            <div className="mt-6 h-px border-t border-line" />

            <p className="mt-6 font-sans text-lg leading-relaxed text-ink-soft">
              The termination fee equals <RedactBar delay={0}>15 percent</RedactBar> of the
              remaining contract value, due within <RedactBar delay={0.12}>thirty days</RedactBar> of
              written notice, unless the termination is{' '}
              <RedactBar delay={0.24}>for cause</RedactBar>.
            </p>

            <div className="mt-auto pt-8">
              <div className="mb-4 h-px border-t border-line" />
              <p className="font-mono text-[11px] text-faint">0 sources. Just trust me.</p>
            </div>
          </motion.div>

          {/* RIGHT, FusionAI: same answer, fully spelled out, every claim sourced */}
          <motion.div
            variants={staggerItem}
            whileHover={hover}
            className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-paper-2 p-7 pt-8 shadow-paper md:p-8 md:pt-9">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-accent" aria-hidden="true" />

            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                FusionAI
              </span>
              <span className="rotate-[-8deg] rounded-sm border border-accent/70 px-2 py-0.5 font-serif text-[11px] font-semibold tracking-[0.25em] text-accent select-none">
                VERIFIED
              </span>
            </div>

            <p className="mt-5 font-sans text-base font-medium text-ink md:text-lg">
              &ldquo;{QUESTION}&rdquo;
            </p>

            <div className="mt-6 h-px tearline" />

            <p className="mt-6 font-sans text-lg leading-relaxed text-ink">
              The termination fee equals 15 percent<sup className="font-mono text-accent">1</sup> of
              the remaining contract value, due within thirty days
              <sup className="font-mono text-accent">1</sup> of written notice, unless the
              termination is for cause<sup className="font-mono text-accent">2</sup>.
            </p>

            <div className="mt-auto pt-8">
              <div className="mb-4 h-0.5 tearline" />
              <div className="space-y-2.5">
                <SourceStub n="1" label="merger-agreement.pdf, p.18" />
                <SourceStub n="2" label="en.wikipedia.org" />
              </div>
            </div>
          </motion.div>
        </StaggerGroup>
      </div>
    </section>
  )
}
