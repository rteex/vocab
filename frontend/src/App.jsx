import { useState, useEffect } from 'react'
import Login    from './components/Login.jsx'
import Review   from './components/Review.jsx'
import WordList from './components/WordList.jsx'
import AddWord  from './components/AddWord.jsx'
import Import   from './components/Import.jsx'
import Reader   from './components/Reader.jsx'
import Profile  from './components/Profile.jsx'
import styles   from './App.module.css'

export default function App() {
  const [token,  setToken]  = useState(() => localStorage.getItem('vocab_token') || '')
  const [user,   setUser]   = useState(null)
  const [screen, setScreen] = useState('review')
  const [sharedWord, setSharedWord] = useState(null)
  const [readerHandoff, setReaderHandoff] = useState(null)
  const [readerUrl,     setReaderUrl]     = useState('')
  const [readerArticle, setReaderArticle] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const text   = params.get('text') || params.get('title') || ''
    const candidates = [text].filter(s => s.trim() && !s.trim().startsWith('http'))
    if (candidates[0]) {
      setSharedWord(candidates[0].trim())
      setScreen('add')
      window.history.replaceState({}, '', '/')
    }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch(`/api/${token}/me`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { localStorage.removeItem('vocab_token'); setToken('') }
        else setUser(data)
      })
      .catch(() => {})
  }, [token])

  function handleLogin(t, u) {
    localStorage.setItem('vocab_token', t)
    setToken(t); setUser(u)
  }

  function handleLogout() {
    localStorage.removeItem('vocab_token')
    setToken(''); setUser(null)
  }

  function handleWordSelected(payload) {
    setReaderHandoff(payload)
    setScreen('add')
  }

  if (!token || !user) return <Login onLogin={handleLogin} />

  const nav = [
    { id: 'review',  label: 'Review'  },
    { id: 'list',    label: 'Words'   },
    { id: 'add',     label: '+ Add'   },
    { id: 'read',    label: '⚏ Read'  },
    { id: 'import',  label: '↑ Import'},
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.logo}>Vocab</span>
        <nav className={styles.nav}>
          {nav.map(n => (
            <button key={n.id} className={screen === n.id ? styles.active : ''} onClick={() => setScreen(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <button className={styles.logout} onClick={handleLogout}>×</button>
      </header>

      <main className={styles.main}>
        {screen === 'review'  && <Review   token={token} user={user} />}
        {screen === 'list'    && <WordList token={token} />}
        {screen === 'add'     && (
          <AddWord
            token={token}
            user={user}
            initialWord={readerHandoff?.lexeme ?? sharedWord ?? ''}
            initialSample={readerHandoff?.sample ?? ''}
            initialLangId={readerHandoff?.langId ?? ''}
            onAdded={() => { setSharedWord(null); setReaderHandoff(null); setScreen('list') }}
          />
        )}
        {screen === 'read'    && (
          <Reader
            token={token}
            url={readerUrl}
            setUrl={setReaderUrl}
            article={readerArticle}
            setArticle={setReaderArticle}
            onWordSelected={handleWordSelected}
          />
        )}
        {screen === 'import'  && <Import   token={token} onImported={() => setScreen('list')} />}
        {screen === 'profile' && <Profile  token={token} user={user} onUpdated={setUser} onLogout={handleLogout} />}
      </main>
    </div>
  )
}
