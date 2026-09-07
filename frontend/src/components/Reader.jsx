import { useState } from 'react'
import styles from './Reader.module.css'

// Splits text into alternating word-like and non-word-like tokens.
// Word tokens: unicode letters/marks plus internal apostrophes/hyphens (so "sjómaður's", "u-hljóðvarp" stay whole).
const TOKEN_RE = /[\p{L}\p{M}](?:[\p{L}\p{M}'-]*[\p{L}\p{M}])?|[^\p{L}\p{M}]+/gu

function tokenize(text) {
  return text.match(TOKEN_RE) || []
}

function isWordToken(tok) {
  return /[\p{L}\p{M}]/u.test(tok)
}

// Split a paragraph into sentences, keeping the terminator attached.
function splitSentences(text) {
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text]
  return parts.map(s => s.trim()).filter(Boolean)
}

// Split pasted plain text into paragraphs: prefer blank-line breaks (how most
// browsers/apps preserve paragraph structure on copy), fall back to single
// newlines if the source collapsed everything onto one blank-line-free block.
function textToParagraphs(text) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  let chunks = normalized.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
  if (chunks.length <= 1) {
    chunks = normalized.split('\n').map(s => s.trim()).filter(Boolean)
  }
  return chunks
}

export default function Reader({ token, url, setUrl, article, setArticle, onWordSelected }) {
  const [mode,      setMode]      = useState('url')  // 'url' | 'paste'
  const [inputUrl,  setInputUrl]  = useState(url || '')
  const [pasteText, setPasteText] = useState('')
  const [pasteTitle,setPasteTitle]= useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function handleExtract(e) {
    e.preventDefault()
    const target = inputUrl.trim()
    if (!target) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ url: target })
      const res  = await fetch(`/api/${token}/extract?${params}`)
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setArticle(data)
      setUrl(target)
    } catch {
      setError('Connection error')
    }
    setLoading(false)
  }

  function handleUseText(e) {
    e.preventDefault()
    const text = pasteText.trim()
    if (!text) return
    const paragraphs = textToParagraphs(text)
    if (paragraphs.length === 0) { setError('No text to read'); return }
    setError('')
    setUrl('')
    setArticle({ title: pasteTitle.trim(), siteName: '', lang: '', paragraphs })
  }

  function handleWordClick(paragraph, sentences, sentenceIdx, word) {
    let sample = sentences[sentenceIdx] || paragraph
    // If the sentence is short, tack on the next one for more context.
    if (sample.length < 40 && sentences[sentenceIdx + 1]) {
      sample = `${sample} ${sentences[sentenceIdx + 1]}`
    }
    onWordSelected({
      lexeme:     word,
      sample:     sample.trim(),
      langId:  (article?.lang || '').split('-')[0].toUpperCase(),
    })
  }

  function renderParagraph(paragraph, pIdx) {
    const sentences = splitSentences(paragraph)
    // Map each character offset in the paragraph to a sentence index, so we know
    // which sentence a clicked word belongs to.
    let cursor = 0
    const sentenceRanges = sentences.map(s => {
      const start = paragraph.indexOf(s, cursor)
      cursor = start + s.length
      return { start, end: cursor, text: s }
    })
    function sentenceIndexAt(offset) {
      const idx = sentenceRanges.findIndex(r => offset >= r.start && offset < r.end)
      return idx === -1 ? 0 : idx
    }

    const tokens = tokenize(paragraph)
    let offset = 0
    return (
      <p key={pIdx} className={styles.paragraph}>
        {tokens.map((tok, i) => {
          const tokOffset = offset
          offset += tok.length
          if (!isWordToken(tok)) return <span key={i}>{tok}</span>
          const sIdx = sentenceIndexAt(tokOffset)
          return (
            <span
              key={i}
              className={styles.word}
              onClick={() => handleWordClick(paragraph, sentences, sIdx, tok)}
            >
              {tok}
            </span>
          )
        })}
      </p>
    )
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Read</h2>

      <div className={styles.modeTabs}>
        <button
          type="button"
          className={mode === 'url' ? styles.modeTabActive : styles.modeTab}
          onClick={() => setMode('url')}
        >
          From URL
        </button>
        <button
          type="button"
          className={mode === 'paste' ? styles.modeTabActive : styles.modeTab}
          onClick={() => setMode('paste')}
        >
          Paste text
        </button>
      </div>

      {mode === 'url' && (
        <form className={styles.urlRow} onSubmit={handleExtract}>
          <input
            className={styles.urlInput}
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="paste a URL to read…"
          />
          <button className={styles.goBtn} type="submit" disabled={loading}>
            {loading ? '…' : 'Go'}
          </button>
        </form>
      )}

      {mode === 'paste' && (
        <form className={styles.pasteForm} onSubmit={handleUseText}>
          <p className={styles.pasteHint}>
            For paywalled or blocked pages: open the page in your browser (already logged in),
            select the article text, copy, and paste it below.
          </p>
          <input
            className={styles.urlInput}
            value={pasteTitle}
            onChange={e => setPasteTitle(e.target.value)}
            placeholder="title (optional)…"
          />
          <textarea
            className={styles.pasteTextarea}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder="paste article text here…"
            rows={10}
          />
          <button className={styles.goBtn} type="submit" disabled={!pasteText.trim()}>
            Use this text
          </button>
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {article && (
        <div className={styles.article}>
          {article.title && <h3 className={styles.articleTitle}>{article.title}</h3>}
          {article.siteName && <div className={styles.siteName}>{article.siteName}</div>}
          <p className={styles.hint}>Tap a word to add it to your trainer.</p>
          {article.paragraphs.map((p, i) => renderParagraph(p, i))}
        </div>
      )}
    </div>
  )
}
