import { useState } from 'react'
import axios from 'axios'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

// Smart API URL detection
const API_URL = import.meta.env.VITE_API_URL || 
                (import.meta.env.DEV 
                  ? 'http://localhost:5001' 
                  : 'https://fusionai-backend-suul.onrender.com')

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!query.trim()) {
      setError('Please enter a research topic')
      return
    }

    if (query.trim().length < 3) {
      setError('Topic too short. Please be more specific.')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await axios.post(`${API_URL}/api/research`, {
        query: query.trim()
      })
      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setQuery('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="app">
      {/* Gradient Background */}
      <div className="gradient-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Enhanced Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-icon-wrapper">
              <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="url(#gradient1)"/>
                <defs>
                  <linearGradient id="gradient1" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#667eea"/>
                    <stop offset="100%" stopColor="#00c6fb"/>
                  </linearGradient>
                </defs>
              </svg>
              <div className="icon-glow"></div>
            </div>
            <span className="logo-text">FusionAI</span>
            <span className="logo-badge">v1.1</span>
          </div>
          
          <div className="nav-stats">
            <div className="stat-item">
              <div className="stat-icon">⚡</div>
              <div className="stat-info">
                <span className="stat-value">Fast</span>
                <span className="stat-label">AI Research</span>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">🤖</div>
              <div className="stat-info">
                <span className="stat-value">Claude</span>
                <span className="stat-label">Powered</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {!result && !loading && (
          <div className="hero">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              Powered by Claude AI
            </div>
            <h1 className="hero-title">
              Your AI Research
              <span className="gradient-text"> Assistant</span>
            </h1>
            <p className="hero-subtitle">
              Fuse knowledge from Wikipedia, web search, and AI into comprehensive research insights.
  Get detailed, well-sourced answers in seconds.
            </p>
            <div className="hero-features">
              <div className="feature-tag">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Multi-Source Research
              </div>
              <div className="feature-tag">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Lightning Fast
              </div>
              <div className="feature-tag">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                AI-Powered Insights
              </div>
            </div>
          </div>
        )}

        {/* Search Container */}
        <div className={`search-section ${result ? 'compact' : ''}`}>
          <div className="glass-card search-card">
            <form onSubmit={handleSubmit} className="search-form">
              <div className="input-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask me anything..."
                  className="search-input"
                  disabled={loading}
                />
                {query && !loading && (
                  <button 
                    type="button" 
                    className="clear-btn"
                    onClick={() => setQuery('')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                className="search-btn"
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    Researching
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Search
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="alert error-alert">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}
          </div>

          {loading && (
            <div className="loading-card glass-card">
              <div className="loading-animation">
                <div className="loading-pulse">
                  <div className="pulse-ring"></div>
                  <div className="pulse-ring"></div>
                  <div className="pulse-ring"></div>
                </div>
                <p className="loading-text">Analyzing your query and gathering insights...</p>
                <div className="loading-steps">
                  <div className="step active">
                    <div className="step-icon">✓</div>
                    <span>Processing query</span>
                  </div>
                  <div className="step active">
                    <div className="step-icon">⟳</div>
                    <span>Searching sources</span>
                  </div>
                  <div className="step">
                    <div className="step-icon">○</div>
                    <span>Generating summary</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="results-section">
            <div className="results-header">
              <div className="results-title-wrapper">
                <h2 className="results-title">{result.topic}</h2>
                <div className="results-meta">
                  <span className="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Just now
                  </span>
                  <span className="meta-item">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {result.sources.length} sources
                  </span>
                </div>
              </div>
              <button onClick={handleReset} className="btn-secondary">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                New Search
              </button>
            </div>

            <div className="glass-card result-card">
              <div className="card-header">
                <h3>Research Summary</h3>
                <div className="card-actions">
                  <button className="icon-btn" title="Copy to clipboard">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="card-content">
                <div className="summary-text">{result.summary}</div>
              </div>
            </div>

            <div className="glass-card result-card">
              <div className="card-header">
                <h3>Sources & References</h3>
                <span className="badge">{result.sources.length}</span>
              </div>
              <div className="card-content">
                <div className="sources-list">
                  {result.sources.map((source, index) => (
                    <div key={index} className="source-item">
                      <span className="source-number">{index + 1}</span>
                      <span className="source-text">{source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="tools-footer">
              <span className="tools-label">Powered by</span>
              <div className="tools-list">
                {result.tools_used.map((tool, index) => (
                  <span key={index} className="tool-badge">
                    {tool === 'wikipedia' && '📚'}
                    {tool === 'search' && '🌐'}
                    {tool === 'claude' && '🤖'}
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <Analytics />
    </div>
  )
}

export default App