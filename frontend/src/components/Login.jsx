import { useState } from 'react'
import styles from './Login.module.css'

const LANGS = [
  { code: 'FI', label: 'Finnish' }, { code: 'EN', label: 'English' },
  { code: 'SV', label: 'Swedish' }, { code: 'DE', label: 'German' },
  { code: 'FR', label: 'French'  }, { code: 'ES', label: 'Spanish' },
  { code: 'IT', label: 'Italian' }, { code: 'PT', label: 'Portuguese' },
  { code: 'NL', label: 'Dutch'   }, { code: 'PL', label: 'Polish' },
  { code: 'RU', label: 'Russian' }, { code: 'JA', label: 'Japanese' },
  { code: 'ZH', label: 'Chinese' },
]

export default function Login({ onLogin }) {
  const [mode,       setMode]       = useState('login')   // login | register
  const [token,      setToken]      = useState('')
  const [name,       setName]       = useState('')
  const [nativeLang, setNativeLang] = useState('FI')
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(false)

  async function handleLogin() {
    if (!token.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/${token.trim()}/me`)
      const data = await res.json()
      if (data.error) { setError('Token not found'); setLoading(false); return }
      onLogin(token.trim(), data)
    } catch { setError('Connection error'); setLoading(false) }
  }

  async function handleRegister() {
    if (!name.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim(), nativeLang }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      onLogin(data.token, data)
    } catch { setError('Connection error'); setLoading(false) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Vocab</h1>
        <p className={styles.sub}>Personal vocabulary trainer</p>

        <div className={styles.tabs}>
          <button className={mode === 'login'    ? styles.active : ''} onClick={() => setMode('login')}>Sign in</button>
          <button className={mode === 'register' ? styles.active : ''} onClick={() => setMode('register')}>New account</button>
        </div>

        {mode === 'login' ? (
          <>
            <label className={styles.label}>Your token</label>
            <input
              className={styles.input}
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="paste your token here"
              autoFocus
            />
            <button className={styles.btn} onClick={handleLogin} disabled={loading}>
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </>
        ) : (
          <>
            <label className={styles.label}>Your name</label>
            <input
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="what should we call you?"
              autoFocus
            />
            <label className={styles.label}>Your native language</label>
            <select className={styles.select} value={nativeLang} onChange={e => setNativeLang(e.target.value)}>
              {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <button className={styles.btn} onClick={handleRegister} disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
