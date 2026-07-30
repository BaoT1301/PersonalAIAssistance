import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Reveal, MagneticButton, StaggerGroup, staggerItem } from '../../ui/motion'
import { Wordmark } from '../../ui/Brand'

const FOOTER_COLUMNS = [
  { title: 'Product', links: ['Features', 'Document upload', 'Research app'] },
  { title: 'Resources', links: ['How it works', 'Trust', 'Status'] },
  { title: 'Company', links: ['About', 'Contact', 'Privacy'] },
]

export default function FinalCtaFooter() {
  const navigate = useNavigate()

  return (
    <>
      {/* Final CTA (the tear-off stub) */}
      <section className="px-5 sm:px-8 py-24 md:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl">
            <div className="relative bg-paper-2 border border-line rounded-lg px-8 py-14 sm:px-14 sm:py-16 text-center">
              <span
                className="tearline absolute inset-x-6 top-0 h-0.5 -translate-y-1/2 sm:inset-x-10"
                aria-hidden="true"
              />
              <span
                className="tearline absolute inset-x-6 bottom-0 h-0.5 translate-y-1/2 sm:inset-x-10"
                aria-hidden="true"
              />

              <h2 className="font-serif text-4xl md:text-5xl font-semibold tracking-tight text-ink text-balance">
                Your next question deserves a <em className="not-italic ruled">real</em> answer.
              </h2>

              <p className="mt-5 font-sans text-lg text-muted leading-relaxed">
                Free to start. No credit card, no tab hoarding.
              </p>

              <div className="mt-9 flex justify-center">
                <MagneticButton
                  onClick={() => navigate('/research')}
                  ariaLabel="Start researching free"
                  className="bg-accent text-on-accent rounded-md px-6 py-3.5 text-base font-semibold"
                >
                  Start researching free
                </MagneticButton>
              </div>

              <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                Admit one / No. 0001
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer (the filing cabinet) */}
      <footer className="px-5 sm:px-8 pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="border-t border-line pt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8">
            <div className="sm:col-span-3 md:col-span-1">
              <Wordmark size={24} />
              <p className="mt-3 font-sans text-sm text-muted max-w-xs">
                One search. Every source. One cited answer.
              </p>
            </div>

            <StaggerGroup className="contents">
              {FOOTER_COLUMNS.map((col) => (
                <motion.div key={col.title} variants={staggerItem}>
                  <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                    {col.title}
                  </h3>
                  <ul className="mt-4 space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link}>
                        <a
                          href="#"
                          className="font-sans text-sm text-muted hover:text-ink transition-colors"
                        >
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </StaggerGroup>
          </div>

          <div className="mt-14 border-t border-line pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-xs text-faint">Built with React, FastAPI, and LangChain.</p>
            <p className="font-mono text-xs text-faint">© 2026 FusionAI.</p>
          </div>
        </div>
      </footer>
    </>
  )
}
