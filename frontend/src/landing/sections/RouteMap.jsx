import { motion, useReducedMotion } from 'motion/react'
import { Icon } from '../../ui/Icon'
import { Reveal, StaggerGroup, staggerItem, EASE } from '../../ui/motion'

// Diagram geometry, in SVG user units (viewBox 0 0 VB_W VB_H).
const VB_W = 720
const VB_H = 280
const LEFT_X = 178
const RIGHT_X = 500
const NODE_Y = { top: 50, mid: 140, bottom: 230 }

const pct = (v, dim) => `${(v / dim) * 100}%`

const NODES = [
  { key: 'wikipedia', icon: 'public', label: 'Wikipedia', y: NODE_Y.top },
  { key: 'web', icon: 'language', label: 'The open web', y: NODE_Y.mid },
  { key: 'files', icon: 'description', label: 'Your files', y: NODE_Y.bottom },
]

const PATHS = [
  { key: 'p-top', d: `M${LEFT_X},${NODE_Y.top} C 340,${NODE_Y.top} 340,${NODE_Y.mid} ${RIGHT_X},${NODE_Y.mid}`, delay: 0 },
  { key: 'p-mid', d: `M${LEFT_X},${NODE_Y.mid} C 300,${NODE_Y.mid} 380,${NODE_Y.mid} ${RIGHT_X},${NODE_Y.mid}`, delay: 0.18 },
  { key: 'p-bottom', d: `M${LEFT_X},${NODE_Y.bottom} C 340,${NODE_Y.bottom} 340,${NODE_Y.mid} ${RIGHT_X},${NODE_Y.mid}`, delay: 0.36 },
]

const STEPS = [
  { index: '01', title: 'Ask', body: 'Type a question in plain language. No special syntax needed.' },
  { index: '02', title: 'Cross-check', body: 'It searches Wikipedia and the open web in parallel, then reads your uploaded files.' },
  { index: '03', title: 'Cite', body: 'Every claim in the answer links back to exactly where it came from.' },
]

export default function RouteMap() {
  const reduce = useReducedMotion()

  return (
    <section className="px-5 sm:px-8 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">How it works</p>
            <h2 className="mt-4 text-balance font-serif text-4xl font-semibold tracking-tight text-ink md:text-5xl">
              Three sources in. <em className="not-italic ruled">One</em> cited answer out.
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-14 md:mt-20">
          <div className="rounded-lg border border-line bg-paper-2 px-5 py-12 sm:px-10 sm:py-14">
            <div className="relative w-full">
              <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                width="100%"
                preserveAspectRatio="xMidYMid meet"
                className="block h-auto w-full"
                aria-hidden="true">
                {PATHS.map((p) =>
                  reduce ? (
                    <path
                      key={p.key}
                      d={p.d}
                      fill="none"
                      stroke="#1a1613"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      pathLength={1}
                      style={{ strokeDasharray: 1, strokeDashoffset: 0 }}
                    />
                  ) : (
                    <motion.path
                      key={p.key}
                      d={p.d}
                      fill="none"
                      stroke="#1a1613"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      pathLength={1}
                      style={{ strokeDasharray: 1 }}
                      initial={{ strokeDashoffset: 1, opacity: 0.35 }}
                      whileInView={{ strokeDashoffset: 0, opacity: 1 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 1.1, ease: EASE, delay: p.delay }}
                    />
                  )
                )}

                {NODES.map((n) => (
                  <circle key={n.key} cx={LEFT_X} cy={n.y} r={3.2} fill="#1a1613" />
                ))}
                <circle cx={RIGHT_X} cy={NODE_Y.mid} r={4.5} fill="#c4402e" />
              </svg>

              <div className="absolute inset-0">
                {NODES.map((n) => (
                  <div
                    key={n.key}
                    className="absolute flex items-center gap-2 sm:gap-2.5"
                    style={{ left: 0, top: pct(n.y, VB_H), transform: 'translateY(-50%)' }}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-line bg-paper text-ink-soft sm:h-7 sm:w-7">
                      <Icon name={n.icon} size={15} />
                    </span>
                    <span className="whitespace-nowrap font-mono text-[11px] text-ink-soft sm:text-[13px]">
                      {n.label}
                    </span>
                  </div>
                ))}

                <div
                  className="absolute flex items-center gap-2 sm:gap-3"
                  style={{ left: pct(RIGHT_X + 16, VB_W), top: pct(NODE_Y.mid, VB_H), transform: 'translateY(-50%)' }}>
                  <span className="whitespace-nowrap font-mono text-[12px] font-medium text-ink sm:text-sm">
                    One cited answer
                  </span>
                  <span className="-rotate-[8deg] whitespace-nowrap rounded-sm border border-accent/50 px-1.5 py-0.5 font-serif text-[9px] font-semibold uppercase tracking-[0.14em] text-accent sm:text-[10px]">
                    Verified
                  </span>
                </div>
              </div>

              <p className="sr-only">
                Diagram: Wikipedia, the open web, and your files each converge into one cited answer.
              </p>
            </div>
          </div>
        </Reveal>

        <StaggerGroup className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-8 md:mt-20 md:gap-10">
          {STEPS.map((step) => (
            <motion.div key={step.index} variants={staggerItem} className="border-t border-line pt-5">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] text-faint">{step.index}</span>
                <h3 className="font-serif text-xl font-semibold text-ink">{step.title}</h3>
              </div>
              <p className="mt-2 max-w-xs font-sans text-sm leading-relaxed text-muted">{step.body}</p>
            </motion.div>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
