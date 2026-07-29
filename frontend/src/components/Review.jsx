import { useState, useEffect } from 'react'
import styles from './Review.module.css'

export default function Review({ token }) {
  const [queue,   setQueue]   = useState([])
  const [index,   setIndex]   = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hint,    setHint]    = useState(false)
  const [loading, setLoading] = useState(true)
  const [done,    setDone]    = useState(false)

  useEffect(() => { fetchReview() }, [token])

  async function fetchReview() {
    setLoading(true)
    try {
      const res  = await fetch(`/api/${token}/review`)
      const data = await res.json()
      setQueue(Array.isArray(data) ? data : [])
      setIndex(0)
      setFlipped(false)
      setHint(false)
      setDone(data.length === 0)
    } catch {}
    setLoading(false)
  }

  async function rate(rating) {
    const word = queue[index]
    try {
      await fetch(`/api/${token}/words/${word._id}/review`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating }),
      })
    } catch {}
    const next = index + 1
    if (next >= queue.length) { setDone(true) }
    else { setIndex(next); setFlipped(false); setHint(false) }
  }

  if (loading) return <div className={styles.center}>Loading…</div>

  if (done) return (
    <div className={styles.center}>
      <div className={styles.doneIcon}>✓</div>
      <h2 className={styles.doneTitle}>All done!</h2>
      <p className={styles.doneSub}>No more words due for review.</p>
      <button className={styles.refreshBtn} onClick={fetchReview}>Check again</button>
    </div>
  )

  const word = queue[index]
  const progress = `${index + 1} / ${queue.length}`

  return (
    <div className={styles.wrap}>
      <div className={styles.progress}>{progress}</div>

      <div className={styles.card} onClick={() => setFlipped(f => !f)}>
        <div className={styles.lang}>{word.sourceLang || '?'}</div>
        <div className={styles.word}>{word.word}</div>

        {flipped && (
          <div className={styles.meaning}>{word.meaning}</div>
        )}

        {hint && word.example && (
          <div className={styles.example}>"{word.example}"</div>
        )}

        {!flipped && (
          <div className={styles.tapHint}>tap to reveal</div>
        )}
      </div>

      {!flipped ? (
        <div className={styles.hintRow}>
          {word.example && (
            <button className={styles.hintBtn} onClick={e => { e.stopPropagation(); setHint(h => !h) }}>
              {hint ? 'hide hint' : 'hint'}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.ratingRow}>
          <button className={`${styles.rateBtn} ${styles.unknown}`}   onClick={() => rate('unknown')}>
            <span>✗</span> Don't know
          </button>
          <button className={`${styles.rateBtn} ${styles.uncertain}`} onClick={() => rate('uncertain')}>
            <span>~</span> Not sure
          </button>
          <button className={`${styles.rateBtn} ${styles.certain}`}   onClick={() => rate('certain')}>
            <span>✓</span> Certain
          </button>
        </div>
      )}
    </div>
  )
}
