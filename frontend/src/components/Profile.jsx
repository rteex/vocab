import { useState } from 'react'
import styles from './Profile.module.css'

const LANGS = [
  { code: 'FI', label: 'Finnish' }, { code: 'EN', label: 'English' },
  { code: 'SV', label: 'Swedish' }, { code: 'DE', label: 'German' },
  { code: 'FR', label: 'French'  }, { code: 'ES', label: 'Spanish' },
  { code: 'IT', label: 'Italian' }, { code: 'PT', label: 'Portuguese' },
  { code: 'NL', label: 'Dutch'   }, { code: 'PL', label: 'Polish' },
  { code: 'RU', label: 'Russian' }, { code: 'JA', label: 'Japanese' },
  { code: 'ZH', label: 'Chinese' },
]

export default function Profile({ token, user, onUpdated, onLogout }) {
  const [name,       setName]       = useState(user.name)
  const [nativeLang, setNativeLang] = useState(user.nativeLang)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res  = await fetch(`/api/${token}/me`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, nativeLang }),
      })
      const data = await res.json()
      onUpdated(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Profile</h2>

      <div className={styles.tokenBox}>
        <label className={styles.label}>Your token — keep this safe</label>
        <div className={styles.token}>{token}</div>
        <p className={styles.tokenNote}>This is your login. Copy it somewhere safe — there's no password reset.</p>
      </div>

      <label className={styles.label}>Name</label>
      <input
        className={styles.input}
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <label className={styles.label}>Native language (translations target)</label>
      <select className={styles.select} value={nativeLang} onChange={e => setNativeLang(e.target.value)}>
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>

      <button className={styles.saveBtn} onClick={handleSave} disabled={saving || saved}>
        {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save changes'}
      </button>

      <button className={styles.logoutBtn} onClick={onLogout}>Sign out</button>
    </div>
  )
}
