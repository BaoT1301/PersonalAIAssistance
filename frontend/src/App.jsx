import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

// ─── Error Boundary ───────────────────────────────────────────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('App crash:', error, info.componentStack)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0b1326', color: '#dae2fd', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, fontFamily: 'Inter, sans-serif', textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#ffb4ab' }}>error_outline</span>
        <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>Something went wrong</p>
        <p style={{ color: 'rgba(203,195,215,0.6)', maxWidth: 400 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
        <button onClick={() => this.setState({ hasError: false, error: null })}
          style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #d0bcff, #a078ff)', color: '#340080', fontWeight: 700, fontFamily: 'Manrope, sans-serif', cursor: 'pointer', border: 'none' }}>
          Try again
        </button>
      </div>
    )
  }
}

// ─── Icon helper ──────────────────────────────────────────────────────────────

function Icon({ name, className = '', style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

// ─── Auto-growing textarea ──────────────────────────────────────────────────
// Grows with its content (so pasting a long problem expands the box) up to
// maxHeight, then scrolls internally. Enter submits, Shift+Enter inserts a newline.

function AutoGrowTextarea({
  value,
  onChange,
  onSubmit,
  maxHeight = 220,
  minRows = 1,
  className = '',
  style,
  placeholder,
  disabled,
  autoFocus,
  inputRef,
  ariaLabel,
  submitDisabled,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!submitDisabled) onSubmit?.(e)
    }
  }

  return (
    <textarea
      ref={el => { ref.current = el; if (inputRef) inputRef.current = el }}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      rows={minRows}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
      className={`resize-none ${className}`}
      style={style}
    />
  )
}

// ─── Markdown renderer ──────────────────────────────────────────────────────
// Renders assistant answers as rich Markdown. Links open safely in a new tab;
// styling lives in the .fusion-md block in index.css.

function Markdown({ children }) {
  return (
    <div className="fusion-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
        }}>
        {children || ''}
      </ReactMarkdown>
    </div>
  )
}

// ─── Animated Hero Mockup ─────────────────────────────────────────────────────

const DEMO_EXAMPLES = [
  {
    query: 'How does quantum entanglement work?',
    summary: 'Quantum entanglement is a phenomenon where two particles become correlated so that the quantum state of one instantly influences the other — regardless of the distance between them.',
    sources: ['Wikipedia', 'GPT-4o mini', 'Web Search'],
  },
  {
    query: 'What caused the 2008 financial crisis?',
    summary: 'The 2008 crisis stemmed from the collapse of the U.S. housing bubble, driven by risky mortgage-backed securities, lax regulation, and excessive leverage across major financial institutions.',
    sources: ['Wikipedia', 'Web Search'],
  },
  {
    query: 'Explain CRISPR gene editing in simple terms',
    summary: 'CRISPR-Cas9 acts like molecular scissors — it uses a guide RNA to find a specific DNA sequence, then the Cas9 protein cuts it, allowing scientists to delete, repair, or insert genes with precision.',
    sources: ['Wikipedia', 'GPT-4o mini', 'Web Search'],
  },
  {
    query: 'Why is the sky blue?',
    summary: 'Sunlight contains all colors of the spectrum. Earth\'s atmosphere scatters shorter blue wavelengths more than red ones (Rayleigh scattering), so the sky appears blue to our eyes during the day.',
    sources: ['Wikipedia', 'GPT-4o mini'],
  },
  {
    query: 'How does the human immune system fight viruses?',
    summary: 'When a virus enters the body, innate immunity responds first with inflammation. Then adaptive immunity kicks in — B cells produce antibodies while T cells destroy infected cells, forming long-term memory.',
    sources: ['Wikipedia', 'GPT-4o mini', 'Web Search'],
  },
  {
    query: 'What is machine learning and how does it work?',
    summary: 'Machine learning is a branch of AI where models learn patterns from data rather than following explicit rules. Neural networks adjust millions of internal weights during training to minimize prediction error.',
    sources: ['Wikipedia', 'GPT-4o mini', 'Web Search'],
  },
]

function HeroMockup() {
  const [phase, setPhase] = useState('typing')
  const [charCount, setCharCount] = useState(0)
  const [exampleIndex, setExampleIndex] = useState(0)

  useEffect(() => {
    let active = true
    const timeouts = []
    let currentIndex = 0

    const runCycle = () => {
      if (!active) return
      const example = DEMO_EXAMPLES[currentIndex]
      setExampleIndex(currentIndex)
      setPhase('typing')
      setCharCount(0)
      example.query.split('').forEach((_, i) => {
        timeouts.push(setTimeout(() => { if (active) setCharCount(i + 1) }, i * 38))
      })
      const done = example.query.length * 38 + 400
      timeouts.push(setTimeout(() => { if (active) setPhase('loading') }, done))
      timeouts.push(setTimeout(() => { if (active) setPhase('result') }, done + 1400))
      timeouts.push(setTimeout(() => {
        currentIndex = (currentIndex + 1) % DEMO_EXAMPLES.length
        runCycle()
      }, done + 5500))
    }
    runCycle()
    return () => { active = false; timeouts.forEach(clearTimeout) }
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
      <div className="bg-gray-50 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200">fusionai.app/research</div>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">F</span>
          </div>
          <span className="font-bold text-gray-800 text-sm">FusionAI Research</span>
        </div>
        <div className="border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2 mb-5 bg-gray-50 min-h-[48px]">
          <span className="text-gray-400 text-sm">🔍</span>
          <span className="text-gray-700 text-sm flex-1">
            {DEMO_EXAMPLES[exampleIndex].query.slice(0, charCount)}
            {phase === 'typing' && <span className="inline-block w-px h-4 bg-violet-500 ml-px animate-pulse align-middle" />}
          </span>
          {phase !== 'typing' && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${phase === 'loading' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
              {phase === 'loading' ? 'Searching…' : '✓ Done'}
            </span>
          )}
        </div>
        <div className="min-h-[140px]">
          <AnimatePresence mode="wait">
            {phase === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }} className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                  <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  Gathering from multiple sources…
                </div>
                {[90, 75, 55].map((w, i) => (
                  <motion.div key={i} className="h-3 bg-gray-200 rounded-full" style={{ width: `${w}%` }}
                    animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                ))}
              </motion.div>
            )}
            {phase === 'result' && (
              <motion.div key="result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {DEMO_EXAMPLES[exampleIndex].sources.map((src, i) => (
                    <motion.span key={src} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                      className="text-xs bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5 rounded-full font-semibold">
                      {src}
                    </motion.span>
                  ))}
                </div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <p className="text-gray-700 text-sm leading-relaxed">{DEMO_EXAMPLES[exampleIndex].summary}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex justify-center gap-1.5 pt-3">
          {DEMO_EXAMPLES.map((_, i) => (
            <motion.div key={i} className="rounded-full"
              animate={{ width: i === exampleIndex ? 16 : 6, backgroundColor: i === exampleIndex ? '#7c3aed' : '#d1d5db' }}
              transition={{ duration: 0.35 }}
              style={{ height: 6 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────

function TopNav() {
  const navigate = useNavigate()
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="fixed top-0 w-full z-50 bg-slate-900/60 backdrop-blur-lg border-b border-white/5">
      <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <a href="/" className="text-2xl font-bold tracking-tighter text-slate-50">FusionAI</a>
        <button onClick={() => navigate('/research')}
          className="bg-primary hover:bg-primary-container text-white px-6 py-2.5 rounded-lg font-semibold transition-all shadow-lg shadow-primary/20 active:scale-95">
          Start Researching
        </button>
      </nav>
    </motion.header>
  )
}

function HeroSection() {
  const navigate = useNavigate()
  return (
    <section className="relative pt-44 pb-32 px-8 overflow-hidden">
      <div className="absolute top-20 left-1/3 w-[600px] h-[600px] bg-primary/10 blur-[140px] rounded-full -z-10" />
      <div className="absolute top-40 right-10 w-[400px] h-[400px] bg-violet-700/10 blur-[120px] rounded-full -z-10" />
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <div className="lg:col-span-6 z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold tracking-widest uppercase mb-8 border border-primary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI-Powered Research
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.92] mb-8 text-on-surface">
            Research smarter,{' '}
            <span className="text-primary">not harder.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.38 }}
            className="text-lg md:text-xl text-on-surface-variant max-w-lg mb-10 leading-relaxed">
            FusionAI combines Wikipedia, web search, and GPT-4o mini to synthesize multi-source answers in seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}>
            <button onClick={() => navigate('/research')}
              className="hero-gradient text-white px-10 py-4 rounded-xl font-bold text-lg shadow-2xl shadow-primary/30 transition-all hover:scale-[1.02] active:scale-95">
              Start Researching →
            </button>
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          className="lg:col-span-6 relative">
          <motion.div animate={{ y: [0, -14, 0], rotate: [0, 0.8, 0, -0.8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
            <HeroMockup />
          </motion.div>
          <motion.div className="absolute -top-16 -right-16 w-80 h-80 bg-primary/20 blur-[100px] rounded-full -z-10"
            animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.div className="absolute -bottom-16 -left-16 w-72 h-72 bg-violet-600/10 blur-[90px] rounded-full -z-10"
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [1, 1.06, 1] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} />
        </motion.div>
      </div>
    </section>
  )
}

function SourcesStrip() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6 }}
      className="py-10 bg-slate-950/50 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-8">
        <p className="text-center text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-6">Powered by</p>
        <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-40 grayscale contrast-125">
          {['Wikipedia', 'GPT-4o mini', 'DuckDuckGo', 'LangChain', 'FastAPI'].map((n, i) => (
            <motion.span
              key={n}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="text-base font-black tracking-tighter text-slate-300">
              {n}
            </motion.span>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function FeatureGrid() {
  return (
    <section className="py-28 px-8 bg-surface">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-4">Everything you need to research deeply</h2>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto">One tool that pulls from multiple sources, verifies claims, and presents clean answers.</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.015, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="md:col-span-8 bg-surface-container-low border border-white/5 rounded-3xl p-12 flex flex-col gap-6 cursor-default">
            <Icon name="travel_explore" className="text-primary text-4xl" />
            <div>
              <h3 className="text-3xl font-bold tracking-tight mb-4 text-slate-50">Multi-Source Search</h3>
              <p className="text-on-surface-variant text-lg leading-relaxed">Every query hits Wikipedia, the open web, and GPT-4o mini simultaneously — then synthesizes a single coherent answer.</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.02, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="md:col-span-4 bg-primary text-white rounded-3xl p-10 flex flex-col justify-between shadow-xl shadow-primary/20 cursor-default">
            <div>
              <Icon name="verified_user" className="text-white text-4xl mb-6" />
              <h3 className="text-2xl font-bold tracking-tight mb-4">Source Transparency</h3>
              <p className="text-white/80 leading-relaxed">Every answer shows exactly which sources it drew from.</p>
            </div>
            <div className="mt-8 pt-8 border-t border-white/20">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">3+</span>
                <span className="text-xs uppercase tracking-widest opacity-60">sources per answer</span>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.02, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="md:col-span-4 bg-surface-container-low border border-white/5 rounded-3xl p-10 flex flex-col gap-6 cursor-default">
            <Icon name="chat" className="text-primary text-4xl" />
            <div>
              <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-50">Persistent Sessions</h3>
              <p className="text-on-surface-variant leading-relaxed">Sessions are saved so you can pick up right where you left off.</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 36 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -8, scale: 1.015, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="md:col-span-8 bg-surface-container-low border border-white/5 rounded-3xl p-10 flex flex-col gap-6 cursor-default">
            <Icon name="bolt" className="text-primary text-4xl" />
            <div>
              <h3 className="text-2xl font-bold tracking-tight mb-3 text-slate-50">Fast & Precise</h3>
              <p className="text-on-surface-variant leading-relaxed">Answers arrive in seconds. Built on FastAPI with async processing.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  const navigate = useNavigate()
  return (
    <section className="py-28 px-8">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="max-w-4xl mx-auto bg-slate-900 border border-white/5 rounded-[3rem] p-14 md:p-20 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-primary/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-violet-600/10 blur-[100px] rounded-full" />
        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-white text-4xl md:text-6xl font-extrabold tracking-tighter mb-6">
            Ready to start?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Ask anything. FusionAI will find, verify, and explain it.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.35 }}>
            <button onClick={() => navigate('/research')}
              className="bg-white text-slate-950 px-12 py-4 rounded-xl font-bold text-lg hover:bg-slate-100 transition-all active:scale-95">
              Start Researching →
            </button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="w-full py-10 px-8 bg-slate-950 border-t border-slate-900 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-lg font-black text-slate-100">FusionAI</span>
        <p className="text-slate-500 text-xs text-center">Built with React · FastAPI · LangChain · GPT-4o mini</p>
        <p className="text-slate-600 text-xs">© 2025 FusionAI</p>
      </div>
    </footer>
  )
}

function LandingPage() {
  return (
    <div className="bg-surface font-body text-on-surface antialiased">
      <TopNav />
      <main><HeroSection /><SourcesStrip /><FeatureGrid /><CTASection /></main>
      <Footer />
    </div>
  )
}

// ─── Research app shared utilities ────────────────────────────────────────────

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'web-client'
// VITE_API_URL: set to your backend origin in production (e.g. https://api.example.com).
// Leave unset in development — Vite's dev-server proxy handles /api/* → localhost:5001.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

async function apiCall(path, options = {}) {
  const headers = { 'x-fusion-workspace-id': WORKSPACE_ID, ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const raw = err.detail || err.error || `Request failed (${res.status})`
    const message = typeof raw === 'string' ? raw : JSON.stringify(raw)
    throw new Error(message)
  }
  if (res.status === 204) return null
  return res.json()
}

// Multipart upload — must NOT set Content-Type so the browser adds the boundary.
async function uploadFile(path, file, fields = {}) {
  const form = new FormData()
  form.append('file', file)
  for (const [key, value] of Object.entries(fields)) {
    if (value != null) form.append(key, value)
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'x-fusion-workspace-id': WORKSPACE_ID },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const raw = err.detail || err.error || `Upload failed (${res.status})`
    throw new Error(typeof raw === 'string' ? raw : JSON.stringify(raw))
  }
  return res.json()
}

// Consume the NDJSON streaming endpoint, invoking onEvent for each parsed event.
async function streamResearch(body, { signal, onEvent }) {
  const res = await fetch(`${API_BASE}/api/research/stream`, {
    method: 'POST',
    headers: { 'x-fusion-workspace-id': WORKSPACE_ID, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}))
    const raw = err.detail || err.error || `Request failed (${res.status})`
    throw new Error(typeof raw === 'string' ? raw : JSON.stringify(raw))
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) onEvent(JSON.parse(line))
    }
  }
  const tail = buffer.trim()
  if (tail) onEvent(JSON.parse(tail))
}

const ACCEPTED_UPLOAD_TYPES = '.pdf,.docx,.txt,.md'
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docIcon(sourceType) {
  return { pdf: 'picture_as_pdf', docx: 'description', document: 'article' }[sourceType] || 'draft'
}

function formatRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'Just now'
}

const LOADING_STEPS = [
  'Searching Wikipedia...',
  'Scanning the web...',
  'Synthesizing with GPT-4o mini...',
  'Compiling your answer...',
]

const TOPIC_CARDS = [
  { icon: 'analytics', title: 'Analyze Market Trends', desc: 'Extract key indicators from global market reports.', query: 'What are the current global trends in AI and technology in 2024?' },
  { icon: 'description', title: 'Summarize Research', desc: 'Condense complex topics into clear, actionable summaries.', query: 'Summarize the latest breakthroughs in quantum computing research' },
  { icon: 'psychology', title: 'Connect Concepts', desc: 'Map connections between disparate ideas to find new patterns.', query: 'How does artificial intelligence connect with neuroscience and cognitive science?' },
]

function toolDisplayName(tool) {
  const map = { wikipedia: 'Wikipedia', duckduckgo_search: 'Web Search', web_search: 'Web Search', openai: 'GPT-4o mini', gpt: 'GPT-4o mini' }
  return map[tool.toLowerCase()] || tool
}

function sourceIcon(sourceType) {
  return { wikipedia: 'public', web: 'language', document: 'description' }[sourceType] || 'menu_book'
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ResearchSidebar({ activeNav, onNavChange, sessions, onSessionClick }) {
  const NAV = [
    { id: 'new', icon: 'add_circle', label: 'New Research' },
    { id: 'library', icon: 'auto_stories', label: 'Library' },
    { id: 'insights', icon: 'monitoring', label: 'Insights' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ]
  return (
    <aside className="hidden md:flex h-screen w-72 flex-col fixed left-0 top-0 z-40 border-r"
      style={{ backgroundColor: '#131b2e', borderColor: 'rgba(73,68,84,0.1)' }}>
      <div className="flex flex-col p-4 gap-1 h-full overflow-hidden">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-5 mb-2 shrink-0">
          <div className="relative shrink-0">
            {/* Pulsing glow ring */}
            <motion.div
              className="absolute inset-0 rounded-xl"
              style={{ background: 'linear-gradient(135deg, #d0bcff, #a078ff)', filter: 'blur(8px)' }}
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg relative"
              style={{ background: 'linear-gradient(135deg, #d0bcff, #a078ff)' }}
              animate={{ rotate: [0, 8, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <Icon name="auto_awesome" style={{ color: '#340080', fontVariationSettings: "'FILL' 1", fontSize: '20px' }} />
            </motion.div>
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>FusionAI</h1>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(218,226,253,0.35)', fontFamily: 'Manrope, sans-serif' }}>Research v1.0</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 shrink-0">
          {NAV.map(item => {
            const active = activeNav === item.id
            return (
              <button key={item.id} onClick={() => onNavChange(item.id)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left hover:bg-white/5"
                style={active ? { backgroundColor: '#2d3449', color: '#d0bcff', fontWeight: 700 } : { color: 'rgba(218,226,253,0.5)' }}>
                <Icon name={item.icon} style={active ? { fontVariationSettings: "'FILL' 1" } : {}} />
                <span style={{ fontFamily: 'Manrope, sans-serif' }}>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div className="mt-4 flex-1 min-h-0 flex flex-col">
            <p className="px-4 text-[10px] uppercase tracking-widest mb-2 font-bold shrink-0"
              style={{ color: 'rgba(218,226,253,0.25)', fontFamily: 'Manrope, sans-serif' }}>Recent</p>
            <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
              {sessions.slice(0, 12).map(s => (
                <button key={s.id} onClick={() => onSessionClick(s)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs truncate transition-all text-left w-full hover:bg-white/5"
                  style={{ color: 'rgba(218,226,253,0.45)', fontFamily: 'Manrope, sans-serif' }} title={s.title}>
                  <Icon name="chat_bubble" style={{ fontSize: '14px', flexShrink: 0 }} />
                  <span className="truncate">{s.title || 'Untitled session'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

// ─── Document upload UI ───────────────────────────────────────────────────────

function AttachButton({ onSelect, disabled }) {
  const inputRef = useRef(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onSelect(file)
          e.target.value = '' // allow re-selecting the same file
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Attach a document (PDF, Word, TXT, MD)"
        className="p-3 rounded-2xl hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        style={{ color: 'rgba(208,188,255,0.65)' }}>
        <Icon name="attach_file" />
      </button>
    </>
  )
}

function DocumentChips({ documents, pending, error, onRemove, removingIds, onView }) {
  if (!documents.length && !pending && !error) return null
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {documents.map(doc => (
        <div key={doc.id}
          className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl border text-xs"
          style={{ backgroundColor: 'rgba(19,27,46,0.75)', borderColor: 'rgba(208,188,255,0.2)', color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>
          <Icon name={docIcon(doc.source_type)} style={{ fontSize: '16px', color: '#d0bcff' }} />
          <button type="button" onClick={() => onView?.(doc.id)}
            className="max-w-[180px] truncate font-semibold hover:underline" title={`View “${doc.title}”`}>
            {doc.title}
          </button>
          <span style={{ color: 'rgba(203,195,215,0.4)' }}>{(doc.content_length / 1000).toFixed(1)}k chars</span>
          <button type="button" onClick={() => onRemove(doc.id)} disabled={removingIds.has(doc.id)}
            className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-50 transition-colors"
            aria-label={`Remove ${doc.title}`} title="Remove document">
            <Icon name={removingIds.has(doc.id) ? 'hourglass_empty' : 'close'} style={{ fontSize: '13px', color: 'rgba(203,195,215,0.6)' }} />
          </button>
        </div>
      ))}
      {pending && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
          style={{ backgroundColor: 'rgba(19,27,46,0.75)', borderColor: 'rgba(208,188,255,0.2)', color: 'rgba(218,226,253,0.7)', fontFamily: 'Manrope, sans-serif' }}>
          <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#d0bcff', borderTopColor: 'transparent' }} />
          <span className="max-w-[180px] truncate">Reading {pending}…</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
          style={{ backgroundColor: 'rgba(255,180,171,0.08)', borderColor: 'rgba(255,180,171,0.35)', color: '#ffb4ab', fontFamily: 'Inter, sans-serif' }}>
          <Icon name="error_outline" style={{ fontSize: '14px' }} />
          <span className="max-w-[260px] truncate" title={error}>{error}</span>
        </div>
      )}
    </div>
  )
}

function DocViewerModal({ doc, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3,6,23,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] rounded-2xl border flex flex-col overflow-hidden"
        style={{ backgroundColor: '#131b2e', borderColor: 'rgba(73,68,84,0.3)' }}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(73,68,84,0.2)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <Icon name={docIcon(doc.source_type)} style={{ color: '#d0bcff' }} />
            <div className="min-w-0">
              <p className="font-bold truncate" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>{doc.title}</p>
              <p className="text-[11px]" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>
                {doc.source_type.toUpperCase()} · {doc.content_length.toLocaleString()} characters extracted
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close document viewer"
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 shrink-0" style={{ color: 'rgba(203,195,215,0.6)' }}>
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: '#cbc3d7', fontFamily: 'Inter, sans-serif' }}>
            {doc.content_text}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── New Research View ────────────────────────────────────────────────────────

function NewResearchView({ onSubmit, isLoading, documents, onUpload, onRemoveDoc, onViewDoc, docPending, docError, removingDocIds }) {
  const [query, setQuery] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (q && !isLoading) { onSubmit(q); setQuery('') }
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Animated floating background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full blur-[130px]"
          style={{ backgroundColor: 'rgba(208,188,255,0.05)' }}
          animate={{ x: [0, 40, -20, 0], y: [0, -25, 35, 0], scale: [1, 1.06, 0.97, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 right-1/4 w-[360px] h-[360px] rounded-full blur-[110px]"
          style={{ backgroundColor: 'rgba(160,120,255,0.06)' }}
          animate={{ x: [0, -30, 15, 0], y: [0, 22, -30, 0], scale: [1, 1.08, 0.95, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />
        <motion.div
          className="absolute bottom-1/3 left-1/5 w-[280px] h-[280px] rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(130,90,255,0.04)' }}
          animate={{ x: [0, 20, -15, 0], y: [0, -20, 18, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
      </div>

      <div className="w-full max-w-3xl relative z-10 flex flex-col items-center">
        {/* Heading — staggered entrance */}
        <div className="text-center mb-10">
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="text-5xl md:text-6xl font-extrabold tracking-tighter mb-5"
            style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif', lineHeight: 1.05 }}>
            Research Assistant<br />
            <motion.span
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ background: 'linear-gradient(to right, #d0bcff, #a078ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Reimagined
            </motion.span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
            className="text-lg max-w-xl mx-auto" style={{ color: '#cbc3d7', fontFamily: 'Inter, sans-serif' }}>
            Harness AI to synthesize information from Wikipedia, the web, and GPT — all at once.
          </motion.p>
        </div>

        {/* Search bar — entrance */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28, ease: 'easeOut' }}
          onSubmit={handleSubmit} className="w-full relative group mb-12">
          <div className="absolute -inset-0.5 rounded-2xl blur opacity-20 group-focus-within:opacity-60 transition duration-500 pointer-events-none"
            style={{ background: 'linear-gradient(to right, rgba(208,188,255,0.5), rgba(160,120,255,0.5))' }} />
          <div className="relative backdrop-blur-2xl border rounded-2xl flex items-end gap-1 p-2 min-h-[72px]"
            style={{ backgroundColor: 'rgba(45,52,73,0.6)', borderColor: 'rgba(73,68,84,0.2)' }}>
            <div className="px-3 flex items-center self-stretch pt-3.5" style={{ color: '#d0bcff' }}>
              <Icon name="terminal" style={{ fontSize: '28px' }} />
            </div>
            <AutoGrowTextarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onSubmit={handleSubmit}
              maxHeight={260}
              className="bg-transparent border-none focus:ring-0 outline-none w-full text-lg py-4 leading-relaxed"
              placeholder="What are we researching today?"
              style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}
              disabled={isLoading}
              submitDisabled={isLoading}
              ariaLabel="Research question"
              autoFocus
            />
            <div className="flex items-center gap-1 pb-0.5">
              <AttachButton onSelect={onUpload} disabled={isLoading || !!docPending} />
              <motion.button
                type="submit"
                disabled={isLoading || !query.trim()}
                aria-label="Start research"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="p-3 rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #d0bcff, #a078ff)', color: '#340080' }}>
                {isLoading
                  ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  : <Icon name="send" style={{ fontVariationSettings: "'FILL' 1" }} />}
              </motion.button>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <DocumentChips documents={documents} pending={docPending} error={docError} onRemove={onRemoveDoc} removingIds={removingDocIds} onView={onViewDoc} />
          </div>
          <p className="text-center text-[11px]" style={{ color: 'rgba(203,195,215,0.35)', fontFamily: 'Inter, sans-serif' }}>
            Press <span style={{ color: 'rgba(208,188,255,0.6)', fontWeight: 600 }}>Enter</span> to send ·
            {' '}<span style={{ color: 'rgba(208,188,255,0.6)', fontWeight: 600 }}>Shift + Enter</span> for a new line ·
            {' '}attach <span style={{ color: 'rgba(208,188,255,0.6)', fontWeight: 600 }}>PDF / Word / TXT</span> for context
          </p>
        </motion.form>

        {/* Topic cards — staggered entrance + hover float */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOPIC_CARDS.map((card, i) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.42 + i * 0.1, ease: 'easeOut' }}
              whileHover={{ y: -7, scale: 1.03, transition: { type: 'spring', stiffness: 340, damping: 22 } }}
              whileTap={{ scale: 0.97 }}
              onClick={() => !isLoading && onSubmit(card.query)}
              disabled={isLoading}
              className="p-5 rounded-2xl text-left group border disabled:opacity-50"
              style={{ backgroundColor: 'rgba(19,27,46,0.4)', borderColor: 'rgba(73,68,84,0.1)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(208,188,255,0.25)'; e.currentTarget.style.backgroundColor = 'rgba(34,42,61,0.6)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(73,68,84,0.1)'; e.currentTarget.style.backgroundColor = 'rgba(19,27,46,0.4)' }}>
              <motion.div
                className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: 'rgba(208,188,255,0.1)', color: '#d0bcff' }}
                whileHover={{ scale: 1.15, transition: { type: 'spring', stiffness: 400, damping: 18 } }}>
                <Icon name={card.icon} />
              </motion.div>
              <h3 className="font-bold text-sm mb-1.5" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>{card.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#cbc3d7', fontFamily: 'Inter, sans-serif' }}>{card.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Chat message components ──────────────────────────────────────────────────

function UserMessage({ message }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="flex flex-col items-end gap-2">
      <div className="px-5 py-4 rounded-3xl rounded-tr-none max-w-[80%] border"
        style={{ backgroundColor: 'rgba(45,52,73,0.8)', borderColor: 'rgba(73,68,84,0.15)', color: '#dae2fd' }}>
        <p className="text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>{message.content}</p>
      </div>
      <span className="text-[10px] uppercase tracking-tighter font-bold" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Manrope, sans-serif' }}>
        {time}
      </span>
    </motion.div>
  )
}

function AssistantMessage({ message, onSuggestion, onRegenerate, isLast, streamingStatus }) {
  const streaming = !!message.streaming
  const hasSources = !streaming && message.sources && message.sources.length > 0
  const toolNames = streaming ? [] : [...new Set((message.tools_used || []).map(toolDisplayName))]
  const followUps = streaming ? [] : (message.followUps || [])
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* clipboard unavailable */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex gap-4 items-start">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: 'linear-gradient(135deg, #d0bcff, #a078ff)' }}>
        <Icon name="bolt" style={{ color: '#340080', fontVariationSettings: "'FILL' 1", fontSize: '16px' }} />
      </div>
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-w-0">
        <div className="flex-1 min-w-0 space-y-4">
          {streaming && !message.content ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#d0bcff', borderTopColor: 'transparent' }} />
              <span className="text-xs font-semibold" style={{ color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>
                {streamingStatus || 'Thinking…'}
              </span>
            </div>
          ) : message.isError ? (
            <p className="text-sm leading-relaxed" style={{ color: '#ffb4ab', fontFamily: 'Inter, sans-serif' }}>{message.content}</p>
          ) : (
            <div className="relative">
              <Markdown>{message.content}</Markdown>
              {streaming && (
                <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse rounded-sm" style={{ backgroundColor: '#d0bcff' }} />
              )}
            </div>
          )}
          {toolNames.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {toolNames.map(t => (
                <span key={t} className="text-xs px-2.5 py-0.5 rounded-full border font-medium"
                  style={{ backgroundColor: 'rgba(208,188,255,0.08)', borderColor: 'rgba(208,188,255,0.2)', color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>
                  {t}
                </span>
              ))}
              {message.confidence && (
                <span className="text-xs px-2.5 py-0.5 rounded-full border font-medium"
                  style={{ backgroundColor: 'rgba(73,68,84,0.3)', borderColor: 'rgba(73,68,84,0.3)', color: 'rgba(203,195,215,0.6)', fontFamily: 'Manrope, sans-serif' }}>
                  {message.confidence} confidence
                </span>
              )}
            </div>
          )}
          {!streaming && !message.isError && (
            <div className="flex items-center gap-1">
              <button onClick={handleCopy} aria-label="Copy answer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:bg-white/5"
                style={{ color: copied ? '#86efac' : 'rgba(203,195,215,0.5)', fontFamily: 'Manrope, sans-serif' }}
                title="Copy answer">
                <Icon name={copied ? 'check' : 'content_copy'} style={{ fontSize: '14px' }} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              {isLast && onRegenerate && (
                <button onClick={onRegenerate} aria-label="Regenerate answer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:bg-white/5"
                  style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Manrope, sans-serif' }}
                  title="Regenerate answer">
                  <Icon name="refresh" style={{ fontSize: '14px' }} />
                  Regenerate
                </button>
              )}
              <span className="text-[10px] ml-1" style={{ color: 'rgba(203,195,215,0.3)', fontFamily: 'Manrope, sans-serif' }}>{time}</span>
            </div>
          )}
          {followUps.length > 0 && (
            <div className="pt-1 space-y-2">
              <span className="text-[10px] uppercase tracking-widest font-bold block"
                style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Manrope, sans-serif' }}>Suggested follow-ups</span>
              <div className="flex flex-col gap-2">
                {followUps.slice(0, 4).map((q, i) => (
                  <button key={i} onClick={() => onSuggestion?.(q)}
                    className="text-left text-xs px-3 py-2 rounded-xl border transition-all hover:bg-white/5 flex items-center gap-2"
                    style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(208,188,255,0.15)', color: '#cbc3d7', fontFamily: 'Inter, sans-serif' }}>
                    <Icon name="arrow_forward" style={{ fontSize: '14px', color: '#d0bcff', flexShrink: 0 }} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        {hasSources && (
          <div className="w-full lg:w-52 shrink-0 space-y-2">
            <span className="text-[10px] uppercase tracking-widest font-bold block"
              style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Manrope, sans-serif' }}>Verified Sources</span>
            <div className="flex flex-col gap-2">
              {message.sources.slice(0, 5).map((src, i) => (
                <a key={i} href={src.url || undefined} target={src.url ? '_blank' : undefined} rel="noopener noreferrer"
                  className="p-3 rounded-xl flex items-center gap-2.5 transition-all border"
                  style={{ backgroundColor: 'rgba(19,27,46,0.6)', borderColor: 'rgba(73,68,84,0.15)', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(34,42,61,0.8)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(19,27,46,0.6)'}>
                  <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: '#0b1326' }}>
                    <Icon name={sourceIcon(src.source_type)} style={{ color: '#d0bcff', fontSize: '14px' }} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold truncate" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>{src.title}</p>
                    {src.snippet && (
                      <p className="text-[9px] truncate" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>{src.snippet.slice(0, 55)}…</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ThinkingIndicator({ step }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(45,52,73,0.6)' }}>
        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#d0bcff', borderTopColor: 'transparent' }} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold" style={{ color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>{LOADING_STEPS[step]}</span>
        <span className="text-[10px]" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>This may take a few seconds…</span>
      </div>
    </div>
  )
}

// ─── Library view ─────────────────────────────────────────────────────────────

function LibraryView({ sessions, onOpenSession, onDeleteSession, onRenameSession, processingIds }) {
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const filtered = sessions.filter(s =>
    (s.title || '').toLowerCase().includes(search.toLowerCase())
  )

  function startEdit(session, e) {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title || '')
  }

  async function commitEdit(id) {
    if (editTitle.trim()) await onRenameSession(id, editTitle.trim())
    setEditingId(null)
  }

  async function confirmDelete(id, e) {
    e.stopPropagation()
    if (deletingId === id) {
      await onDeleteSession(id)
      setDeletingId(null)
    } else {
      setDeletingId(id)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Library</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{ backgroundColor: 'rgba(208,188,255,0.1)', color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>
              {sessions.length} sessions
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2 flex-1 max-w-xs"
            style={{ backgroundColor: 'rgba(45,52,73,0.4)', borderColor: 'rgba(73,68,84,0.2)' }}>
            <Icon name="search" style={{ color: 'rgba(203,195,215,0.4)', fontSize: '18px' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-none focus:ring-0 outline-none text-sm flex-1"
              placeholder="Search sessions…"
              style={{ color: '#dae2fd', fontFamily: 'Inter, sans-serif' }} />
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(208,188,255,0.08)' }}>
              <Icon name="auto_stories" style={{ color: '#d0bcff', fontSize: '32px' }} />
            </div>
            <p className="font-semibold" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>
              {search ? 'No sessions match your search' : 'No research sessions yet'}
            </p>
            <p className="text-sm" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>
              {search ? 'Try a different search term' : 'Start a new research to build your library'}
            </p>
          </div>
        )}

        {/* Session grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(session => (
            <div key={session.id}
              className="group p-5 rounded-2xl border transition-all cursor-pointer"
              style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}
              onClick={() => !editingId && onOpenSession(session)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(208,188,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(73,68,84,0.15)'}>
              {/* Title */}
              <div className="flex items-start justify-between gap-2 mb-3">
                {editingId === session.id ? (
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => commitEdit(session.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(session.id); if (e.key === 'Escape') setEditingId(null) }}
                    onClick={e => e.stopPropagation()}
                    className="flex-1 bg-transparent border-b outline-none text-sm font-bold"
                    style={{ color: '#dae2fd', borderColor: 'rgba(208,188,255,0.3)', fontFamily: 'Manrope, sans-serif' }}
                    autoFocus />
                ) : (
                  <h3 className="font-bold text-sm flex-1 line-clamp-2 leading-snug"
                    style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>
                    {session.title || 'Untitled session'}
                  </h3>
                )}
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => startEdit(session, e)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                    style={{ color: 'rgba(208,188,255,0.6)' }}>
                    <Icon name="edit" style={{ fontSize: '14px' }} />
                  </button>
                  <button onClick={e => confirmDelete(session.id, e)}
                    disabled={processingIds.has(session.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ color: deletingId === session.id ? '#ffb4ab' : 'rgba(203,195,215,0.4)', backgroundColor: deletingId === session.id ? 'rgba(255,180,171,0.1)' : 'transparent' }}
                    title={processingIds.has(session.id) ? 'Deleting…' : deletingId === session.id ? 'Click again to confirm' : 'Delete session'}>
                    <Icon name={processingIds.has(session.id) ? 'hourglass_empty' : deletingId === session.id ? 'warning' : 'delete'} style={{ fontSize: '14px' }} />
                  </button>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 flex-wrap">
                {session.result_count > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: 'rgba(208,188,255,0.08)', color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>
                    {session.result_count} {session.result_count === 1 ? 'query' : 'queries'}
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>
                  {formatRelativeTime(session.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Insights view ────────────────────────────────────────────────────────────

function InsightsView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    apiCall('/api/insights')
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  function StatCard({ icon, label, value, sub }) {
    return (
      <div className="p-6 rounded-2xl border flex flex-col gap-3"
        style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(208,188,255,0.1)' }}>
          <Icon name={icon} style={{ color: '#d0bcff', fontSize: '20px' }} />
        </div>
        <div>
          <p className="text-3xl font-extrabold" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>{value}</p>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'rgba(203,195,215,0.6)', fontFamily: 'Inter, sans-serif' }}>{label}</p>
          {sub && <p className="text-xs mt-1" style={{ color: 'rgba(203,195,215,0.35)', fontFamily: 'Inter, sans-serif' }}>{sub}</p>}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#d0bcff', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>Loading insights…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <Icon name="error_outline" style={{ color: '#ffb4ab', fontSize: '40px' }} />
          <p className="mt-3 font-semibold" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Failed to load insights</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>{error}</p>
        </div>
      </div>
    )
  }

  const confTotal = Object.values(data.confidence_breakdown).reduce((a, b) => a + b, 0) || 1
  const confColors = { high: '#86efac', medium: '#fde68a', low: '#fca5a5' }
  const confLabels = { high: 'High', medium: 'Medium', low: 'Low' }

  const maxToolCount = data.top_tools[0]?.count || 1

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-8" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Insights</h2>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="forum" label="Research sessions" value={data.total_sessions} />
          <StatCard icon="search" label="Total queries" value={data.total_queries} />
          <StatCard icon="attach_file" label="Documents uploaded" value={data.total_documents} />
          <StatCard icon="bolt" label="Cache hit rate" value={`${data.cache_hit_rate}%`} sub={`${data.avg_latency_ms}ms avg latency`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Confidence breakdown */}
          <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}>
            <p className="text-sm font-bold mb-5" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Answer Confidence</p>
            {confTotal === 1 && data.total_queries === 0 ? (
              <p className="text-sm" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>No data yet</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(data.confidence_breakdown).map(([key, count]) => (
                  <div key={key}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: confColors[key] || '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>{confLabels[key]}</span>
                      <span className="text-xs" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>{count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(73,68,84,0.3)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(count / confTotal) * 100}%`, backgroundColor: confColors[key] || '#d0bcff' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top tools */}
          <div className="p-6 rounded-2xl border" style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}>
            <p className="text-sm font-bold mb-5" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Tools Used</p>
            {data.top_tools.length === 0 ? (
              <p className="text-sm" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>No data yet</p>
            ) : (
              <div className="space-y-4">
                {data.top_tools.map(t => (
                  <div key={t.name}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>{toolDisplayName(t.name)}</span>
                      <span className="text-xs" style={{ color: 'rgba(203,195,215,0.5)', fontFamily: 'Inter, sans-serif' }}>{t.count}×</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(73,68,84,0.3)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(t.count / maxToolCount) * 100}%`, background: 'linear-gradient(to right, #d0bcff, #a078ff)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent activity */}
          {data.recent_activity.length > 0 && (
            <div className="md:col-span-2 p-6 rounded-2xl border" style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}>
              <p className="text-sm font-bold mb-5" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Recent Activity</p>
              <div className="flex flex-col gap-3">
                {data.recent_activity.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b"
                    style={{ borderColor: 'rgba(73,68,84,0.1)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'rgba(208,188,255,0.1)' }}>
                        <Icon name="chat_bubble" style={{ color: '#d0bcff', fontSize: '14px' }} />
                      </div>
                      <span className="text-sm truncate" style={{ color: '#dae2fd', fontFamily: 'Inter, sans-serif' }}>
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'rgba(208,188,255,0.08)', color: '#d0bcff', fontFamily: 'Manrope, sans-serif' }}>
                        {item.query_count} {item.query_count === 1 ? 'query' : 'queries'}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>
                        {formatRelativeTime(item.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Settings view ────────────────────────────────────────────────────────────

function SettingsView() {
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall('/api/health')
      .then(d => { setHealth(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function SettingRow({ label, value, valueColor }) {
    return (
      <div className="flex items-center justify-between py-3.5 border-b"
        style={{ borderColor: 'rgba(73,68,84,0.1)' }}>
        <span className="text-sm" style={{ color: 'rgba(203,195,215,0.6)', fontFamily: 'Inter, sans-serif' }}>{label}</span>
        <span className="text-sm font-semibold" style={{ color: valueColor || '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>{value}</span>
      </div>
    )
  }

  function Section({ title, children }) {
    return (
      <div className="p-6 rounded-2xl border mb-4" style={{ backgroundColor: 'rgba(19,27,46,0.5)', borderColor: 'rgba(73,68,84,0.15)' }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'rgba(208,188,255,0.5)', fontFamily: 'Manrope, sans-serif' }}>{title}</p>
        {children}
      </div>
    )
  }

  function formatUptime(secs) {
    if (!secs) return '—'
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const isOnline = !loading && !!health && health.database_connected

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-8" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>Settings</h2>

        <Section title="Service Status">
          <div className="flex items-center justify-between py-3.5">
            <span className="text-sm" style={{ color: 'rgba(203,195,215,0.6)', fontFamily: 'Inter, sans-serif' }}>FusionAI Research</span>
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: isOnline ? '#86efac' : '#fca5a5', fontFamily: 'Manrope, sans-serif' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isOnline ? '#86efac' : '#fca5a5', display: 'inline-block' }} />
              {loading ? 'Checking…' : isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </Section>

        <Section title="About">
          <SettingRow label="App" value="FusionAI Research" />
          <SettingRow label="Version" value={health ? `v${health.version}` : 'v2.1.0'} />
          <SettingRow label="AI Model" value="GPT-4o mini" />
          <SettingRow label="Built with" value="React · FastAPI · LangChain" />
        </Section>
      </div>
    </div>
  )
}

// ─── Research App ─────────────────────────────────────────────────────────────

function ResearchApp() {
  const navigate = useNavigate()
  const [view, setView] = useState('new')       // 'new' | 'chat' | 'library' | 'insights' | 'settings'
  const [activeNav, setActiveNav] = useState('new')
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [processingIds, setProcessingIds] = useState(new Set())
  const [documents, setDocuments] = useState([])
  const [docPending, setDocPending] = useState(null)
  const [docError, setDocError] = useState(null)
  const [removingDocIds, setRemovingDocIds] = useState(new Set())
  const [atBottom, setAtBottom] = useState(true)
  const [viewingDoc, setViewingDoc] = useState(null)
  const messagesEndRef = useRef(null)
  const chatScrollRef = useRef(null)
  const followUpRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    apiCall('/api/sessions').then(setSessions).catch(() => {})
  }, [])

  // Keep pinned to the newest message only while the user is already at the bottom,
  // so streaming tokens don't yank the view if they've scrolled up to read.
  useEffect(() => {
    if (atBottom) messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages, isLoading, atBottom])

  function handleChatScroll() {
    const el = chatScrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120)
  }

  function scrollToBottom() {
    setAtBottom(true)
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function refreshSessions() {
    apiCall('/api/sessions').then(setSessions).catch(() => {})
  }

  function handleNavChange(navId) {
    setActiveNav(navId)
    if (navId === 'new') {
      setView('new'); setSessionId(null); setMessages([]); setDocuments([]); setDocError(null)
    } else {
      setView(navId)
    }
  }

  // Documents require a session; create one lazily on first attach.
  async function ensureSession() {
    if (sessionId) return sessionId
    const session = await apiCall('/api/sessions', { method: 'POST', body: JSON.stringify({}) })
    setSessionId(session.id)
    refreshSessions()
    return session.id
  }

  async function handleUploadDocument(file) {
    setDocError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setDocError(`"${file.name}" is too large (max ${formatBytes(MAX_UPLOAD_BYTES)})`)
      return
    }
    setDocPending(file.name)
    try {
      const id = await ensureSession()
      const doc = await uploadFile(`/api/sessions/${id}/documents/upload`, file)
      setDocuments(prev => [...prev, doc])
      refreshSessions()
    } catch (err) {
      setDocError(err.message)
    } finally {
      setDocPending(null)
    }
  }

  async function handleRemoveDocument(docId) {
    setRemovingDocIds(prev => new Set(prev).add(docId))
    try {
      await apiCall(`/api/documents/${docId}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      setDocError(err.message)
    } finally {
      setRemovingDocIds(prev => { const s = new Set(prev); s.delete(docId); return s })
    }
  }

  // Unified streaming runner — powers the initial search, follow-ups,
  // suggested questions, and regenerate.
  async function runQuery(query, { skipUserMessage = false } = {}) {
    if (!query || isLoading) return
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)
    setStatusMsg('')
    setAtBottom(true)
    setView('chat')

    const assistantId = `a-${Date.now()}`
    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: query, timestamp: new Date() }
    const placeholder = { id: assistantId, role: 'assistant', content: '', streaming: true, query, sources: [], tools_used: [], followUps: [], timestamp: new Date() }
    setMessages(prev => [...prev, ...(skipUserMessage ? [] : [userMessage]), placeholder])

    const patch = updater => setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, ...updater(m) } : m)))

    try {
      await streamResearch({ query, session_id: sessionId }, {
        signal: controller.signal,
        onEvent: ev => {
          if (ev.type === 'session') setSessionId(ev.session_id)
          else if (ev.type === 'status') setStatusMsg(ev.message)
          else if (ev.type === 'token') patch(m => ({ content: m.content + ev.text }))
          else if (ev.type === 'done') {
            setSessionId(ev.session_id)
            patch(() => ({
              streaming: false,
              sources: ev.citations || [],
              tools_used: ev.tools_used || [],
              confidence: ev.confidence,
              followUps: ev.follow_up_questions || [],
            }))
            refreshSessions()
            setTimeout(() => followUpRef.current?.focus(), 60)
          } else if (ev.type === 'error') {
            throw new Error(ev.message)
          }
        },
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        patch(m => ({ streaming: false, stopped: true, content: m.content || '_Generation stopped._' }))
      } else {
        patch(() => ({ streaming: false, isError: true, content: `Something went wrong: ${err.message}` }))
      }
    } finally {
      setIsLoading(false)
      setStatusMsg('')
      abortRef.current = null
    }
  }

  function handleResearch(query) { runQuery(query) }
  function sendMessage(msg) { runQuery(msg) }

  function handleFollowUp(e) {
    e.preventDefault()
    const msg = followUp.trim()
    if (!msg || isLoading) return
    setFollowUp('')
    runQuery(msg)
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleRegenerate(assistantId) {
    if (isLoading) return
    const msg = messages.find(m => m.id === assistantId)
    if (!msg?.query) return
    setMessages(prev => prev.filter(m => m.id !== assistantId))
    runQuery(msg.query, { skipUserMessage: true })
  }

  async function handleViewDocument(docId) {
    try {
      const detail = await apiCall(`/api/documents/${docId}`)
      setViewingDoc(detail)
    } catch (err) {
      setDocError(err.message)
    }
  }

  async function handleOpenSession(session) {
    try {
      const detail = await apiCall(`/api/sessions/${session.id}`)
      setSessionId(session.id)
      const msgs = detail.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) }))
      setMessages(msgs)
      setDocuments(detail.documents || [])
      setDocError(null)
      setView('chat')
      setActiveNav('library')
    } catch (err) { console.error(err) }
  }

  async function handleDeleteSession(id) {
    if (processingIds.has(id)) return
    setProcessingIds(prev => new Set(prev).add(id))
    try {
      await apiCall(`/api/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (sessionId === id) { setSessionId(null); setMessages([]); setDocuments([]) }
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  async function handleRenameSession(id, title) {
    const updated = await apiCall(`/api/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    })
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: updated.title } : s))
  }

  const S = { backgroundColor: '#0b1326', color: '#dae2fd' }

  return (
    <div className="flex overflow-hidden" style={{ height: '100dvh', ...S }}>
      <ResearchSidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        sessions={sessions}
        onSessionClick={session => handleOpenSession(session)}
      />

      <main className="md:ml-72 flex flex-col overflow-hidden relative" style={{ flex: 1, height: '100dvh', ...S }}>
        {/* Top bar */}
        <header className="flex justify-between items-center px-6 h-16 shrink-0 sticky top-0 z-50 border-b"
          style={{ backgroundColor: 'rgba(11,19,38,0.7)', backdropFilter: 'blur(20px)', borderColor: 'rgba(73,68,84,0.1)', boxShadow: '0 8px 16px rgba(109,59,215,0.06)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-xl font-bold tracking-tighter"
              style={{ background: 'linear-gradient(to right, #d0bcff, #a078ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'Manrope, sans-serif' }}>
              FusionAI
            </button>
            {view === 'chat' && (
              <span className="hidden md:block text-xs" style={{ color: 'rgba(203,195,215,0.4)', fontFamily: 'Inter, sans-serif' }}>
                / Research Assistant
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === 'chat' && (
              <button onClick={() => handleNavChange('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border hover:bg-white/5"
                style={{ color: '#d0bcff', borderColor: 'rgba(208,188,255,0.2)', fontFamily: 'Manrope, sans-serif' }}>
                <Icon name="add_circle" style={{ fontSize: '16px' }} />
                New
              </button>
            )}
            <button onClick={() => navigate('/')} className="w-9 h-9 flex items-center justify-center rounded-full transition-all hover:bg-white/5"
              style={{ color: 'rgba(218,226,253,0.4)' }} title="Back to landing page">
              <Icon name="home" />
            </button>
          </div>
        </header>

        {/* Views */}
        {view === 'new' && (
          <NewResearchView
            onSubmit={handleResearch}
            isLoading={isLoading}
            documents={documents}
            onUpload={handleUploadDocument}
            onRemoveDoc={handleRemoveDocument}
            onViewDoc={handleViewDocument}
            docPending={docPending}
            docError={docError}
            removingDocIds={removingDocIds}
          />
        )}

        {view === 'library' && (
          <LibraryView
            sessions={sessions}
            onOpenSession={handleOpenSession}
            onDeleteSession={handleDeleteSession}
            onRenameSession={handleRenameSession}
            processingIds={processingIds}
          />
        )}

        {view === 'insights' && <InsightsView />}

        {view === 'settings' && <SettingsView />}

        {view === 'chat' && (
          <>
            <section ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto px-6 py-8 md:px-12 space-y-10 relative">
              {/* Subtle ambient background */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px]"
                  style={{ backgroundColor: 'rgba(160,120,255,0.04)' }}
                  animate={{ x: [0, 30, -15, 0], y: [0, -20, 25, 0] }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
                <motion.div className="absolute bottom-1/3 left-1/5 w-[350px] h-[350px] rounded-full blur-[120px]"
                  style={{ backgroundColor: 'rgba(208,188,255,0.03)' }}
                  animate={{ x: [0, -20, 10, 0], y: [0, 15, -20, 0] }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
              </div>
              <div className="w-full space-y-10 relative z-10">
                <AnimatePresence>
                  {messages.map((msg, i) =>
                    msg.role === 'user'
                      ? <UserMessage key={msg.id} message={msg} />
                      : <AssistantMessage
                          key={msg.id}
                          message={msg}
                          streamingStatus={statusMsg}
                          isLast={i === messages.length - 1}
                          onSuggestion={text => !isLoading && sendMessage(text)}
                          onRegenerate={() => handleRegenerate(msg.id)}
                        />
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} className="h-44" />
              </div>
            </section>

            {/* Scroll-to-bottom button (appears when scrolled up) */}
            <AnimatePresence>
              {!atBottom && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  onClick={scrollToBottom}
                  aria-label="Scroll to latest"
                  className="absolute left-1/2 -translate-x-1/2 bottom-40 z-20 w-10 h-10 rounded-full flex items-center justify-center border shadow-xl"
                  style={{ backgroundColor: 'rgba(45,52,73,0.95)', borderColor: 'rgba(208,188,255,0.25)', color: '#d0bcff' }}>
                  <Icon name="arrow_downward" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Floating follow-up input — extra bottom padding on mobile clears the bottom nav */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pb-24 md:p-6 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(11,19,38,1) 55%, transparent)' }}>
              <div className="w-full pointer-events-auto px-6 md:px-12">
                <div className="relative rounded-3xl p-2 border"
                  style={{ background: 'rgba(45,52,73,0.7)', backdropFilter: 'blur(20px)', borderColor: 'rgba(73,68,84,0.25)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
                  {isLoading && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full flex items-center gap-2 border shadow-xl whitespace-nowrap"
                      style={{ backgroundColor: 'rgba(45,52,73,0.95)', borderColor: 'rgba(73,68,84,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#d0bcff' }} />
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#dae2fd', fontFamily: 'Manrope, sans-serif' }}>
                        {statusMsg || 'Generating…'}
                      </span>
                    </div>
                  )}
                  <div className="px-2 pt-2">
                    <DocumentChips documents={documents} pending={docPending} error={docError} onRemove={handleRemoveDocument} removingIds={removingDocIds} onView={handleViewDocument} />
                  </div>
                  <form onSubmit={handleFollowUp} className="flex items-end gap-2 p-1">
                    <AttachButton onSelect={handleUploadDocument} disabled={isLoading || !!docPending} />
                    <AutoGrowTextarea
                      value={followUp}
                      onChange={e => setFollowUp(e.target.value)}
                      onSubmit={handleFollowUp}
                      maxHeight={200}
                      className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-3 py-3 text-sm leading-relaxed"
                      placeholder={isLoading ? 'Type your next question…' : 'Ask a follow up question…'}
                      style={{ color: '#dae2fd', fontFamily: 'Inter, sans-serif' }}
                      inputRef={followUpRef}
                      ariaLabel="Ask a follow up question"
                      submitDisabled={isLoading}
                    />
                    {isLoading ? (
                      <button type="button" onClick={handleStop} aria-label="Stop generating"
                        className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0 border"
                        style={{ backgroundColor: 'rgba(45,52,73,0.9)', borderColor: 'rgba(208,188,255,0.3)', color: '#d0bcff' }}>
                        <Icon name="stop" style={{ fontVariationSettings: "'FILL' 1" }} />
                      </button>
                    ) : (
                      <button type="submit" disabled={!followUp.trim()} aria-label="Send message"
                        className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        style={{ background: 'linear-gradient(135deg, #d0bcff, #a078ff)', color: '#340080' }}>
                        <Icon name="send" style={{ fontVariationSettings: "'FILL' 1" }} />
                      </button>
                    )}
                  </form>
                </div>
                <p className="text-center text-[10px] mt-3" style={{ color: 'rgba(203,195,215,0.3)', fontFamily: 'Inter, sans-serif' }}>
                  FusionAI may produce inaccurate information. Verify critical data.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t flex items-center justify-around px-6 z-50"
        style={{ backgroundColor: 'rgba(11,19,38,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(73,68,84,0.15)' }}>
        {[
          { id: 'new', icon: 'add_circle', label: 'New' },
          { id: 'library', icon: 'auto_stories', label: 'Library' },
          { id: 'insights', icon: 'monitoring', label: 'Insights' },
          { id: 'settings', icon: 'settings', label: 'Settings' },
        ].map(item => (
          <button key={item.id} onClick={() => handleNavChange(item.id)}
            className="flex flex-col items-center gap-1"
            style={{ color: activeNav === item.id ? '#d0bcff' : 'rgba(218,226,253,0.35)', fontFamily: 'Manrope, sans-serif' }}>
            <Icon name={item.icon} style={activeNav === item.id ? { fontVariationSettings: "'FILL' 1" } : {}} />
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Document viewer modal */}
      <AnimatePresence>
        {viewingDoc && <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
      </AnimatePresence>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/research" element={<ResearchApp />} />
      </Routes>
    </ErrorBoundary>
  )
}
