import { useState } from 'react'
import styles from './AddWord.module.css'

const LANGS = [
  { code: '',   label: 'Auto-detect' },
  { code: 'EN', label: 'English'  }, { code: 'FI', label: 'Finnish' },
  { code: 'SV', label: 'Swedish'  }, { code: 'DE', label: 'German'  },
  { code: 'FR', label: 'French'   }, { code: 'ES', label: 'Spanish' },
  { code: 'IT', label: 'Italian'  }, { code: 'PT', label: 'Portuguese' },
  { code: 'NL', label: 'Dutch'    }, { code: 'PL', label: 'Polish'  },
  { code: 'RU', label: 'Russian'  }, { code: 'JA', label: 'Japanese'},
  { code: 'ZH', label: 'Chinese'  },
]

export default function AddWord({ token, user, onAdded }) {
  const [word,       setWord]       = useState('')
  const [meaning,    setMeaning]    = useState('')
  const [example,    setExample]    = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [translating, setTranslating] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState('')

  async function fetchTranslation() {
    if (!word.trim()) return
    setTranslating(true)
    try {
      const params = new URLSearchParams({
        text:   word.trim(),
        target: user.nativeLang,
      })
      if (sourceLang) params.append('source', sourceLang)
      const res  = await fetch(`/api/translate?${params}`)
      const data = await res.json()
      if (data.translation) {
        setMeaning(data.translation)
        if (data.detectedLang && !sourceLang) setSourceLang(data.detectedLang)
      }
    } catch {}
    setTranslating(false)
  }

  async function handleSave() {
    if (!word.trim() || !meaning.trim()) { setError('Word and meaning are required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/${token}/words`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ word, meaning, example, sourceLang }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setSaving(false); return }
      setSaved(true)
      setTimeout(() => {
        setWord(''); setMeaning(''); setExample(''); setSourceLang(''); setSaved(false)
      }, 1200)
    } catch { setError('Connection error') }
    setSaving(false)
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Add word</h2>

      <label className={styles.label}>Word or expression</label>
      <div className={styles.wordRow}>
        <select className={styles.langSelect} value={sourceLang} onChange={e => setSourceLang(e.target.value)}>
          {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <input
          className={styles.input}
          value={word}
          onChange={e => setWord(e.target.value)}
          onBlur={fetchTranslation}
          onKeyDown={e => e.key === 'Tab' && fetchTranslation()}
          placeholder="type a word…"
          autoFocus
        />
      </div>

      <label className={styles.label}>
        Meaning ({user.nativeLang})
        <button className={styles.translateBtn} onClick={fetchTranslation} disabled={translating}>
          {translating ? 'translating…' : '↻ translate'}
        </button>
      </label>
      <input
        className={styles.input}
        value={meaning}
        onChange={e => setMeaning(e.target.value)}
        placeholder="meaning in your language…"
      />

      <label className={styles.label}>Example sentence (optional)</label>
      <textarea
        className={styles.textarea}
        value={example}
        onChange={e => setExample(e.target.value)}
        placeholder="a sentence showing how the word is used…"
        rows={3}
      />

      {error && <p className={styles.error}>{error}</p>}

      <button className={`${styles.saveBtn} ${saved ? styles.savedBtn : ''}`} onClick={handleSave} disabled={saving || saved}>
        {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save word'}
      </button>
    </div>
  )
}
