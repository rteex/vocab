// Listen for request from popup to get selection context
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type !== 'getContext') return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) { respond({ example: '' }); return }

  // Walk up to find the containing sentence
  const range    = sel.getRangeAt(0)
  const text     = range.startContainer.textContent || ''
  const offset   = range.startOffset
  const sentenceRe = /[^.!?]*[.!?]*/g
  let example = ''

  let match
  while ((match = sentenceRe.exec(text)) !== null) {
    if (match.index <= offset && sentenceRe.lastIndex >= offset) {
      example = match[0].trim()
      break
    }
  }

  respond({ example })
  return true
})
