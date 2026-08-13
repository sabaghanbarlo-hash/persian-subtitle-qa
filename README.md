# Persian Subtitle QA — MVP

AI-assisted quality review for English → Persian anime subtitle translations.
Upload an English `.srt` and a Persian `.srt` for one episode, run an AI review,
and work through the flagged lines — apply, edit, or ignore each suggestion —
then download the corrected `.srt`.

This is the **MVP** described in the build spec: one AI provider, no database,
no auth, SRT only. Translation memory, multi-model review, a judge model, and
ASS support are intentionally deferred to later phases (their sidebar pages
show a "coming later" placeholder).

## Why this needs a real backend

The AI review has to run server-side so your API key never reaches the
browser. That means this **cannot be hosted on GitHub Pages** (which only
serves static files) — it needs somewhere that can run a Node.js server
route, like Vercel.

## 1. Install dependencies

```bash
npm install
```

## 2. Set your AI provider + API key

Copy `.env.example` to `.env.local` and fill in **one** provider:

```bash
cp .env.example .env.local
```

```
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

`AI_PROVIDER` can be `groq`, `openai`, `anthropic`, `gemini`, `deepseek`, or
`openrouter` — only fill in the API key for the one you pick. Groq is the
default because it has a generous free tier.

`.env.local` is git-ignored — it will never be committed.

## 3. Run it locally

```bash
npm run dev
```

Open http://localhost:3000. Go to **New Review**, upload an English `.srt`
and a Persian `.srt` for the same episode, click **Pair subtitles**, then
**Analyze episode**.

## 4. Deploy to Vercel (free tier)

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. In the project's **Settings → Environment Variables**, add the same
   variables from your `.env.local` (e.g. `AI_PROVIDER`, `GROQ_API_KEY`,
   `GROQ_MODEL`).
4. Deploy. Vercel builds and hosts the app, including the `/api/review`
   server route — your key stays on Vercel's servers and is never sent to
   the browser.

## What's implemented (MVP)

- Sidebar shell: Dashboard, New Review, Projects, Translation Memory,
  AI Models, Settings (the last three show "coming later" placeholders).
- Upload English + Persian `.srt`, parsed and paired by subtitle number.
- Clear warning banner (never silent guessing) when subtitle counts or
  numbers don't line up between the two files.
- One AI reviewer per subtitle line, run server-side via `/api/review`,
  using 2 lines of context before and after the current line.
- Structured JSON response validation, with graceful handling of invalid
  JSON, empty responses, and API errors — one failed line never stops the
  rest of the batch.
- Progressive results: subtitles get their review the moment it's ready,
  not only after the whole episode finishes. Concurrency-limited (2 at a
  time) to be gentle on rate limits, with retry + backoff on transient
  errors.
- Status badges (✓ Correct / ⚠ Minor / ⚠ Major / 🔴 Critical / Consistency /
  Unreviewed / Failed) with filtering.
- Word-level diff between the current Persian line and the AI's suggestion.
- Apply / Edit / Ignore controls per issue, plus **Revert to original** —
  the original Persian translation is never destroyed, only the "current"
  copy is replaced.
- **Download corrected SRT**, preserving subtitle numbers, timestamps, and
  order, using whatever the current (possibly corrected) Persian text is.
- Dashboard shows the last session's stats (stored in the browser) and
  whether the server has a working API key configured.

## What's deliberately not built yet

- Translation memory / glossary (global + per-project)
- Multiple AI providers running side by side + a judge model
- Projects, episode history, character memory, personal style memory
- `.ass` / `.vtt` support
- Authentication, multi-user accounts, billing
- Consistency checking across a whole episode

These are Phase 2+ per the original spec — the MVP's job is to get the
core review loop (upload → review → correct → export) fully working first.

## Project structure

```
app/
  layout.js, globals.css        — shell, sidebar, dark theme
  page.js                       — Dashboard
  review/page.js                — the core review workflow
  projects|translation-memory|ai-models|settings/page.js — stubs/status pages
  api/review/route.js           — server-side AI call (POST)
  api/provider-info/route.js    — read-only provider status (GET)
lib/
  subtitle.js                   — SRT parse/export/pairing
  aiProvider.js                 — provider abstraction (server-only)
  reviewPrompt.js                — prompt template + response validation
  diff.js                       — word-level diff for the suggestion view
components/
  Sidebar.js, SubtitleCard.js
```
