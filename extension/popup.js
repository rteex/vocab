const BASE_URL = 'https://your-vocab-app.herokuapp.com'  // ← set your Heroku URL

const content = document.getElementById('content')
let token = ''
let user  = null

async function init() {
  const stored = await chrome.storage.local.get(['vocabToken'])
  token = stored.vocabToken || ''

  if (!token) { renderSetup(); return }

  try {
    const res  = await fetch(`${BASE_URL}/api/${token}/me`)
    const data = await res.json()
    if (data.error) { renderSetup(); return }
    user = data
  } catch { renderSetup(); return }

  // Read selected text and page language directly from active tab
  let pending = { word: '', sourceLang: '', example: '' }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel  = window.getSelection()
          const word = sel ? sel.toString().trim() : ''
          const lang = (document.documentElement.lang || '').split('-')[0].toUpperCase()
          // Grab surrounding sentence as example
          let example = ''
          if (sel && sel.rangeCount > 0) {
            const text   = sel.getRangeAt(0).startContainer.textContent || ''
            const offset = sel.getRangeAt(0).startOffset
            const re     = /[^.!?]+[.!?]*/g
            let m
            while ((m = re.exec(text)) !== null) {
              if (m.index <= offset && re.lastIndex >= offset) {
                example = m[0].trim(); break
              }
            }
          }
          return { word, sourceLang: lang, example }
        }
      })
      if (results?.[0]?.result) pending = results[0].result
    }
  } catch {}

  renderSave(pending)
}

function renderSetup() {
  content.innerHTML = `
    <p class="setup">
      Enter your Vocab token to get started.<br>
      Don't have one? <a href="${BASE_URL}" target="_blank">Open Vocab</a> to register.
    </p>
    <input class="tokenInput" id="tokenInput" placeholder="your token" />
    <button class="tokenSave" id="tokenSave">Save token</button>
    <p class="msg err" id="setupMsg"></p>
  `
  document.getElementById('tokenSave').onclick = async () => {
    const t = document.getElementById('tokenInput').value.trim()
    if (!t) return
    try {
      const res  = await fetch(`${BASE_URL}/api/${t}/me`)
      const data = await res.json()
      if (data.error) { document.getElementById('setupMsg').textContent = 'Token not found'; return }
      await chrome.storage.local.set({ vocabToken: t })
      token = t; user = data
      renderSave({ word: '', sourceLang: '', example: '' })
    } catch { document.getElementById('setupMsg').textContent = 'Connection error' }
  }
}

function renderSave(pending) {
  const LANGS = ['', 'EN', 'FI', 'SV', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'PL', 'RU', 'JA', 'ZH']
  const langOptions = LANGS.map(c =>
    `<option value="${c}" ${c === pending.sourceLang ? 'selected' : ''}>${c || 'Auto'}</option>`
  ).join('')

  content.innerHTML = `
    <label>Word</label>
    <div class="row">
      <select id="sourceLang">${langOptions}</select>
      <input id="word" value="${escHtml(pending.word)}" placeholder="word or expression" />
    </div>

    <label>Meaning (${user.nativeLang})</label>
    <input id="meaning" placeholder="translation / meaning" />
    <button class="translateBtn" id="translateBtn">↻ get translation</button>

    <label>Example</label>
    <textarea id="example" rows="2">${escHtml(pending.example)}</textarea>

    <button class="saveBtn" id="saveBtn">Save to Vocab</button>
    <p class="msg" id="msg"></p>
  `

  // Try to get sentence context from active tab
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) return
    chrome.tabs.sendMessage(tabs[0].id, { type: 'getContext' }, resp => {
      if (resp?.example && !pending.example) {
        document.getElementById('example').value = resp.example
      }
    })
  })

  // Auto-translate if word is pre-filled
  if (pending.word) setTimeout(doTranslate, 300)

  document.getElementById('translateBtn').onclick = doTranslate

  document.getElementById('saveBtn').onclick = async () => {
    const word       = document.getElementById('word').value.trim()
    const meaning    = document.getElementById('meaning').value.trim()
    const example    = document.getElementById('example').value.trim()
    const sourceLang = document.getElementById('sourceLang').value

    const msg = document.getElementById('msg')
    if (!word || !meaning) { msg.className = 'msg err'; msg.textContent = 'Word and meaning required'; return }

    document.getElementById('saveBtn').disabled = true
    try {
      const res  = await fetch(`${BASE_URL}/api/${token}/words`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ word, meaning, example, sourceLang }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      msg.className = 'msg ok'
      msg.textContent = '✓ Saved!'
      setTimeout(() => window.close(), 1200)
    } catch (e) {
      msg.className = 'msg err'
      msg.textContent = e.message || 'Error saving'
      document.getElementById('saveBtn').disabled = false
    }
  }
}

async function doTranslate() {
  const word       = document.getElementById('word').value.trim()
  const sourceLang = document.getElementById('sourceLang').value
  if (!word) return
  const btn = document.getElementById('translateBtn')
  btn.disabled = true; btn.textContent = 'translating…'
  try {
    const params = new URLSearchParams({ text: word, target: user.nativeLang })
    if (sourceLang) params.append('source', sourceLang)
    const res  = await fetch(`${BASE_URL}/api/translate?${params}`)
    const data = await res.json()
    if (data.translation) {
      document.getElementById('meaning').value = data.translation
      if (data.detectedLang && !sourceLang)
        document.getElementById('sourceLang').value = data.detectedLang
    }
  } catch {}
  btn.disabled = false; btn.textContent = '↻ get translation'
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

init()
