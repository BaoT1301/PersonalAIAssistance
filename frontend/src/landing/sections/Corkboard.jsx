import { motion, useReducedMotion } from 'motion/react'
import { Icon } from '../../ui/Icon'
import { Reveal, StaggerGroup, staggerItem, EASE } from '../../ui/motion'

// Four real questions, pinned up with their sources still stapled on. Rotation
// is applied per card so the board reads as scattered, not gridded.
const RECEIPTS = [
  {
    rotate: -2,
    question: 'What is quantum entanglement, really?',
    answer: (
      <>
        Two particles share one quantum state, so measuring one instantly fixes what
        you will find on the other, however far apart they sit.
        <sup className="font-mono text-accent">1</sup> Einstein called the effect
        unsettling and doubted it would hold up.<sup className="font-mono text-accent">2</sup>
      </>
    ),
    sources: ['en.wikipedia.org', 'plato.stanford.edu'],
  },
  {
    rotate: 1.5,
    question: 'What caused the 2008 financial crisis?',
    answer: (
      <>
        Loose mortgage lending inflated a housing bubble, and banks bundled the risky
        loans into securities that spread the losses through the wider financial
        system.<sup className="font-mono text-accent">1</sup> Regulators had
        underestimated how tangled the banks had become.<sup className="font-mono text-accent">2</sup>
      </>
    ),
    sources: ['federalreserve.gov', 'en.wikipedia.org', 'brookings.edu'],
  },
  {
    rotate: -1,
    question: 'How does CRISPR actually edit a gene?',
    answer: (
      <>
        A guide RNA leads the Cas9 enzyme to a matching stretch of DNA, where it cuts
        both strands so the cell's own repair machinery can patch in a change.
        <sup className="font-mono text-accent">1</sup> The system was adapted from a
        bacterial immune defense.<sup className="font-mono text-accent">2</sup>
      </>
    ),
    sources: ['en.wikipedia.org', 'broadinstitute.org'],
  },
  {
    rotate: 2,
    question: 'Why is the sky blue instead of violet?',
    answer: (
      <>
        Air molecules scatter short wavelengths more than long ones, and blue
        scatters more than red.<sup className="font-mono text-accent">1</sup> Our
        eyes are also less sensitive to violet, and the sun emits less of it to
        begin with.<sup className="font-mono text-accent">2</sup>
      </>
    ),
    sources: ['en.wikipedia.org', 'nasa.gov'],
  },
]

function ReceiptCard({ item, index }) {
  const reduce = useReducedMotion()
  const offsetClass = index % 2 === 1 ? 'sm:mt-10 md:mt-14' : ''

  return (
    <motion.div variants={staggerItem} className={offsetClass}>
      <div className="relative pt-3">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <Icon name="pin" size={26} weight="fill" className="text-accent drop-shadow-sm" />
        </div>
        <motion.div
          initial={reduce ? { rotate: 0 } : { rotate: item.rotate }}
          whileHover={reduce ? undefined : { rotate: 0, y: -4 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="relative z-10 rounded-md border border-line bg-paper-2 p-6 pt-9"
        >
          <p className="font-sans text-sm text-ink-soft">{item.question}</p>

          <p className="mt-2.5 font-sans text-sm leading-relaxed text-muted">{item.answer}</p>

          <div className="tearline my-4 h-0.5 w-full" />

          <div className="flex flex-wrap gap-2">
            {item.sources.map((src) => (
              <span
                key={src}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-paper px-2 py-1 font-mono text-[10px] text-muted"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" />
                {src}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function Corkboard() {
  return (
    <section className="px-5 sm:px-8 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="mb-16 max-w-2xl md:mb-20">
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
              Pinned up, not made up
            </p>
            <h2 className="font-serif text-4xl font-semibold tracking-tight text-balance text-ink md:text-5xl">
              <em className="not-italic ruled">Receipts</em> from real questions.
            </h2>
          </div>
        </Reveal>

        <StaggerGroup className="grid grid-cols-1 gap-x-10 gap-y-16 sm:grid-cols-2 md:gap-x-14">
          {RECEIPTS.map((item, i) => (
            <ReceiptCard key={item.question} item={item} index={i} />
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
