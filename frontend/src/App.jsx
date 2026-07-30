import React, { useState, useEffect, useRef } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Icon } from './ui/Icon'
import { TearLine, Stamp, SourceStub, LedgerRow, IndexCard } from './ui/paper'
import { FusionMark } from './ui/Brand'
import LandingPage from './landing/Landing'
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
      <div style={{ minHeight: '100vh', backgroundColor: '#fbf8f2', color: '#1a1613', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, fontFamily: "'Hanken Grotesk Variable', sans-serif", textAlign: 'center' }}>
        <Icon name="error_outline" style={{ fontSize: '48px', color: '#c4402e' }} />
        <p style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Newsreader Variable', serif" }}>Something went wrong</p>
        <p style={{ color: '#6f675b', maxWidth: 400 }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
        <button onClick={() => this.setState({ hasError: false, error: null })}
          style={{ padding: '10px 24px', borderRadius: 9, background: '#c4402e', color: '#fbf8f2', fontWeight: 600, fontFamily: "'Hanken Grotesk Variable', sans-serif", cursor: 'pointer', border: 'none' }}>
          Try again
        </button>
      </div>
    )
  }
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

function CitationRef({ n, source }) {
  const label = source ? (source.title || source.url || `Source ${n}`) : `Source ${n}`
  const chip = <sup className="ml-px font-mono text-[0.72em] font-semibold text-accent">[{n}]</sup>
  return source?.url
    ? <a href={source.url} target="_blank" rel="noopener noreferrer" title={label} className="no-underline hover:opacity-70">{chip}</a>
    : <span title={label} className="cursor-help">{chip}</span>
}

function Markdown({ children, sources = [] }) {
  const text = children || ''
  // Turn inline [n] markers into clickable citation refs (only when a matching
  // source exists), so answers cite claim-by-claim like a real research paper.
  const processed = sources.length
    ? text.replace(/\[(\d{1,2})\]/g, (m, d) => (Number(d) >= 1 && Number(d) <= sources.length ? `[${d}](#cite-${d})` : m))
    : text
  return (
    <div className="fusion-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children: c, ...props }) => {
            const match = /^#cite-(\d+)$/.exec(href || '')
            if (match) return <CitationRef n={Number(match[1])} source={sources[Number(match[1]) - 1]} />
            return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{c}</a>
          },
        }}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}

// ─── Research app shared utilities ────────────────────────────────────────────

const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'web-client'
// VITE_API_URL: set to your backend/gateway origin in production.
// Leave unset in development — Vite's dev-server proxy handles /api/* and /auth/*.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

// ─── Auth (opt-in; enabled when running behind the gateway) ────────────────────
// Set VITE_AUTH_ENABLED=true and point the proxy at the gateway to require login.
const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED === 'true'
const TOKEN_KEY = 'fusionai_token'
const USER_KEY = 'fusionai_user'
function getToken() { return localStorage.getItem(TOKEN_KEY) }
function getUser() { return localStorage.getItem(USER_KEY) }
function setAuth(token, user) {
  if (token) { localStorage.setItem(TOKEN_KEY, token); if (user) localStorage.setItem(USER_KEY, user) }
  else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
}
async function authRequest(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || data.detail || data.error || `Request failed (${res.status})`)
  return data
}
function baseHeaders(extra = {}) {
  const headers = { 'x-fusion-workspace-id': WORKSPACE_ID, ...extra }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}
function handleUnauthorized(res) {
  if (res.status === 401 && AUTH_ENABLED) { setAuth(null); window.location.reload() }
}

async function apiCall(path, options = {}) {
  const headers = baseHeaders(options.headers)
  if (options.body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    handleUnauthorized(res)
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
  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: baseHeaders(), body: form })
  if (!res.ok) {
    handleUnauthorized(res)
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
    headers: baseHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    handleUnauthorized(res)
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
    { id: 'new', icon: 'add_circle', label: 'New research' },
    { id: 'library', icon: 'auto_stories', label: 'Library' },
    { id: 'insights', icon: 'monitoring', label: 'Insights' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ]
  return (
    <aside className="hidden md:flex h-screen w-72 flex-col fixed left-0 top-0 z-40 border-r border-line bg-paper-2">
      <div className="flex h-full flex-col overflow-hidden">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
          <span className="inline-flex items-center gap-2.5">
            <FusionMark size={24} />
            <span className="font-serif text-lg font-semibold tracking-tight text-ink">FusionAI</span>
          </span>
          <Stamp label="v1" tone="muted" rotate={-4} className="!px-1.5 !text-[8px] !tracking-[0.16em]" />
        </div>

        {/* Nav — ledger index */}
        <nav className="flex shrink-0 flex-col px-3 pt-4">
          {NAV.map(item => {
            const active = activeNav === item.id
            return (
              <button key={item.id} onClick={() => onNavChange(item.id)}
                className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors ${active ? 'border-accent bg-paper text-accent' : 'border-transparent text-muted hover:bg-paper/60 hover:text-ink'}`}>
                <Icon name={item.icon} style={{ fontSize: '17px' }} weight={active ? 'fill' : 'regular'} />
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Recent — tearline-separated ledger list */}
        {sessions.length > 0 && (
          <div className="mt-5 flex min-h-0 flex-1 flex-col px-4">
            <TearLine />
            <p className="shrink-0 pb-2 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Recent</p>
            <div className="flex-1 overflow-y-auto">
              {sessions.slice(0, 14).map((s, i) => (
                <button key={s.id} onClick={() => onSessionClick(s)}
                  className="group flex w-full items-center gap-2.5 border-b border-line/70 py-2 text-left transition-colors hover:bg-paper/60"
                  title={s.title}>
                  <span className="w-5 shrink-0 font-mono text-[10px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                  <span className="truncate font-sans text-[13px] text-muted group-hover:text-ink">{s.title || 'Untitled session'}</span>
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
        className="shrink-0 rounded-sm p-2.5 transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40"
        style={{ color: 'rgba(196,64,46,0.75)' }}>
        <Icon name="attach_file" />
      </button>
    </>
  )
}

function ReuseButton({ onReuse, existingIds, disabled }) {
  const [open, setOpen] = useState(false)
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true); setLoading(true)
    try { setDocs(await apiCall('/api/documents')) } catch { setDocs([]) } finally { setLoading(false) }
  }

  const seen = new Set()
  const available = (docs || []).filter(d => {
    if (existingIds.has(d.id) || seen.has(d.title)) return false
    seen.add(d.title)
    return true
  })

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={toggle} disabled={disabled} aria-label="Reuse a document"
        title="Reuse a document you uploaded before"
        className="rounded-sm p-2.5 text-muted transition-colors hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40">
        <Icon name="auto_stories" style={{ fontSize: '18px' }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-40 mb-2 max-h-64 w-64 overflow-y-auto rounded-md border border-line bg-paper shadow-paper">
            <p className="sticky top-0 border-b border-line bg-paper px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Your documents</p>
            {loading ? (
              <p className="px-3 py-3 font-sans text-sm text-muted">Loading…</p>
            ) : available.length === 0 ? (
              <p className="px-3 py-3 font-sans text-sm text-muted">No documents to reuse yet.</p>
            ) : available.map(d => (
              <button key={d.id} type="button" onClick={() => { onReuse(d.id); setOpen(false) }}
                className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-paper-2">
                <Icon name={docIcon(d.source_type)} style={{ color: '#c4402e', fontSize: '15px' }} />
                <span className="min-w-0 flex-1 truncate font-sans text-sm text-ink">{d.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-faint">{(d.content_length / 1000).toFixed(0)}k</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DocumentChips({ documents, pending, error, onRemove, removingIds, onView }) {
  if (!documents.length && !pending && !error) return null
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {documents.map(doc => (
        <div key={doc.id}
          className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-md border text-xs"
          style={{ backgroundColor: 'rgba(243,237,225,0.75)', borderColor: 'rgba(196,64,46,0.2)', color: '#1a1613', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
          <Icon name={docIcon(doc.source_type)} style={{ fontSize: '16px', color: '#c4402e' }} />
          <button type="button" onClick={() => onView?.(doc.id)}
            className="max-w-[180px] truncate font-semibold hover:underline" title={`View “${doc.title}”`}>
            {doc.title}
          </button>
          <span style={{ color: 'rgba(111,103,91,0.4)' }}>{(doc.content_length / 1000).toFixed(1)}k chars</span>
          <button type="button" onClick={() => onRemove(doc.id)} disabled={removingIds.has(doc.id)}
            className="grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-paper disabled:opacity-50"
            aria-label={`Remove ${doc.title}`} title="Remove document">
            <Icon name={removingIds.has(doc.id) ? 'hourglass_empty' : 'close'} style={{ fontSize: '13px', color: 'rgba(111,103,91,0.6)' }} />
          </button>
        </div>
      ))}
      {pending && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs"
          style={{ backgroundColor: 'rgba(243,237,225,0.75)', borderColor: 'rgba(196,64,46,0.2)', color: 'rgba(26,22,19,0.7)', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
          <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: '#c4402e', borderTopColor: 'transparent' }} />
          <span className="max-w-[180px] truncate">Reading {pending}…</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs"
          style={{ backgroundColor: 'rgba(196,64,46,0.08)', borderColor: 'rgba(196,64,46,0.35)', color: '#c4402e', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
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
      style={{ backgroundColor: 'rgba(26,22,19,0.45)' }}
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-line bg-paper shadow-paper">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Icon name={docIcon(doc.source_type)} style={{ color: '#c4402e' }} />
            <div className="min-w-0">
              <p className="truncate font-serif text-base font-semibold text-ink">{doc.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                {doc.source_type} · {doc.content_length.toLocaleString()} chars extracted
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close document viewer"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-muted transition-colors hover:bg-paper-2 hover:text-ink">
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto bg-paper-2 px-5 py-4">
          <pre className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-muted">
            {doc.content_text}
          </pre>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── New Research View ────────────────────────────────────────────────────────

function NewResearchView({ onSubmit, isLoading, documents, onUpload, onReuse, onRemoveDoc, onViewDoc, docPending, docError, removingDocIds }) {
  const [query, setQuery] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (q && !isLoading) { onSubmit(q); setQuery('') }
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-12 relative">
      <div className="w-full max-w-3xl relative z-10 flex flex-col items-center">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="mb-10 text-center">
          <div className="mb-6 flex justify-center"><FusionMark size={40} /></div>
          <h2 className="font-serif text-5xl font-semibold tracking-tight text-ink md:text-6xl" style={{ lineHeight: 1.02 }}>
            What are we <em className="not-italic ruled">researching</em>?
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-sans text-lg text-muted">
            Ask anything. FusionAI reads Wikipedia, the open web, and your files, then prints one cited answer.
          </p>
        </motion.div>

        {/* Composer — research request slip */}
        <motion.form
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
          onSubmit={handleSubmit} className="mb-10 w-full">
          <div className="flex items-end gap-1 rounded-md border border-line-strong bg-paper-2 p-2 transition-colors focus-within:border-accent">
            <div className="self-stretch px-3 pt-3.5 text-accent"><Icon name="search" style={{ fontSize: '22px' }} /></div>
            <AutoGrowTextarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onSubmit={handleSubmit}
              maxHeight={260}
              className="w-full border-none bg-transparent py-4 text-lg leading-relaxed outline-none focus:ring-0"
              placeholder="Type your question…"
              style={{ color: '#1a1613', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}
              disabled={isLoading}
              submitDisabled={isLoading}
              ariaLabel="Research question"
              autoFocus
            />
            <div className="flex items-center gap-1 pb-1">
              <AttachButton onSelect={onUpload} disabled={isLoading || !!docPending} />
              <ReuseButton onReuse={onReuse} existingIds={new Set(documents.map(d => d.id))} disabled={isLoading || !!docPending} />
              <motion.button
                type="submit"
                disabled={isLoading || !query.trim()}
                aria-label="Start research"
                whileTap={{ scale: 0.9, rotate: -5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                className="grid h-11 w-11 place-items-center rounded-sm bg-accent text-on-accent disabled:cursor-not-allowed disabled:opacity-40">
                {isLoading
                  ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <Icon name="send" style={{ fontVariationSettings: "'FILL' 1" }} />}
              </motion.button>
            </div>
          </div>
          {(documents.length > 0 || docPending || docError) && (
            <div className="mt-3 flex justify-center">
              <DocumentChips documents={documents} pending={docPending} error={docError} onRemove={onRemoveDoc} removingIds={removingDocIds} onView={onViewDoc} />
            </div>
          )}
          <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Enter to send · Shift+Enter for a new line · attach PDF / Word / TXT
          </p>
        </motion.form>

        {/* Topic index cards */}
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {TOPIC_CARDS.map((card, i) => (
            <motion.button
              key={card.title}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.08, ease: 'easeOut' }}
              whileHover={{ y: -4 }}
              onClick={() => !isLoading && onSubmit(card.query)}
              disabled={isLoading}
              className="group rounded-md border border-line bg-paper-2 p-5 text-left transition-colors hover:border-line-strong disabled:opacity-50">
              <div className="mb-4 flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-sm border border-line bg-paper text-accent">
                  <Icon name={card.icon} style={{ fontSize: '18px' }} />
                </span>
                <span className="font-mono text-[11px] text-faint">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="font-serif text-base font-semibold text-ink">{card.title}</h3>
              <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">{card.desc}</p>
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
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex flex-col items-end gap-1.5">
      <div className="flex max-w-[80%] items-start gap-2.5 rounded-sm border border-line bg-paper-2 px-4 py-3">
        <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint shrink-0">You</span>
        <p className="font-sans text-sm leading-relaxed text-ink">{message.content}</p>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{time}</span>
    </motion.div>
  )
}

function friendlyError(message) {
  const m = (message || '').toLowerCase()
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('err_connection'))
    return 'Could not reach the server. Check your connection and try again.'
  if (m.includes('rate limit') || m.includes('429') || m.includes('slow down'))
    return 'You are going a bit fast. Please wait a moment, then try again.'
  if (m.includes('401') || m.includes('unauthor') || m.includes('expired'))
    return 'Your session expired. Please sign in again.'
  if (m.includes('aborted')) return 'Generation stopped.'
  return message || 'Something went wrong. Please try again.'
}

function exportMarkdown(message) {
  const parts = [message.content || '']
  if (message.sources && message.sources.length) {
    parts.push('', '## Sources')
    message.sources.forEach((s, i) => {
      const label = s.title || s.url || 'source'
      parts.push(`${i + 1}. ${label}${s.url ? ' — ' + s.url : ''}`)
    })
  }
  parts.push('', '_Generated by FusionAI_')
  const blob = new Blob([parts.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'fusionai-answer.md'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function AssistantMessage({ message, onSuggestion, onRegenerate, isLast, streamingStatus }) {
  const streaming = !!message.streaming
  const sources = !streaming && message.sources ? message.sources : []
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

  const high = !streaming && message.confidence === 'high'
  const done = !streaming && !message.isError

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-md border border-line bg-paper">
      {done && <div className="h-[3px] w-full bg-accent" aria-hidden="true" />}
      <div className="p-5 sm:p-6">
        {/* receipt header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-ink">
            <FusionMark size={17} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Research receipt</span>
          </span>
          {done && message.confidence && (
            <span title={message.confidenceReason || ''} className="cursor-help">
              {high
                ? <Stamp label="Verified" rotate={-6} className="!text-[10px]" />
                : <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{message.confidence} confidence</span>}
            </span>
          )}
        </div>

        {/* body */}
        {streaming && !message.content ? (
          <div className="flex items-center gap-2.5 py-1" aria-live="polite">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">{streamingStatus || 'Reading sources'}</span>
          </div>
        ) : message.isError ? (
          <div>
            <p className="font-sans text-sm leading-relaxed text-accent">{message.content}</p>
            {onRegenerate && (
              <button onClick={onRegenerate}
                className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink transition-colors hover:border-accent hover:text-accent">
                <Icon name="refresh" style={{ fontSize: '13px' }} />
                Try again
              </button>
            )}
          </div>
        ) : (
          <div className="relative" aria-live="polite">
            <Markdown sources={sources}>{message.content}</Markdown>
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-accent align-middle" />}
          </div>
        )}

        {/* tool tags */}
        {toolNames.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {toolNames.map(t => (
              <span key={t} className="rounded-sm border border-line bg-paper-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{t}</span>
            ))}
          </div>
        )}

        {/* source tear-off stubs */}
        {sources.length > 0 && (
          <div className="mt-5">
            <TearLine />
            <p className="pb-2.5 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Sources</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {sources.map((src, i) => (
                <SourceStub key={i} n={String(i + 1)} label={src.title || src.url || 'source'} href={src.url || undefined} snippet={src.snippet} />
              ))}
            </div>
          </div>
        )}

        {/* no-sources disclosure */}
        {done && sources.length === 0 && (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            General knowledge. No external sources cited.
          </p>
        )}

        {/* follow-ups as ledger rows */}
        {followUps.length > 0 && (
          <div className="mt-5">
            <TearLine />
            <p className="pb-1 pt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Next questions</p>
            <div className="flex flex-col">
              {followUps.slice(0, 4).map((q, i) => (
                <button key={i} onClick={() => onSuggestion?.(q)}
                  className="group flex items-center gap-2.5 border-b border-line py-2.5 text-left transition-colors hover:bg-paper-2/60">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="font-sans text-sm text-muted group-hover:text-ink">{q}</span>
                  <Icon name="arrow_forward" style={{ fontSize: '13px' }} className="ml-auto text-faint" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* actions */}
        {done && (
          <div className="mt-5 flex items-center gap-1">
            <button onClick={handleCopy} aria-label="Copy answer" title="Copy answer"
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors hover:bg-paper-2"
              style={{ color: copied ? '#4b6b53' : '#6f675b' }}>
              <Icon name={copied ? 'check' : 'content_copy'} style={{ fontSize: '13px' }} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => exportMarkdown(message)} aria-label="Export answer as Markdown" title="Export as Markdown"
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:bg-paper-2">
              <Icon name="description" style={{ fontSize: '13px' }} />
              Export
            </button>
            {isLast && onRegenerate && (
              <button onClick={onRegenerate} aria-label="Regenerate answer" title="Regenerate answer"
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted transition-colors hover:bg-paper-2">
                <Icon name="refresh" style={{ fontSize: '13px' }} />
                Redo
              </button>
            )}
            <span className="ml-1 font-mono text-[10px] text-faint">{time}</span>
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
        style={{ backgroundColor: 'rgba(236,227,211,0.6)' }}>
        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#c4402e', borderTopColor: 'transparent' }} />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold" style={{ color: '#c4402e', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>{LOADING_STEPS[step]}</span>
        <span className="text-[10px]" style={{ color: 'rgba(111,103,91,0.4)', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>This may take a few seconds…</span>
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

  // Full-text search (titles + the questions asked) via the backend, debounced;
  // falls back to a client-side title filter while the request is in flight.
  const [serverResults, setServerResults] = useState(null)
  useEffect(() => {
    const q = search.trim()
    if (!q) { setServerResults(null); return }
    let alive = true
    const t = setTimeout(() => {
      apiCall(`/api/search?q=${encodeURIComponent(q)}`)
        .then(r => { if (alive) setServerResults(r) })
        .catch(() => {})
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [search])

  const filtered = search.trim()
    ? (serverResults ?? sessions.filter(s => (s.title || '').toLowerCase().includes(search.toLowerCase())))
    : sessions

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
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-ink">Library</h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{sessions.length} sessions</span>
          </div>
          <div className="flex max-w-xs flex-1 items-center gap-2 rounded-sm border border-line bg-paper-2 px-3 py-2">
            <Icon name="search" style={{ color: '#9a9082', fontSize: '17px' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 border-none bg-transparent text-sm outline-none focus:ring-0"
              placeholder="Search the catalog…"
              style={{ color: '#1a1613', fontFamily: "'Hanken Grotesk Variable', sans-serif" }} />
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-5 py-24">
            <Stamp label="No entries" tone="muted" rotate={-8} style={{ fontSize: '15px', padding: '6px 16px' }} />
            <p className="font-sans text-sm text-muted">
              {search ? 'No sessions match your search.' : 'Start a new research to fill the catalog.'}
            </p>
          </div>
        )}

        {/* Session index cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((session, idx) => (
            <div key={session.id}
              className="group cursor-pointer rounded-md border border-line bg-paper-2 p-5 transition-colors hover:border-line-strong"
              onClick={() => !editingId && onOpenSession(session)}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] text-faint">No. {String(idx + 1).padStart(3, '0')}</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={e => startEdit(session, e)} aria-label="Rename session"
                    className="grid h-7 w-7 place-items-center rounded-sm border border-line text-muted transition-colors hover:border-line-strong hover:text-ink">
                    <Icon name="edit" style={{ fontSize: '13px' }} />
                  </button>
                  <button onClick={e => confirmDelete(session.id, e)} disabled={processingIds.has(session.id)}
                    className="grid h-7 w-7 place-items-center rounded-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ borderColor: deletingId === session.id ? '#c4402e' : '#e4dac6', color: deletingId === session.id ? '#c4402e' : '#6f675b' }}
                    aria-label="Delete session"
                    title={processingIds.has(session.id) ? 'Deleting…' : deletingId === session.id ? 'Click again to confirm' : 'Delete session'}>
                    <Icon name={processingIds.has(session.id) ? 'hourglass_empty' : deletingId === session.id ? 'warning' : 'delete'} style={{ fontSize: '13px' }} />
                  </button>
                </div>
              </div>
              {editingId === session.id ? (
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => commitEdit(session.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(session.id); if (e.key === 'Escape') setEditingId(null) }}
                  onClick={e => e.stopPropagation()}
                  className="w-full border-b bg-transparent text-base font-semibold outline-none"
                  style={{ color: '#1a1613', borderColor: '#c4402e', fontFamily: "'Newsreader Variable', serif" }}
                  autoFocus />
              ) : (
                <h3 className="line-clamp-2 font-serif text-base font-semibold leading-snug text-ink">
                  {session.title || 'Untitled session'}
                </h3>
              )}
              <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-faint">
                {session.result_count > 0 && (
                  <span className="text-accent">{session.result_count} {session.result_count === 1 ? 'query' : 'queries'}</span>
                )}
                <span>{formatRelativeTime(session.updated_at)}</span>
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
      <div className="rounded-md border border-line bg-paper-2 p-5">
        <Icon name={icon} style={{ color: '#c4402e', fontSize: '18px' }} />
        <p className="mt-3 font-serif text-4xl font-semibold leading-none text-ink">{value}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{label}</p>
        {sub && <p className="mt-1 font-mono text-[10px] text-faint">{sub}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: '#c4402e', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'rgba(111,103,91,0.5)', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>Loading insights…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <Icon name="error_outline" style={{ color: '#c4402e', fontSize: '40px' }} />
          <p className="mt-3 font-semibold" style={{ color: '#1a1613', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>Failed to load insights</p>
          <p className="text-sm mt-1" style={{ color: 'rgba(111,103,91,0.5)', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>{error}</p>
        </div>
      </div>
    )
  }

  const confTotal = Object.values(data.confidence_breakdown).reduce((a, b) => a + b, 0) || 1
  const confColors = { high: '#4b6b53', medium: '#c4402e', low: 'rgba(196,64,46,0.45)' }
  const confLabels = { high: 'High', medium: 'Medium', low: 'Low' }
  const maxToolCount = data.top_tools[0]?.count || 1

  const LedgerBar = ({ label, count, suffix, color, pct }) => (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]" style={{ color: color || '#c4402e' }}>{label}</span>
        <span className="font-mono text-[11px] text-faint">{count}{suffix}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color || '#c4402e' }} />
      </div>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-ink">Insights</h2>

        {/* Stat sheet */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon="forum" label="Research sessions" value={data.total_sessions} />
          <StatCard icon="search" label="Total queries" value={data.total_queries} />
          <StatCard icon="attach_file" label="Documents uploaded" value={data.total_documents} />
          <StatCard icon="bolt" label="Cache hit rate" value={`${data.cache_hit_rate}%`} sub={`${data.avg_latency_ms}ms avg latency`} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Confidence */}
          <div className="rounded-md border border-line bg-paper-2 p-6">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Answer confidence</p>
            {confTotal === 1 && data.total_queries === 0 ? (
              <p className="font-sans text-sm text-faint">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(data.confidence_breakdown).map(([key, count]) => (
                  <LedgerBar key={key} label={confLabels[key]} count={count} color={confColors[key]} pct={(count / confTotal) * 100} />
                ))}
              </div>
            )}
          </div>

          {/* Tools */}
          <div className="rounded-md border border-line bg-paper-2 p-6">
            <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Tools used</p>
            {data.top_tools.length === 0 ? (
              <p className="font-sans text-sm text-faint">No data yet.</p>
            ) : (
              <div className="space-y-4">
                {data.top_tools.map(t => (
                  <LedgerBar key={t.name} label={toolDisplayName(t.name)} count={t.count} suffix="×" pct={(t.count / maxToolCount) * 100} />
                ))}
              </div>
            )}
          </div>

          {/* Recent activity — ledger rows */}
          {data.recent_activity.length > 0 && (
            <div className="rounded-md border border-line bg-paper-2 p-6 md:col-span-2">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">Recent activity</p>
              <div>
                {data.recent_activity.map((item, i) => (
                  <LedgerRow key={i} index={String(i + 1).padStart(2, '0')}>
                    <span className="min-w-0 flex-1 truncate font-sans text-sm text-ink">{item.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-accent">{item.query_count} {item.query_count === 1 ? 'query' : 'queries'}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{formatRelativeTime(item.updated_at)}</span>
                  </LedgerRow>
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

  function SettingRow({ label, value }) {
    return (
      <div className="flex items-center justify-between border-b border-line py-3.5 last:border-b-0">
        <span className="font-sans text-sm text-muted">{label}</span>
        <span className="font-mono text-[13px] text-ink">{value}</span>
      </div>
    )
  }

  function Section({ title, children }) {
    return (
      <div className="mb-8">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">{title}</p>
        <div className="rounded-md border border-line bg-paper-2 px-5">{children}</div>
      </div>
    )
  }

  const isOnline = !loading && !!health && health.database_connected

  return (
    <div className="flex-1 overflow-y-auto px-6 py-10 md:px-10">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-8 font-serif text-3xl font-semibold tracking-tight text-ink">Settings</h2>

        <Section title="Service status">
          <div className="flex items-center justify-between py-4">
            <span className="font-sans text-sm text-muted">FusionAI Research</span>
            {loading
              ? <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Checking…</span>
              : <Stamp label={isOnline ? 'Live' : 'Down'} rotate={-4} className="!text-[10px]" style={isOnline ? undefined : { color: '#6f675b', borderColor: '#6f675b' }} />}
          </div>
        </Section>

        <Section title="About">
          <SettingRow label="App" value="FusionAI Research" />
          <SettingRow label="Version" value={health ? `v${health.version}` : 'v2.1.0'} />
          <SettingRow label="AI model" value="GPT-4o mini" />
          <SettingRow label="Built with" value="React · FastAPI · LangChain" />
        </Section>
      </div>
    </div>
  )
}

// ─── Auth screen + gate ───────────────────────────────────────────────────────

function AuthScreen({ onAuthed }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      const data = await authRequest(`/auth/${mode}`, { username: username.trim(), password })
      setAuth(data.token, data.username)
      onAuthed(data.token, data.username)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-[100dvh] bg-paper text-ink antialiased">
      <div className="grain" aria-hidden="true" />
      <div className="relative z-[2] flex min-h-[100dvh] items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <button onClick={() => navigate('/')} className="mb-8 inline-flex items-center gap-2.5" aria-label="FusionAI home">
            <FusionMark size={26} />
            <span className="font-serif text-xl font-semibold tracking-tight text-ink">FusionAI</span>
          </button>
          <div className="rounded-md border border-line bg-paper-2 p-6">
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-1.5 font-sans text-sm text-muted">
              {mode === 'login' ? 'Sign in to pick up your research.' : 'Start keeping the receipts.'}
            </p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username"
                  className="w-full rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  placeholder="jane.researcher" />
              </div>
              <div>
                <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="w-full rounded-sm border border-line-strong bg-paper px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} />
              </div>
              {error && <p className="font-sans text-sm text-accent">{error}</p>}
              <button type="submit" disabled={busy || !username.trim() || !password}
                className="w-full rounded-md bg-accent px-4 py-2.5 font-sans text-sm font-semibold text-on-accent transition-transform hover:-translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>
          </div>
          <p className="mt-5 text-center font-sans text-sm text-muted">
            {mode === 'login' ? 'No account yet? ' : 'Already have one? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="font-semibold text-accent hover:underline">
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function ResearchAppGate() {
  const [authed, setAuthed] = useState(!AUTH_ENABLED || !!getToken())
  if (AUTH_ENABLED && !authed) return <AuthScreen onAuthed={() => setAuthed(true)} />
  return <ResearchApp onLogout={() => { setAuth(null); setAuthed(false) }} />
}

// ─── Research App ─────────────────────────────────────────────────────────────

function ResearchApp({ onLogout }) {
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
  const [searchParams, setSearchParams] = useSearchParams()
  const bootSessionRef = useRef(searchParams.get('s'))

  useEffect(() => {
    apiCall('/api/sessions').then(setSessions).catch(() => {})
  }, [])

  // Restore a session from the URL on load, so refresh / back keeps the thread.
  useEffect(() => {
    if (bootSessionRef.current) handleOpenSession({ id: bootSessionRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the current session id in the URL as it changes.
  useEffect(() => {
    if (sessionId) setSearchParams({ s: sessionId }, { replace: true })
  }, [sessionId, setSearchParams])

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
      setSearchParams({}, { replace: true })
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

  // Reuse a document uploaded in another session by copying it into this one.
  async function handleReuseDocument(docId) {
    setDocError(null)
    try {
      const id = await ensureSession()
      const doc = await apiCall(`/api/sessions/${id}/documents/${docId}/reuse`, { method: 'POST' })
      setDocuments(prev => [...prev, doc])
      refreshSessions()
    } catch (err) {
      setDocError(err.message)
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
              confidenceReason: ev.confidence_reason,
              followUps: ev.follow_up_questions || [],
            }))
            refreshSessions()
            // Avoid yanking the viewport / popping the keyboard on touch devices.
            if (!window.matchMedia('(pointer: coarse)').matches) {
              setTimeout(() => followUpRef.current?.focus(), 60)
            }
          } else if (ev.type === 'error') {
            throw new Error(ev.message)
          }
        },
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        patch(m => ({ streaming: false, stopped: true, content: m.content || '_Generation stopped._' }))
      } else {
        patch(() => ({ streaming: false, isError: true, content: friendlyError(err.message) }))
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

  const S = { backgroundColor: '#fbf8f2', color: '#1a1613' }

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
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper px-5">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="inline-flex items-center gap-2" aria-label="FusionAI home">
              <FusionMark size={20} />
              <span className="font-serif text-lg font-semibold tracking-tight text-ink">FusionAI</span>
            </button>
            {view === 'chat' && (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-faint md:block">/ research</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {view === 'chat' && (
              <button onClick={() => handleNavChange('new')}
                className="inline-flex items-center gap-1.5 rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-accent hover:text-accent">
                <Icon name="add_circle" style={{ fontSize: '15px' }} />
                New
              </button>
            )}
            {AUTH_ENABLED && onLogout && (
              <button onClick={onLogout} aria-label="Sign out" title={getUser() ? `Sign out (${getUser()})` : 'Sign out'}
                className="inline-flex items-center rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-accent">
                Sign out
              </button>
            )}
            <button onClick={() => navigate('/')} className="grid h-9 w-9 place-items-center rounded-sm text-muted transition-colors hover:bg-paper-2 hover:text-ink" title="Back to landing page" aria-label="Back to landing page">
              <Icon name="home" style={{ fontSize: '18px' }} />
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
            onReuse={handleReuseDocument}
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
            <section ref={chatScrollRef} onScroll={handleChatScroll} className="relative flex-1 overflow-y-auto px-6 py-8 md:px-12">
              <div className="mx-auto w-full max-w-3xl space-y-8">
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
                  className="absolute bottom-40 left-1/2 z-20 grid h-9 w-9 -translate-x-1/2 place-items-center rounded-sm border border-line-strong bg-paper text-accent shadow-lift transition-colors hover:border-accent">
                  <Icon name="arrow_downward" style={{ fontSize: '18px' }} />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Floating follow-up composer (receipt slip) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-24 md:p-6"
              style={{ background: 'linear-gradient(to top, #fbf8f2 62%, transparent)' }}>
              <div className="pointer-events-auto mx-auto w-full max-w-3xl">
                <div className="relative rounded-md border border-line-strong bg-paper-2 p-2 shadow-lift">
                  {isLoading && (
                    <div className="absolute -top-9 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-sm border border-line bg-paper px-3 py-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">{statusMsg || 'Generating'}</span>
                    </div>
                  )}
                  {(documents.length > 0 || docPending || docError) && (
                    <div className="px-1 pt-1">
                      <DocumentChips documents={documents} pending={docPending} error={docError} onRemove={handleRemoveDocument} removingIds={removingDocIds} onView={handleViewDocument} />
                    </div>
                  )}
                  <form onSubmit={handleFollowUp} className="flex items-end gap-1.5 p-1">
                    <AttachButton onSelect={handleUploadDocument} disabled={isLoading || !!docPending} />
                    <ReuseButton onReuse={handleReuseDocument} existingIds={new Set(documents.map(d => d.id))} disabled={isLoading || !!docPending} />
                    <AutoGrowTextarea
                      value={followUp}
                      onChange={e => setFollowUp(e.target.value)}
                      onSubmit={handleFollowUp}
                      maxHeight={200}
                      className="flex-1 border-none bg-transparent px-2 py-3 text-sm leading-relaxed outline-none focus:ring-0"
                      placeholder={isLoading ? 'Type your next question…' : 'Ask a follow-up…'}
                      style={{ color: '#1a1613', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}
                      inputRef={followUpRef}
                      ariaLabel="Ask a follow up question"
                      submitDisabled={isLoading}
                    />
                    {isLoading ? (
                      <button type="button" onClick={handleStop} aria-label="Stop generating"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line-strong bg-paper text-accent transition-colors hover:border-accent">
                        <Icon name="stop" style={{ fontVariationSettings: "'FILL' 1" }} />
                      </button>
                    ) : (
                      <motion.button type="submit" disabled={!followUp.trim()} aria-label="Send message"
                        whileTap={{ scale: 0.9, rotate: -5 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-accent text-on-accent disabled:cursor-not-allowed disabled:opacity-40">
                        <Icon name="send" style={{ fontVariationSettings: "'FILL' 1" }} />
                      </motion.button>
                    )}
                  </form>
                </div>
                <p className="mt-2.5 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                  FusionAI can be wrong. Every claim links to a source you can check.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t flex items-center justify-around px-6 z-50"
        style={{ backgroundColor: 'rgba(251,248,242,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(213,200,174,0.15)' }}>
        {[
          { id: 'new', icon: 'add_circle', label: 'New' },
          { id: 'library', icon: 'auto_stories', label: 'Library' },
          { id: 'insights', icon: 'monitoring', label: 'Insights' },
          { id: 'settings', icon: 'settings', label: 'Settings' },
        ].map(item => (
          <button key={item.id} onClick={() => handleNavChange(item.id)}
            className="flex flex-col items-center gap-1"
            style={{ color: activeNav === item.id ? '#c4402e' : 'rgba(26,22,19,0.35)', fontFamily: "'Hanken Grotesk Variable', sans-serif" }}>
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
        <Route path="/research" element={<ResearchAppGate />} />
      </Routes>
    </ErrorBoundary>
  )
}
