import { useState, useEffect } from 'react'
import styles from './AddWord.module.css'

const LANGS = [
  { code: '',   label: 'Auto-detect' },
  { code: 'EN', label: 'English'  }, { code: 'FI', label: 'Finnish' },
  { code: 'SV', label: 'Swedish'  }, { code: 'DE', label: 'German'  },
  { code: 'FR', label: 'French'   }, { code: 'ES', label: 'Spanish' },
  { code: 'IT', label: 'Italian'  }, { code: 'PT', label: 'Portuguese' },
  { code: 'NL', label: 'Dutch'    }, { code: 'PL', label: 'Polish'  },
  { code: 'RU', label: 'Russian'  }, { code: 'JA', label: 'Japanese'},
  { code: 'ZH', label: 'Chinese'  }, { code: 'IS', label: 'Icelandic' },
  { code: 'DA', label: 'Danish'   }, { code: 'NO', label: 'Norwegian' },
]

// Quick-add suggestions for the ref-lexemes editor (not an exhaustive list — "+ other" covers anything else)
const QUICK_LANGS = ['sv','no','non','de','en','fr','es','it','pt','nl','pl','ru','da','is','got','ang']

export default function AddWord({ token, user, onAdded, initialWord = '', initialSample = '', initialLangId = '' }) {
  const [langId,    setLangId]    = useState(initialLangId)
  const [lexeme,       setLexeme]       = useState(initialWord)
  const [transl,       setTransl]       = useState('')
  const [theme,        setTheme]        = useState('')
  const [grammar,      setGrammar]      = useState('')
  const [forms,        setForms]        = useState('')
  const [refLexemes,   setRefLexemes]   = useState([])  // [{ langId, dictForm, isCognate }]
  const [sample,       setSample]       = useState(initialSample)
  const [sampleTransl, setSampleTransl] = useState('')
  const [monoling,     setMonoling]     = useState('')
  const [note,         setNote]         = useState('')
  const [translating,  setTranslating]  = useState(false)
  const [alternatives, setAlternatives] = useState([])
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')
  const [showExtra,    setShowExtra]    = useState(false)

  useEffect(() => {
    if (initialWord) {
      setLexeme(initialWord)
      setSample(initialSample)
      setLangId(initialLangId)
      fetchTranslation(initialWord, initialLangId)
    }
  }, [initialWord])

  async function fetchTranslation(w, srcOverride) {
    const target = (w || lexeme).trim()
    if (!target) return
    const src = srcOverride !== undefined ? srcOverride : langId
    setTranslating(true)
    setAlternatives([])
    try {
      const params = new URLSearchParams({ text: target, target: user.nativeLang })
      if (src) params.append('source', src)
      const res  = await fetch(`/api/translate?${params}`)
      const data = await res.json()
      let detected = src
      if (data.translation) {
        setTransl(data.translation)
        if (data.detectedLang && !src) { setLangId(data.detectedLang); detected = data.detectedLang }
      }
      fetchAlternatives(target, detected, data.translation)
    } catch {}
    setTranslating(false)
  }

  async function fetchAlternatives(text, src, primary) {
    try {
      const params = new URLSearchParams({ text, target: user.nativeLang })
      if (src) params.append('source', src)
      const res  = await fetch(`/api/${token}/alternatives?${params}`)
      const data = await res.json()
      const alts = (data.alternatives || []).filter(a => a.toLowerCase() !== (primary || '').toLowerCase())
      setAlternatives(alts.slice(0, 3))
    } catch {}
  }

  function addRefRow(langId = '') {
    setRefLexemes(prev => [...prev, { langId, dictForm: '', isCognate: true }])
  }
  function updateRefRow(i, patch) {
    setRefLexemes(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function removeRefRow(i) {
    setRefLexemes(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!lexeme.trim()) { setError('Lexeme is required'); return }
    setSaving(true); setError('')
    const cleanRefs = refLexemes
      .filter(r => r.dictForm && r.dictForm.trim())
      .map(r => ({ langId: (r.langId || '').trim(), dictForm: r.dictForm.trim(), isCognate: r.isCognate !== false }))
    try {
      const res = await fetch(`/api/${token}/words`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          lexeme, transl, theme, langId, targetLang: user.nativeLang, grammar, forms,
          refLexemes: cleanRefs, sample, sampleTransl, monoling, note,
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setSaving(false); return }
      setSaved(true)
      setTimeout(() => {
        setLexeme(''); setTransl(''); setTheme(''); setGrammar(''); setForms(''); setRefLexemes([]);
        setSample(''); setSampleTransl(''); setMonoling(''); setNote(''); setLangId('');
        setSaved(false); setAlternatives([])
        if (onAdded) onAdded()
      }, 1200)
    } catch { setError('Connection error') }
    setSaving(false)
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Add word</h2>

      <label className={styles.label}>Lexeme</label>
      <div className={styles.wordRow}>
        <select className={styles.langSelect} value={langId} onChange={e => setLangId(e.target.value)}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <input
          className={styles.input}
          value={lexeme}
          onChange={e => setLexeme(e.target.value)}
          onBlur={() => fetchTranslation(lexeme)}
          placeholder="word or expression…"
          autoFocus
        />
      </div>

      <label className={styles.label}>
        Translation ({user.nativeLang})
        <button className={styles.translateBtn} onClick={() => fetchTranslation(lexeme)} disabled={translating}>
          {translating ? 'translating…' : '↻ translate'}
        </button>
      </label>
      <input className={styles.input} value={transl} onChange={e => setTransl(e.target.value)} placeholder="translation…" />
      {alternatives.length > 0 && (
        <div className={styles.altRow}>
          <span className={styles.altLabel}>also:</span>
          {alternatives.map(a => (
            <button key={a} type="button" className={styles.altChip} onClick={() => setTransl(a)}>{a}</button>
          ))}
        </div>
      )}

      <label className={styles.label}>Theme</label>
      <input className={styles.input} value={theme} onChange={e => setTheme(e.target.value)} placeholder="e.g. Fiskveiðar, Náttúra…" />

      <label className={styles.label}>Grammar</label>
      <input className={styles.input} value={grammar} onChange={e => setGrammar(e.target.value)} placeholder="declension, conjugation, gender…" />

      <label className={styles.label}>Forms</label>
      <input className={styles.input} value={forms} onChange={e => setForms(e.target.value)} placeholder="inflected forms…" />

      <label className={styles.label}>Example sentence</label>
      <input className={styles.input} value={sample} onChange={e => setSample(e.target.value)} placeholder="example in study language…" />

      <label className={styles.label}>Example translation</label>
      <input className={styles.input} value={sampleTransl} onChange={e => setSampleTransl(e.target.value)} placeholder="translation of example…" />

      <label className={styles.label}>Monolingual definition</label>
      <textarea className={styles.textarea} value={monoling} onChange={e => setMonoling(e.target.value)} placeholder="definition in the study language…" rows={2} />

      <label className={styles.label}>Notes</label>
      <textarea className={styles.textarea} value={note} onChange={e => setNote(e.target.value)} placeholder="etymology, usage notes…" rows={3} />

      <button className={styles.extraToggle} onClick={() => setShowExtra(x => !x)}>
        {showExtra ? '▾ hide ref. lexemes' : '▸ add ref. lexemes'}
      </button>

      {showExtra && (
        <div className={styles.langsGrid}>
          {refLexemes.map((r, i) => (
            <div key={i} className={styles.langRow}>
              <input
                className={styles.langCode}
                value={r.langId}
                onChange={e => updateRefRow(i, { langId: e.target.value })}
                placeholder="lang"
              />
              <input
                className={styles.langInput}
                value={r.dictForm}
                onChange={e => updateRefRow(i, { dictForm: e.target.value })}
                placeholder="dictionary form…"
              />
              <label className={styles.cognateToggle}>
                <input
                  type="checkbox"
                  checked={r.isCognate !== false}
                  onChange={e => updateRefRow(i, { isCognate: e.target.checked })}
                />
                cognate
              </label>
              <button type="button" className={styles.removeRowBtn} onClick={() => removeRefRow(i)}>✕</button>
            </div>
          ))}
          <div className={styles.quickAddRow}>
            {QUICK_LANGS.filter(c => !refLexemes.some(r => r.langId === c)).map(code => (
              <button key={code} type="button" className={styles.quickAddChip} onClick={() => addRefRow(code)}>{code}</button>
            ))}
            <button type="button" className={styles.quickAddChip} onClick={() => addRefRow('')}>+ other</button>
          </div>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <button className={`${styles.saveBtn} ${saved ? styles.savedBtn : ''}`} onClick={handleSave} disabled={saving || saved}>
        {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save word'}
      </button>
    </div>
  )
}
