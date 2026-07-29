import { useState, useEffect } from 'react'
import styles from './WordList.module.css'

export default function WordList({ token }) {
  const [words,   setWords]   = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchWords() }, [token])

  async function fetchWords() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/${token}/words`)
      const data = await res.json()
      setWords(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  async function deleteWord(id) {
    setDeleting(id)
    try {
      await fetch(`/api/${token}/words/${id}`, { method: 'DELETE' })
      setWords(w => w.filter(x => x._id !== id))
    } catch {}
    setDeleting(null)
  }

  function dueLabel(nextReview) {
    const days = Math.round((new Date(nextReview) - new Date()) / 86400000)
    if (days <= 0) return { text: 'due now', cls: styles.dueNow }
    if (days === 1) return { text: 'tomorrow', cls: styles.dueSoon }
    return { text: `in ${days}d`, cls: styles.dueLater }
  }

  const filtered = words.filter(w =>
    w.word.toLowerCase().includes(search.toLowerCase()) ||
    w.meaning.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className={styles.center}>Loading…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <h2 className={styles.title}>{words.length} words</h2>
        <input
          className={styles.search}
          placeholder="search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 && (
        <p className={styles.empty}>{search ? 'No matches.' : 'No words yet — add some!'}</p>
      )}

      <div className={styles.list}>
        {filtered.map(w => {
          const due = dueLabel(w.nextReview)
          return (
            <div key={w._id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.lang}>{w.sourceLang}</span>
                <span className={styles.word}>{w.word}</span>
                <span className={styles.meaning}>{w.meaning}</span>
              </div>
              <div className={styles.itemMeta}>
                <span className={due.cls}>{due.text}</span>
                <span className={styles.interval}>every {w.interval}d</span>
                <button
                  className={styles.deleteBtn}
                  onClick={() => deleteWord(w._id)}
                  disabled={deleting === w._id}
                >✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
