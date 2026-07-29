import { useState, useEffect } from 'react'
import Login    from './components/Login.jsx'
import Review   from './components/Review.jsx'
import WordList from './components/WordList.jsx'
import AddWord  from './components/AddWord.jsx'
import Profile  from './components/Profile.jsx'
import styles   from './App.module.css'

export default function App() {
  const [token, setToken]   = useState(() => localStorage.getItem('vocab_token') || '')
  const [user,  setUser]    = useState(null)
  const [screen, setScreen] = useState('review')  // review | list | add | profile

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
    setToken(t)
    setUser(u)
  }

  function handleLogout() {
    localStorage.removeItem('vocab_token')
    setToken('')
    setUser(null)
  }

  if (!token || !user) return <Login onLogin={handleLogin} />

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <span className={styles.logo}>Vocab</span>
        <nav className={styles.nav}>
          <button className={screen === 'review'  ? styles.active : ''} onClick={() => setScreen('review')}>Review</button>
          <button className={screen === 'list'    ? styles.active : ''} onClick={() => setScreen('list')}>Words</button>
          <button className={screen === 'add'     ? styles.active : ''} onClick={() => setScreen('add')}>+ Add</button>
          <button className={screen === 'profile' ? styles.active : ''} onClick={() => setScreen('profile')}>Profile</button>
        </nav>
        <button className={styles.logout} onClick={handleLogout}>×</button>
      </header>

      <main className={styles.main}>
        {screen === 'review'  && <Review  token={token} user={user} />}
        {screen === 'list'    && <WordList token={token} onEdit={() => setScreen('list')} />}
        {screen === 'add'     && <AddWord  token={token} user={user} onAdded={() => setScreen('list')} />}
        {screen === 'profile' && <Profile  token={token} user={user} onUpdated={setUser} onLogout={handleLogout} />}
      </main>
    </div>
  )
}
