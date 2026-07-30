import { motion, useReducedMotion } from 'motion/react'
import { Reveal, staggerItem } from '../../ui/motion'

// Container variants for the word-by-word pull-quote reveal. Each child uses
// the shared `staggerItem` (fade + rise), this just staggers their entrance.
const wordsContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.08 } },
}

export default function TrustStatement() {
  const reduce = useReducedMotion()

  return (
    <section className="px-5 sm:px-8 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="h-0.5 tearline" />
        </Reveal>

        <Reveal delay={0.05} className="mx-auto max-w-3xl py-16 text-center md:py-24">
          <motion.blockquote
            className="m-0 text-balance font-serif text-4xl font-semibold leading-[1.15] tracking-tight text-ink md:text-6xl"
            initial={reduce ? false : 'hidden'}
            whileInView="show"
            viewport={{ once: true, margin: '-90px' }}
            variants={wordsContainer}>
            <motion.span variants={staggerItem} className="inline-block">
              Every
            </motion.span>{' '}
            <motion.span variants={staggerItem} className="inline-block">
              claim
            </motion.span>{' '}
            <motion.span variants={staggerItem} className="inline-block">
              gets
            </motion.span>{' '}
            <motion.span variants={staggerItem} className="inline-block">
              <em className="not-italic ruled">a name and a page number</em>.
            </motion.span>
          </motion.blockquote>

          <p className="mx-auto mt-8 max-w-md font-mono text-sm leading-relaxed text-muted md:mt-10 md:text-[15px]">
            FusionAI never hands you a claim without linking it straight back to the page it came from.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="h-0.5 tearline" />
        </Reveal>
      </div>
    </section>
  )
}
