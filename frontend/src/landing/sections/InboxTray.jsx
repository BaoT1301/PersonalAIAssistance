import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Icon } from '../../ui/Icon'
import { Reveal, MagneticButton, StaggerGroup, staggerItem, EASE } from '../../ui/motion'

const DOCS = [
  { file: 'merger-agreement.pdf', icon: 'picture_as_pdf', stamp: '01' },
  { file: 'q3-brief.docx', icon: 'description', stamp: '02' },
  { file: 'field-notes.txt', icon: 'article', stamp: '03' },
]

export default function InboxTray() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  return (
    <section className="px-5 sm:px-8 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-2 lg:gap-12">
        <Reveal className="flex flex-col justify-center">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink text-balance">
            Turn a PDF into an <em className="not-italic ruled">expert</em> you can interrogate.
          </h2>
          <p className="mt-6 max-w-xl font-sans text-lg text-muted leading-relaxed">
            Drop in a contract, a paper, a pile of meeting notes. Ask it anything. FusionAI
            reads your files, searches Wikipedia and the open web alongside them, and writes
            one answer grounded in your own text, cited line by line.
          </p>
          <div className="mt-9">
            <MagneticButton
              onClick={() => navigate('/research')}
              ariaLabel="Upload a document"
              className="bg-accent text-on-accent rounded-md px-6 py-3.5 text-base font-semibold inline-flex items-center gap-2">
              <Icon name="attach_file" size={18} />
              Upload a document
            </MagneticButton>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="relative flex items-end justify-center lg:justify-end">
          <div className="relative w-full max-w-sm pt-16">
            {/* Chips settle into the tray from above */}
            <StaggerGroup className="relative z-10 flex flex-col gap-3 px-2">
              {DOCS.map((doc, i) => (
                <motion.div
                  key={doc.file}
                  variants={
                    reduce
                      ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
                      : {
                          hidden: { opacity: 0, y: -30 },
                          show: {
                            opacity: 1,
                            y: 0,
                            transition: { duration: 0.55, ease: EASE, delay: i * 0.12 },
                          },
                        }
                  }
                  className="group relative flex items-center gap-3 rounded-md border border-line bg-paper px-4 py-3 shadow-paper">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-paper-2 text-ink-soft">
                    <Icon name={doc.icon} size={16} />
                  </span>
                  <span className="font-mono text-[13px] text-ink-soft truncate">{doc.file}</span>
                  <motion.span
                    initial={reduce ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: reduce ? 0 : i * 0.12 + 0.45, ease: EASE }}
                    className="ml-auto font-mono text-[10px] tracking-[0.14em] text-faint border border-line-strong rounded-sm px-1.5 py-0.5">
                    {doc.stamp}
                  </motion.span>
                </motion.div>
              ))}
            </StaggerGroup>

            {/* Perforated tear between chips and tray */}
            <div className="tearline mt-4 h-0.5 w-full" />

            {/* The in-tray */}
            <div className="relative mt-0 rounded-b-lg rounded-t-sm border border-line bg-paper-2">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <Icon name="tray" size={16} className="text-muted" />
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                  In tray
                </span>
              </div>
              <div className="h-16 bg-paper-3/60" />
              {/* front lip */}
              <div className="h-3 rounded-b-lg border-t border-line-strong bg-paper-3" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
