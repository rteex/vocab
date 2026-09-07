# Vocab — Project Status

A personal spaced-repetition vocabulary trainer, built as an installable PWA. No sign-up flow beyond a name — auth is a bare per-user token, no passwords.

## Stack

**Backend** — `vocab_back/index.js` (single file), Node/Express + Mongoose/MongoDB
- Dependencies: `express`, `mongoose`, `cors`, `dotenv`, `node-fetch`, `uuid`
- Dev: `nodemon`
- Env vars: `MONGODB_URI`, `DEEPL_API_KEY`, `PORT` (default 3001), `NODE_ENV`
- In production, serves the built frontend (`../frontend/dist`) as static files and falls back to `index.html` for client-side routing

**Frontend** — `vocab_front/`, React 18 + Vite + `vite-plugin-pwa`
- Dev proxy: `/api` → `http://localhost:3001`
- PWA manifest: name "Vocab", theme color `#6db88a`, background `#0f1612`, standalone display
- **Share target**: registered at `/share` (GET), accepts `text`/`title`/`url` — lets you add a word by sharing selected text from any app on your phone straight into Vocab
- Workbox runtime caching: `NetworkFirst` for `/api/*/me` and `/api/*/review`

## Data model

**User**
```
token (unique), name, nativeLang (default 'FI'), createdAt
```

**Word**
```
token, sourceLang, targetLang, lexeme, transl, theme,
grammar, langs (Map<string,string> — cognates by language code),
sample, sampleTransl, note,
interval (default 1), nextReview (default now), createdAt
```
`theme` is indexed. `langs` is the canonical field name in the DB; the API also accepts `cognates` as an alias on write (single add, bulk import, and patch) and maps it into `langs`.

## Backend API (all under `/api`, token-scoped except `/register`)

| Method | Route | Purpose |
|---|---|---|
| POST | `/register` | Create a user, returns a token |
| GET / PATCH | `/:token/me` | Read/update name & nativeLang |
| GET | `/:token/words` | List words; filter by `?lang=` and/or `?theme=` |
| GET | `/:token/themes` | Distinct theme list for the user (`Word.distinct`) |
| GET | `/:token/review` | Due-review queue: `nextReview <= now`, limit 20, shuffled; filter by `?theme=` |
| POST | `/:token/words` | Add a single word (accepts `theme`, `langs`/`cognates`) |
| POST | `/:token/words/import` | Bulk import a JSON array; returns `{imported, skipped, errors}` |
| PATCH | `/:token/words/:id/review` | Submit a review rating, recalculates interval/nextReview |
| PATCH | `/:token/words/:id` | Edit a word (whitelisted fields incl. `theme`, `langs`/`cognates`) |
| DELETE | `/:token/words/:id` | Delete a word |
| GET | `/translate` | Proxy to DeepL free API (`text`, `source`, `target` query params) |

## Spaced-repetition algorithm

On each review rating, `interval` (days) updates and `nextReview` is set to `now + interval`:
- **certain** → `interval = round(interval × 2.5)`, capped at 180
- **uncertain** → `interval = max(round(interval × 0.8), 1)`
- **unknown** → `interval = 1`

## Frontend components

- **Login.jsx** — registration/token entry
- **Profile.jsx** — name & native language settings
- **AddWord.jsx** — manual entry form; theme field + a cognates grid (per language code); can call the DeepL proxy for translation lookup
- **Import.jsx** — paste/upload a JSON array for bulk import; UI documents the expected shape including `theme` and `cognates`
- **WordList.jsx** — browses all words; theme filter shown as a chip row (derived from the word list)
- **Review.jsx** — the review/quiz flow (see below)

## Review flow (current design)

1. Word is shown immediately (`lexeme`, `sourceLang`, `theme`) along with a **Hint** button and three rating buttons: **Don't know / Not sure / Certain**. No more tap-to-flip.
2. **Hint** reveals the `sample` sentence only; rating buttons remain available.
3. **Certain** (from either state) submits the rating via `PATCH /:id/review` and advances to the next word immediately — no answer is shown.
4. **Don't know** or **Not sure** submits the rating, then reveals `transl`, `sample` + `sampleTransl` together, and the `langs`/cognates list. A single **Next word →** button then advances.
5. A **theme chip row** ("all" + each distinct theme) sits above the queue; picking one refetches `/review?theme=...`. Backed by the new `GET /:token/themes` endpoint (server-side `distinct`, not a client-side walk).
6. Progress indicator shows `index+1 / queue length`; an empty queue shows a "Check again" state, theme-aware in its message.

## Recent work log

1. **Theme + cognates backend support** — the frontend already expected these fields (schema-shaped by whoever built it); the backend was missing them. Added `theme` to schema, `GET /words` filtering, both write endpoints, and `PATCH`, with `cognates` accepted as an alias for `langs` throughout.
2. **Fixed a corrupted bulk-import JSON** — a 12-word Icelandic fishing-vocabulary ("Fiskveiðar") set had its `sourceLang`/`theme` keys scrambled (`"sourceLang","theme":"X",:"IS"` instead of `"sourceLang":"IS","theme":"X"`) — likely a bad find/replace during export. Repaired mechanically and validated.
3. **Redesigned Review.jsx** — replaced tap-to-flip with the immediate hint/rate flow described above.
4. **Added theme filtering to Review** — new `/themes` endpoint, `?theme=` support on `/review`, and a chip-row selector matching WordList's visual style.

## Known gaps / things not yet covered in this doc

- No notes on deployment target beyond the `NODE_ENV === 'production'` static-serving branch (KATVE, your other project, deploys to Heroku — unconfirmed whether Vocab does too)
- No test suite observed
- `note` field exists in the schema/UI but is no longer surfced in the redesigned Review flow (dropped intentionally per your spec — only `sampleTransl`, `transl`, and cognates show on reveal)
