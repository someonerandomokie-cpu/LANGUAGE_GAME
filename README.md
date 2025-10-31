## LangVoyage — interactive language learning through story

A React + Vite single-page app with an optional Node/Express backend that generates short, punchy plots and 100-line interactive dialogues using an LLM provider. By default it can use OpenAI. Choices appear at important moments only (about every 5 lines) and are in the target language with no English options. Lessons teach a small vocab pack with TTS.

Key features
- Avatar creation, genres (up to 3), language selection
- Auto plot generation with a 3-second countdown; regenerate on demand
- Lessons with 5-7 vocab words, TTS buttons, and examples
- Quiz requires 80% first-try accuracy to continue; retake resets correctly
- Dialogue pages: 100 lines per episode; black text on white cards; headers/labels in white; “Click here to continue” helper
- Choices only at key moments (~every 5 lines), in target language only; background clicks are disabled while choices are present
- Vocab highlighting in target language only; click to show an English translation popup for 5s
- Continuity via plotState (tone + decisions) fed into the next episode
- Optional backend proxy to keep API keys server-side: /api/story and /api/dialogues

### Background images
- Backgrounds are generated server-side via Replicate using bytedance/seedream-4 and cached under `public/generated`.
- Endpoint: POST `/api/generate-image` with inputs like `{ plot, lang, size: '2K', aspect_ratio: '4:3' }`.
- Requires `REPLICATE_API_TOKEN` in `server/.env`. A fallback endpoint `/api/generate-image-openai` exists if you prefer OpenAI Images.

## Run locally

Prereqs
- Node 18+

1) Install dependencies (root and server)
- Root (frontend):
  - npm install
- Server:
  - cd server && npm install

2) Configure environment
- Create `server/.env` with your keys (never commit this):
  - OPENAI_API_KEY=sk-... (omit to use local Ollama instead)
  - REPLICATE_API_TOKEN=r8_...
  - ORIGIN=http://localhost:5173
  - (optional) PORT=8888
- Optionally, create a root `.env` for Vite:
  - VITE_BACKEND_URL=http://localhost:8888
  - Do not put secrets in the root `.env` unless you know what you’re doing. The app prefers the backend when VITE_BACKEND_URL is present.

3) Start the servers
- In one terminal: `npm run server` (from repo root)
- In another: `npm run dev` (from repo root)
- Or start both: `npm run dev:full`
- Backend listens on http://127.0.0.1:8888, Frontend on http://localhost:5173
  - The frontend will call the backend automatically in dev (same-host heuristic) or if `VITE_BACKEND_URL` is set.

## Backend API
- POST /api/story
  - Body: { lang, genresList, avatarData, buddy, hobbies, traits, episodeNum, previousPlot, plotState }
  - Returns: { summary }
- POST /api/dialogues
  - Body: { plot, avatarData, buddy, lang, vocabPack, plotState }
  - Returns: { content } (a block of text which the frontend parses into lines and CHOICES)

  - POST /api/generate-image
    - Body (Seedream 4): `{ plot, lang, genre, role, dialogText, size, aspect_ratio, max_images }`
    - Returns: `{ url, prompt, cached }` where `url` is under `/generated/*`
    - Requires `REPLICATE_API_TOKEN`

  - POST /api/generate-image-openai (fallback)
    - Body: `{ plot, lang, genres, size }`
    - Returns cached URL under `/data/images/*`
    - Requires `OPENAI_API_KEY` (or `IMAGE_OPENAI_KEY`)

## LLM providers
- OpenAI (default when `OPENAI_API_KEY` is set) — `gpt-4o-mini` for story/dialogues
- Ollama (default when no OpenAI key is set, or set `LLM_PROVIDER=ollama`) — local models like `llama3.1:8b`
- OpenRouter (set `LLM_PROVIDER=openrouter`) — hosted multi-model router, free-tier models available
- Env:
  - `LLM_PROVIDER=ollama|openai`
  - `LLM_PROVIDER=openrouter` for OpenRouter
  - `OLLAMA_URL` default `http://127.0.0.1:11434`
  - `OLLAMA_MODEL` default `llama3.1:8b`
  - `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` (default `meta-llama/llama-3.1-8b-instruct:free`)

## Security notes
- .env files are gitignored at root and under server/. Do not commit keys.
- The frontend prefers the backend proxy so your OpenAI key stays on the server.

## Project layout
- src/App.jsx — All app logic and UI in a single file
- server/index.js — Express backend to call LLMs securely (OpenAI or local Ollama)
- server/llm.js — provider abstraction
- package.json — scripts: dev, build, preview, server
- DEV_RUN.md — quickstart notes for contributors

## What’s implemented per requirements
- Strategic choices when replying to non-user, with at least 2–3 target-language options; choices that change the plot; simple choices; no English choices
- 100 dialogue pages per episode (padded if needed)
- PlotState continuity across episodes (tone + recent decisions)
- Plot page countdown from 3 seconds; first plot auto-generated
- Vocab highlighting for target language only with 5s translation popup
- TTS: only in lesson; disabled on dialogue pages
- “Back to Main Page” always visible on the dialogue screen; episode/page labels in white; dialogue text black

## Troubleshooting
- If plot/dialogue endpoints return 400, set `OPENAI_API_KEY` in `server/.env` and restart the backend.
- If `/api/generate-image` fails, set `REPLICATE_API_TOKEN` in `server/.env`.
- If push to GitHub is blocked due to secret scanning, rotate any exposed key and ensure the key isn’t present in history. Our `.gitignore` prevents committing `.env` files.
          />

        );

