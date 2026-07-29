chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'vocab-save',
    title:    'Save to Vocab: "%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'vocab-save') return
  const selected = info.selectionText.trim()
  if (!selected) return

  // Get page language
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({
      lang:    document.documentElement.lang || '',
      excerpt: window.getSelection()?.toString() || '',
    }),
  }).then(results => {
    const pageInfo = results?.[0]?.result || {}
    // Store pending word and open popup
    chrome.storage.local.set({
      pendingWord: {
        word:       selected,
        sourceLang: (pageInfo.lang || '').split('-')[0].toUpperCase(),
        example:    '',  // extension popup will fetch context
      }
    })
    chrome.action.openPopup()
  }).catch(() => {
    chrome.storage.local.set({
      pendingWord: { word: selected, sourceLang: '', example: '' }
    })
    chrome.action.openPopup()
  })
})
