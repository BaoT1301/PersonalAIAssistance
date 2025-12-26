import { useState } from 'react'
import axios from 'axios'
import './App.css'

function App() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const API_URL = import.meta.env.VITE_API_URL || 'https://fusionai-backend-suul.onrender.com'

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
      {/* Top Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">FusionAI</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      {!result && (
        <div className="hero">
          <div className="hero-content">
            <h1 className="hero-title">FusionAI</h1>
            <p className="hero-subtitle">
              Fusing research knowledge from multiple sources into comprehensive insights
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="content">
        <div className="search-container">
          <form onSubmit={handleSubmit} className="search-form">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to research?"
              className="search-input"
              disabled={loading}
            />
            <button 
              type="submit" 
              className="search-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Researching
                </>
              ) : (
                <>Search</>
              )}
            </button>
          </form>

           {/* Simple Loading Message */}
          {loading && (
            <div className="loading-box">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p>Gathering research data...</p>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="results-container">
            <div className="results-header">
              <h2 className="results-topic">{result.topic}</h2>
              <button onClick={handleReset} className="btn-secondary">
                New Search
              </button>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Summary</h3>
              </div>
              <div className="card-body">
                <div className="summary">{result.summary}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Sources ({result.sources.length})</h3>
              </div>
              <div className="card-body">
                <div className="sources">
                  {result.sources.map((source, index) => (
                    <div key={index} className="source-item">
                      <span className="source-num">{index + 1}</span>
                      <span>{source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="tools-used">
              <span className="tools-label">Tools used:</span>
              {result.tools_used.map((tool, index) => (
                <span key={index} className="tool-tag">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && !error && (
          <div className="empty-state">
            <div className="empty-icon">💡</div>
            <h3>Start Your Research</h3>
            <p>Enter any topic to get comprehensive AI-powered insights</p>
            <div className="feature-grid">
              <div className="feature">
                <div className="feature-icon">⚡</div>
                <div className="feature-text">Fast Results</div>
              </div>
              <div className="feature">
                <div className="feature-icon">🌐</div>
                <div className="feature-text">Web Search</div>
              </div>
              <div className="feature">
                <div className="feature-icon">📚</div>
                <div className="feature-text">Wikipedia</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App