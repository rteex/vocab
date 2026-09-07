import { useState, useEffect } from 'react'
import styles from './Review.module.css'

export default function Review({ token }) {
  const [queue,    setQueue]    = useState([])
  const [index,    setIndex]    = useState(0)
  const [hint,     setHint]     = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [done,     setDone]     = useState(false)
  const [themes,   setThemes]   = useState([])
  const [theme,    setTheme]    = useState('')

  useEffect(() => { fetchThemes() }, [token])
  useEffect(() => { fetchReview() }, [token, theme])

  async function fetchThemes() {
    try {
      const res  = await fetch(`/api/${token}/themes`)
      const data = await res.json()
      setThemes(Array.isArray(data) ? data : [])
    } catch {}
  }

  async function fetchReview() {
    setLoading(true)
    try {
      const params = theme ? `?theme=${encodeURIComponent(theme)}` : ''
      const res  = await fetch(`/api/${token}/review${params}`)
      const data = await res.json()
      setQueue(Array.isArray(data) ? data : [])
      setIndex(0); setHint(false); setRevealed(false)
      setDone(data.length === 0)
    } catch {}
    setLoading(false)
  }

  function advance() {
    const next = index + 1
    if (next >= queue.length) setDone(true)
    else { setIndex(next); setHint(false); setRevealed(false) }
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
    if (rating === 'certain') advance()
    else setRevealed(true)
  }

  function selectTheme(t) {
    setTheme(t)
  }

  function themeSelector() {
    if (themes.length === 0) return null
    return (
      <div className={styles.themeRow}>
        <button className={theme === '' ? styles.themeChipActive : styles.themeChip} onClick={() => selectTheme('')}>all</button>
        {themes.map(t => (
          <button key={t} className={theme === t ? styles.themeChipActive : styles.themeChip} onClick={() => selectTheme(t)}>{t}</button>
        ))}
      </div>
    )
  }

  if (loading) return (
    <div className={styles.wrap}>
      {themeSelector()}
      <div className={styles.center}>Loading…</div>
    </div>
  )

  if (done) return (
    <div className={styles.wrap}>
      {themeSelector()}
      <div className={styles.center}>
        <div className={styles.doneIcon}>✓</div>
        <h2 className={styles.doneTitle}>All done!</h2>
        <p className={styles.doneSub}>No more words due for review{theme ? ` in "${theme}"` : ''}.</p>
        <button className={styles.refreshBtn} onClick={fetchReview}>Check again</button>
      </div>
    </div>
  )

  const w = queue[index]
  const refs = Array.isArray(w.refLexemes) ? w.refLexemes.filter(r => r.dictForm) : []

  return (
    <div className={styles.wrap}>
      {themeSelector()}
      <div className={styles.progress}>{index + 1} / {queue.length}</div>

      <div className={styles.card}>
        <div className={styles.lang}>{w.langId || '?'}{w.theme && <span className={styles.theme}> · {w.theme}</span>}</div>
        <div className={styles.word}>{w.lexeme}</div>

        {!revealed && hint && w.sample && (
          <div className={styles.hintBlock}>
            <div className={styles.example}>"{w.sample}"</div>
          </div>
        )}

        {revealed && (
          <>
            <div className={styles.meaning}>{w.transl}</div>
            {w.sampleTransl && (
              <div className={styles.hintBlock}>
                {w.sample       && <div className={styles.example}>"{w.sample}"</div>}
                <div className={styles.exampleTransl}>"{w.sampleTransl}"</div>
              </div>
            )}
            {refs.length > 0 && (
              <div className={styles.langs}>
                {refs.map((r, i) => (
                  <span key={i} className={styles.langTag}>
                    <span className={styles.langCode}>{r.langId}</span> {r.dictForm}
                    {r.isCognate === false && <span className={styles.notCognate}> ✕</span>}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {!revealed && (
        <>
          <div className={styles.hintRow}>
            {w.sample && !hint && (
              <button className={styles.hintBtn} onClick={() => setHint(true)}>hint</button>
            )}
          </div>

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
        </>
      )}

      {revealed && (
        <button className={styles.nextBtn} onClick={advance}>Next word →</button>
      )}
    </div>
  )
}
