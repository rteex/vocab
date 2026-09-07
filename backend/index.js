require('dotenv').config()
const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
const fetch    = require('node-fetch')
const { v4: uuidv4 } = require('uuid')
const path     = require('path')
const { JSDOM } = require('jsdom')
const { Readability } = require('@mozilla/readability')

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err))

const userSchema = new mongoose.Schema({
  token:      { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  nativeLang: { type: String, default: 'FI' },
  createdAt:  { type: Date,   default: Date.now },
})
const User = mongoose.model('User', userSchema)

const wordSchema = new mongoose.Schema({
  token:        { type: String, required: true, index: true },
  langId:    { type: String, default: '' },
  targetLang:   { type: String, default: '' },
  lexeme:       { type: String, required: true },
  transl:       { type: String, default: '' },
  theme:        { type: String, default: '', index: true },
  grammar:      { type: String, default: '' },
  forms:        { type: String, default: '' },
  refLexemes:   [{ _id: false, langId: String, dictForm: String, isCognate: Boolean }],
  sample:       { type: String, default: '' },
  sampleTransl: { type: String, default: '' },
  monoling:     { type: String, default: '' },
  note:         { type: String, default: '' },
  interval:     { type: Number, default: 1 },
  nextReview:   { type: Date,   default: Date.now },
  createdAt:    { type: Date,   default: Date.now },
})
const Word = mongoose.model('Word', wordSchema)

async function requireToken(req, res, next) {
  const token = req.params.token || req.headers['x-vocab-token']
  try {
    const user = await User.findOne({ token })
    if (!user) return res.status(404).json({ error: 'invalid token' })
    req.token = token
    req.user  = user
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

app.post('/api/register', async (req, res) => {
  const { name, nativeLang } = req.body
  if (!name) return res.status(400).json({ error: 'name required' })
  try {
    const token = uuidv4().replace(/-/g, '').substring(0, 16)
    const user  = await User.create({ token, name, nativeLang: nativeLang || 'FI' })
    res.json({ token: user.token, name: user.name, nativeLang: user.nativeLang })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/me', requireToken, async (req, res) => {
  res.json({ token: req.token, name: req.user.name, nativeLang: req.user.nativeLang })
})

app.patch('/api/:token/me', requireToken, async (req, res) => {
  const { name, nativeLang } = req.body
  try {
    const update = {}
    if (name)       update.name       = name
    if (nativeLang) update.nativeLang = nativeLang
    const user = await User.findOneAndUpdate({ token: req.token }, update, { new: true })
    res.json({ token: user.token, name: user.name, nativeLang: user.nativeLang })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/words', requireToken, async (req, res) => {
  try {
    const filter = { token: req.token }
    if (req.query.langId) filter.langId = req.query.langId
    if (req.query.theme)     filter.theme     = req.query.theme
    const words = await Word.find(filter).sort({ createdAt: -1 })
    res.json(words)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/themes', requireToken, async (req, res) => {
  try {
    const themes = await Word.distinct('theme', { token: req.token, theme: { $ne: '' } })
    res.json(themes.sort())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/review', requireToken, async (req, res) => {
  try {
    const filter = { token: req.token, nextReview: { $lte: new Date() } }
    if (req.query.theme) filter.theme = req.query.theme
    const words = await Word.find(filter).limit(20)
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]]
    }
    res.json(words)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/:token/words', requireToken, async (req, res) => {
  const { lexeme, transl, theme, langId, targetLang, grammar, forms, refLexemes, sample, sampleTransl, monoling, note } = req.body
  if (!lexeme) return res.status(400).json({ error: 'lexeme required' })
  try {
    const w = await Word.create({
      token:        req.token,
      lexeme:       lexeme.trim(),
      transl:       (transl       || '').trim(),
      theme:        (theme        || '').trim(),
      langId:    (langId    || '').toUpperCase(),
      targetLang:   (targetLang   || req.user.nativeLang).toUpperCase(),
      grammar:      (grammar      || '').trim(),
      forms:        (forms        || '').trim(),
      refLexemes:   refLexemes || [],
      sample:       (sample       || '').trim(),
      sampleTransl: (sampleTransl || '').trim(),
      monoling:     (monoling     || '').trim(),
      note:         (note         || '').trim(),
    })
    res.json(w)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Bulk import — must come before /:id routes
app.post('/api/:token/words/import', requireToken, async (req, res) => {
  let entries = req.body
  if (!Array.isArray(entries)) {
    if (entries && Array.isArray(entries.lexemes)) {
      entries = entries.lexemes
    } else if (entries && typeof entries === 'object') {
      // Fall back to the first array-valued property, so exports shaped
      // slightly differently (not using the "lexemes" key) still work.
      entries = Object.values(entries).find(v => Array.isArray(v)) || null
    }
  }
  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: 'expected a JSON array, or an object containing one (e.g. { "lexemes": [...] })' })
  }
  let imported = 0, skipped = 0
  const errors = []
  for (const e of entries) {
    if (!e.lexeme) { skipped++; errors.push(`missing lexeme: ${JSON.stringify(e).substring(0, 60)}`); continue }
    try {
      await Word.create({
        token:        req.token,
        lexeme:       e.lexeme.trim(),
        transl:       (e.transl       || '').trim(),
        theme:        (e.theme        || '').trim(),
        langId:    (e.langId    || '').toUpperCase(),
        targetLang:   (e.targetLang   || req.user.nativeLang).toUpperCase(),
        grammar:      (e.grammar      || '').trim(),
        forms:        (e.forms        || '').trim(),
        refLexemes:   e.refLexemes || [],
        sample:       (e.sample       || '').trim(),
        sampleTransl: (e.sampleTransl || '').trim(),
        monoling:     (e.monoling     || '').trim(),
        note:         (e.note         || '').trim(),
      })
      imported++
    } catch (err) {
      skipped++
      errors.push(`"${e.lexeme}": ${err.message}`)
    }
  }
  res.json({ imported, skipped, errors })
})

app.patch('/api/:token/words/:id/review', requireToken, async (req, res) => {
  const { rating } = req.body
  if (!rating) return res.status(400).json({ error: 'rating required' })
  try {
    const word = await Word.findOne({ _id: req.params.id, token: req.token })
    if (!word) return res.status(404).json({ error: 'not found' })
    let interval = word.interval
    if      (rating === 'certain')   interval = Math.min(Math.round(interval * 2.5), 180)
    else if (rating === 'uncertain') interval = Math.max(Math.round(interval * 0.8), 1)
    else                             interval = 1
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + interval)
    word.interval   = interval
    word.nextReview = nextReview
    await word.save()
    res.json(word)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.patch('/api/:token/words/:id', requireToken, async (req, res) => {
  const allowed = ['lexeme','transl','theme','langId','targetLang','grammar','forms','refLexemes','sample','sampleTransl','monoling','note']
  try {
    const update = {}
    for (const k of allowed) { if (req.body[k] !== undefined) update[k] = req.body[k] }
    const w = await Word.findOneAndUpdate({ _id: req.params.id, token: req.token }, update, { new: true })
    if (!w) return res.status(404).json({ error: 'not found' })
    res.json(w)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/:token/words/:id', requireToken, async (req, res) => {
  try {
    await Word.findOneAndDelete({ _id: req.params.id, token: req.token })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/extract', requireToken, async (req, res) => {
  const { url } = req.query
  if (!url) return res.status(400).json({ error: 'url required' })
  let parsed
  try { parsed = new URL(url) } catch { return res.status(400).json({ error: 'invalid url' }) }
  if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'only http(s) urls are supported' })

  try {
    const response = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VocabReader/1.0)' },
      redirect: 'follow',
    })
    if (!response.ok) return res.status(502).json({ error: `fetch failed: ${response.status}` })
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('html')) return res.status(415).json({ error: 'url did not return HTML' })

    const html = await response.text()
    const dom    = new JSDOM(html, { url: parsed.toString() })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    if (!article || !article.content) return res.status(422).json({ error: 'could not extract readable content from this page' })

    // Re-parse the cleaned article HTML to pull out paragraph-level plain text
    const articleDom = new JSDOM(`<div id="root">${article.content}</div>`)
    const blocks = articleDom.window.document.querySelectorAll(
      '#root p, #root li, #root h1, #root h2, #root h3, #root h4, #root blockquote'
    )
    const paragraphs = Array.from(blocks)
      .map(el => el.textContent.replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 0)

    if (paragraphs.length === 0) return res.status(422).json({ error: 'no readable text found on this page' })

    res.json({
      title:    article.title    || '',
      siteName: article.siteName || '',
      lang:     dom.window.document.documentElement.lang || '',
      paragraphs,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/:token/alternatives', requireToken, async (req, res) => {
  const { text, source, target } = req.query
  if (!text || !target) return res.status(400).json({ error: 'text and target required' })
  try {
    const langpair = `${(source || 'autodetect').toLowerCase()}|${target.toLowerCase()}`
    const params = new URLSearchParams({ q: text, langpair })
    const response = await fetch(`https://api.mymemory.translated.net/get?${params}`)
    const data = await response.json()
    const seen = new Set()
    const alternatives = []
    for (const m of (data?.matches || [])) {
      const t = (m.translation || '').trim()
      const key = t.toLowerCase()
      if (!t || seen.has(key)) continue
      seen.add(key)
      alternatives.push(t)
      if (alternatives.length >= 3) break
    }
    res.json({ alternatives })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/translate', async (req, res) => {
  const apiKey = process.env.DEEPL_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'DEEPL_API_KEY not set' })
  const { text, source, target } = req.query
  if (!text || !target) return res.status(400).json({ error: 'text and target required' })
  try {
    const body = new URLSearchParams({ text, target_lang: target.toUpperCase() })
    if (source) body.append('source_lang', source.toUpperCase())
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `DeepL-Auth-Key ${apiKey}` },
      body:    body.toString(),
    })
    const data = await response.json()
    res.json({
      translation:  data?.translations?.[0]?.text || '',
      detectedLang: data?.translations?.[0]?.detected_source_language || source || '',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Vocab backend running on port ${PORT}`))
