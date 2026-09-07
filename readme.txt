Summary for Claude

Project vocab — a spaced-repetition vocabulary trainer PWA.

Stack: Node/Express + MongoDB backend, React + Vite frontend, installable as a PWA with an OS share-target for adding words on the go, DeepL for translation lookups, token-based auth (no passwords).
Data model: word has lexeme, transl, theme, grammar, langs/cognates, sample, sampleTransl, note, plus spaced-repetition interval/nextReview.
Algorithm: certain → interval ×2.5, uncertain → ×0.8 (floor 1), unknown → reset to 1, capped at 180 days.
What we've done together: backend theme/cognates support end-to-end, fixed a corrupted Icelandic fishing-vocab JSON export, redesigned the Review page flow (hint → sample only; certain skips reveal; don't-know/not-sure reveals translation + cognates + a Next button), and added a theme filter chip row to the Review page backed by a new GET /:token/themes endpoint.

