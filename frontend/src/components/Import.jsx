import { useState } from 'react'
import styles from './Import.module.css'

export default function Import({ token, onImported }) {
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [preview,  setPreview]  = useState(null)
  const [fileText, setFileText] = useState('')

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null); setError(''); setPreview(null)
    const reader = new FileReader()
    reader.onload = evt => {
      const text = evt.target.result
      setFileText(text)
      try {
        const data = JSON.parse(text)
        let entries = data
        if (!Array.isArray(entries)) {
          if (data && Array.isArray(data.lexemes)) {
            entries = data.lexemes
          } else if (data && typeof data === 'object') {
            entries = Object.values(data).find(v => Array.isArray(v)) || null
          }
        }
        if (!Array.isArray(entries)) {
          setError('File must contain a JSON array, or an object containing one (e.g. { "lexemes": [...] })')
          return
        }
        setPreview(entries)
      } catch {
        setError('Invalid JSON — could not parse file')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!preview) return
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/${token}/words/import`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    fileText,
      })
      const data = await res.json()
      setResult(data)
      setPreview(null)
      if (data.imported > 0 && onImported) onImported()
    } catch { setError('Connection error') }
    setLoading(false)
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Import words</h2>
      <p className={styles.desc}>Upload a JSON file — either a bare array of word objects, or an object with a <code>lexemes</code> array (any other top-level fields, like <code>aiSource</code>/<code>aiDate</code>, are ignored).</p>

      <div className={styles.exampleWrap}>
        <div className={styles.exampleLabel}>Expected format:</div>
        <pre className={styles.example}>{`{
  "aiSource": "...",       // optional, ignored
  "aiDate": "...",         // optional, ignored
  "lexemes": [
    {
      "lexeme": "vatn",
      "transl": "vesi",
      "theme": "Náttúra",
      "langId": "IS",
      "grammar": "hvorugkyn, et. vatn, ef. vatns",
      "forms": "vatn, vatns, vatni / vötn, vatna, vötnum",
      "refLexemes": [
        { "langId": "sv", "dictForm": "vatten", "isCognate": true },
        { "langId": "de", "dictForm": "Wasser", "isCognate": true }
      ],
      "sample": "Vatnið í ánni er ískalt.",
      "sampleTransl": "Joen vesi on jääkylmää.",
      "monoling": "Vatn er efni sem er nauðsynlegt öllu lífi.",
      "note": "Perusmerkitys on vesi yleisessä mielessä."
    }
  ]
}`}</pre>
        <p className={styles.desc}>Only <code>lexeme</code> is required. All other fields are optional. A plain <code>[...]</code> array at the top level (no wrapper) also works.</p>
      </div>

      <label className={styles.fileLabel}>
        <input type="file" accept=".json" onChange={handleFile} className={styles.fileInput} />
        <span className={styles.fileBtn}>Choose JSON file</span>
      </label>

      {preview && (
        <div className={styles.preview}>
          <div className={styles.previewCount}>
            {preview.length} word{preview.length !== 1 ? 's' : ''} found in file
          </div>
          <div className={styles.previewList}>
            {preview.slice(0, 5).map((w, i) => (
              <div key={i} className={styles.previewItem}>
                <span className={styles.previewLang}>{w.langId || '?'}</span>
                <span className={styles.previewLexeme}>{w.lexeme}</span>
                {w.transl && <span className={styles.previewTransl}>{w.transl}</span>}
                {w.theme && <span className={styles.previewTheme}>{w.theme}</span>}
              </div>
            ))}
            {preview.length > 5 && <div className={styles.previewMore}>…and {preview.length - 5} more</div>}
          </div>
          <button className={styles.importBtn} onClick={handleImport} disabled={loading}>
            {loading ? 'Importing…' : `Import ${preview.length} words`}
          </button>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultOk}>✓ {result.imported} word{result.imported !== 1 ? 's' : ''} imported</div>
          {result.skipped > 0 && <div className={styles.resultSkipped}>{result.skipped} skipped</div>}
          {result.errors?.length > 0 && (
            <div className={styles.resultErrors}>
              {result.errors.map((e, i) => <div key={i} className={styles.resultError}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
