import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { EASE } from '../ui/motion'
import { Wordmark } from '../ui/Brand'
import Hero from './sections/Hero'
import TrustStatement from './sections/TrustStatement'
import RouteMap from './sections/RouteMap'
import Corkboard from './sections/Corkboard'
import InboxTray from './sections/InboxTray'
import RedactedVsReceipted from './sections/RedactedVsReceipted'
import FinalCtaFooter from './sections/FinalCtaFooter'

function TopNav() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const links = [
    { label: 'How it works', href: '#how' },
    { label: 'Proof', href: '#proof' },
    { label: 'Why FusionAI', href: '#why' },
  ]
  return (
    <motion.header
      initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      style={scrolled
        ? { background: 'color-mix(in oklab, #fbf8f2 82%, transparent)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #e4dac6' }
        : { borderBottom: '1px solid transparent' }}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="/" aria-label="FusionAI home"><Wordmark /></a>
        <div className="hidden items-center gap-8 md:flex">
          {links.map(l => (
            <a key={l.href} href={l.href} className="font-sans text-sm text-muted transition-colors hover:text-ink">{l.label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/research')} className="hidden px-3 py-2 font-sans text-sm text-muted transition-colors hover:text-ink sm:inline">Sign in</button>
          <button onClick={() => navigate('/research')}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold text-on-accent transition-transform hover:-translate-y-px active:scale-95">
            Start researching
          </button>
        </div>
      </nav>
    </motion.header>
  )
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-paper text-ink antialiased">
      <div className="grain" aria-hidden="true" />
      <div className="relative z-[2]">
        <TopNav />
        <main>
          <Hero />
          <TrustStatement />
          <div id="how"><RouteMap /></div>
          <div id="proof"><Corkboard /></div>
          <InboxTray />
          <div id="why"><RedactedVsReceipted /></div>
          <FinalCtaFooter />
        </main>
      </div>
    </div>
  )
}
