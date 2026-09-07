import { useState, useEffect } from 'react'
import styles from './WordList.module.css'

export default function WordList({ token }) {
  const [words,    setWords]    = useState([])
  const [search,   setSearch]   = useState('')
  const [theme,    setTheme]    = useState('')
  const [expanded, setExpanded] = useState(null)
  const [loading,  setLoading]  = useState(true)
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
    if (days <= 0) return { text: 'due now',  cls: styles.dueNow  }
    if (days === 1) return { text: 'tomorrow', cls: styles.dueSoon }
    return { text: `in ${days}d`, cls: styles.dueLater }
  }

  const themes = [...new Set(words.map(w => w.theme).filter(Boolean))].sort()

  const filtered = words.filter(w => {
    if (theme && w.theme !== theme) return false
    const q = search.toLowerCase()
    return (
      (w.lexeme  || '').toLowerCase().includes(q) ||
      (w.transl  || '').toLowerCase().includes(q) ||
      (w.grammar || '').toLowerCase().includes(q) ||
      (w.note    || '').toLowerCase().includes(q) ||
      (w.theme   || '').toLowerCase().includes(q)
    )
  })

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

      {themes.length > 0 && (
        <div className={styles.themeRow}>
          <button className={theme === '' ? styles.themeChipActive : styles.themeChip} onClick={() => setTheme('')}>all</button>
          {themes.map(t => (
            <button key={t} className={theme === t ? styles.themeChipActive : styles.themeChip} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <p className={styles.empty}>{search || theme ? 'No matches.' : 'No words yet — add some!'}</p>
      )}

      <div className={styles.list}>
        {filtered.map(w => {
          const due    = dueLabel(w.nextReview)
          const isOpen = expanded === w._id
          const refs   = Array.isArray(w.refLexemes) ? w.refLexemes.filter(r => r.dictForm) : []

          return (
            <div key={w._id} className={styles.item}>
              <div className={styles.itemHeader} onClick={() => setExpanded(isOpen ? null : w._id)}>
                <div className={styles.itemMain}>
                  <span className={styles.lang}>{w.langId}</span>
                  <span className={styles.lexeme}>{w.lexeme}</span>
                  <span className={styles.transl}>{w.transl}</span>
                  {w.theme && <span className={styles.themeTag}>{w.theme}</span>}
                </div>
                <div className={styles.itemMeta}>
                  <span className={due.cls}>{due.text}</span>
                  <span className={styles.interval}>every {w.interval}d</span>
                  <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteWord(w._id) }} disabled={deleting === w._id}>✕</button>
                </div>
              </div>

              {isOpen && (
                <div className={styles.detail}>
                  {w.grammar      && <div className={styles.detailRow}><span className={styles.detailLabel}>grammar</span>{w.grammar}</div>}
                  {w.forms        && <div className={styles.detailRow}><span className={styles.detailLabel}>forms</span>{w.forms}</div>}
                  {w.sample       && <div className={styles.detailRow}><span className={styles.detailLabel}>example</span><em>{w.sample}</em></div>}
                  {w.sampleTransl && <div className={styles.detailRow}><span className={styles.detailLabel}>transl</span><em>{w.sampleTransl}</em></div>}
                  {w.monoling     && <div className={styles.detailRow}><span className={styles.detailLabel}>def.</span>{w.monoling}</div>}
                  {w.note         && <div className={styles.detailRow}><span className={styles.detailLabel}>note</span>{w.note}</div>}
                  {refs.length > 0 && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>ref. lexemes</span>
                      <span className={styles.langTags}>
                        {refs.map((r, i) => (
                          <span key={i} className={styles.langTag} title={r.isCognate === false ? 'not a cognate' : 'cognate'}>
                            <b>{r.langId}</b> {r.dictForm}{r.isCognate === false && <span className={styles.notCognate}> ✕</span>}
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
