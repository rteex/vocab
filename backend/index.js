require('dotenv').config()
const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')
const fetch    = require('node-fetch')
const { v4: uuidv4 } = require('uuid')

const app = express()
app.use(cors())
app.use(express.json())

const path = require('path')

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err))

// ------------------------------------------------------------------
// Schemas
// ------------------------------------------------------------------

const userSchema = new mongoose.Schema({
  token:          { type: String, required: true, unique: true },
  name:           { type: String, required: true },
  nativeLang:     { type: String, default: 'FI' },  // DeepL language code
  createdAt:      { type: Date, default: Date.now },
})
const User = mongoose.model('User', userSchema)

const wordSchema = new mongoose.Schema({
  token:       { type: String, required: true, index: true },
  word:        { type: String, required: true },
  meaning:     { type: String, required: true },
  example:     { type: String, default: '' },
  sourceLang:  { type: String, default: '' },
  interval:    { type: Number, default: 1 },      // days until next review
  nextReview:  { type: Date,   default: Date.now },
  createdAt:   { type: Date,   default: Date.now },
})
const Word = mongoose.model('Word', wordSchema)

// ------------------------------------------------------------------
// Middleware — validate token
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Routes — users
// ------------------------------------------------------------------

// POST /api/register — create new user, returns token
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

// GET /api/:token/me — validate token, get profile
app.get('/api/:token/me', requireToken, async (req, res) => {
  res.json({ token: req.token, name: req.user.name, nativeLang: req.user.nativeLang })
})

// PATCH /api/:token/me — update profile (name, nativeLang)
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

// ------------------------------------------------------------------
// Routes — words
// ------------------------------------------------------------------

// GET /api/:token/words — all words, optional ?lang= filter
app.get('/api/:token/words', requireToken, async (req, res) => {
  try {
    const filter = { token: req.token }
    if (req.query.lang) filter.sourceLang = req.query.lang
    const words = await Word.find(filter).sort({ createdAt: -1 })
    res.json(words)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/:token/review — words due for review today (limit 20)
app.get('/api/:token/review', requireToken, async (req, res) => {
  try {
    const words = await Word.find({
      token:      req.token,
      nextReview: { $lte: new Date() },
    }).limit(20)
    // Shuffle
    for (let i = words.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [words[i], words[j]] = [words[j], words[i]]
    }
    res.json(words)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/:token/words — add word
app.post('/api/:token/words', requireToken, async (req, res) => {
  const { word, meaning, example, sourceLang } = req.body
  if (!word || !meaning) return res.status(400).json({ error: 'word and meaning required' })
  try {
    const w = await Word.create({
      token: req.token,
      word:  word.trim(),
      meaning: meaning.trim(),
      example: (example || '').trim(),
      sourceLang: (sourceLang || '').toUpperCase(),
    })
    res.json(w)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/:token/words/:id/review — record rating, update interval
// body: { rating: "certain" | "uncertain" | "unknown" }
app.patch('/api/:token/words/:id/review', requireToken, async (req, res) => {
  const { rating } = req.body
  if (!rating) return res.status(400).json({ error: 'rating required' })
  try {
    const word = await Word.findOne({ _id: req.params.id, token: req.token })
    if (!word) return res.status(404).json({ error: 'not found' })

    let interval = word.interval
    if      (rating === 'certain')   interval = Math.min(Math.round(interval * 2.5), 180)
    else if (rating === 'uncertain') interval = Math.max(Math.round(interval * 0.8), 1)
    else                             interval = 1  // unknown — reset

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

// PATCH /api/:token/words/:id — edit word fields
app.patch('/api/:token/words/:id', requireToken, async (req, res) => {
  const { word, meaning, example, sourceLang } = req.body
  try {
    const update = {}
    if (word)       update.word       = word.trim()
    if (meaning)    update.meaning    = meaning.trim()
    if (example !== undefined) update.example = example.trim()
    if (sourceLang) update.sourceLang = sourceLang.toUpperCase()
    const w = await Word.findOneAndUpdate(
      { _id: req.params.id, token: req.token },
      update, { new: true }
    )
    if (!w) return res.status(404).json({ error: 'not found' })
    res.json(w)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/:token/words/:id
app.delete('/api/:token/words/:id', requireToken, async (req, res) => {
  try {
    await Word.findOneAndDelete({ _id: req.params.id, token: req.token })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ------------------------------------------------------------------
// Routes — translation proxy (DeepL)
// ------------------------------------------------------------------

// GET /api/translate?text=hello&source=EN&target=FI
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
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
      },
      body: body.toString(),
    })
    const data = await response.json()
    console.log('DeepL status:', response.status)
    console.log('DeepL response:', JSON.stringify(data))
    const translation = data?.translations?.[0]?.text || ''
    const detectedLang = data?.translations?.[0]?.detected_source_language || source || ''
    res.json({ translation, detectedLang })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve frontend in production — must be after all API routes
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist')
  app.use(express.static(distPath))
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Vocab backend running on port ${PORT}`))
