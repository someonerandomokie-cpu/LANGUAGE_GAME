## LangVoyage — interactive language learning through story

A React + Vite single-page app with an optional Node/Express backend that generates short, punchy plots and 100-line interactive dialogues using OpenAI. Choices appear at important moments only (about every 5 lines) and are in the target language with no English options. Lessons teach a small vocab pack with TTS; dialogue screens have TTS disabled.

Key features
- Avatar creation, genres (up to 3), language selection
- Auto plot generation with a 3-second countdown; regenerate on demand
- Lessons with 5 vocab words, TTS buttons, and examples
- Quiz requires 80% first-try accuracy to continue; retake resets correctly
- Dialogue pages: at least 100 lines per episode; black text on white cards; headers/labels in white; “Click anywhere to continue” helper
- Choices only at key moments (~every 5 lines), in target language only; background clicks are disabled while choices are present
- Vocab highlighting in target language only; click to show an English translation popup for 5s
- Continuity via plotState (tone + decisions) fed into the next episode
- Optional backend proxy to keep API keys server-side: /api/story and /api/dialogues

### Background images (no external AI)
- The plot and dialogue screens now use locally generated SVG backdrops instead of any AI image generator or external photo service.
- Images are created procedurally based on the selected city and story context (time of day, mood, weather), so they render instantly and work offline.

## Run locally

Prereqs
- Node 18+

1) Install dependencies (root and server)
- Root (frontend):
  - npm install
- Server:
  - cd server && npm install

2) Configure environment
- Create server/.env with your key (never commit this):
  - OPENAI_API_KEY=sk-...
  - PORT=8787
  - ORIGIN=http://localhost:5173
- Optionally, create a root .env for Vite:
  - VITE_BACKEND_URL=http://localhost:8787
  - Do not put secrets in the root .env unless you know what you’re doing. The app prefers the backend when VITE_BACKEND_URL is present.

3) Start the servers
- In one terminal: npm run server (from repo root)
- In another: npm run dev (from repo root)
- Frontend will be at http://localhost:5173 and will call the backend if VITE_BACKEND_URL is set.

## Backend API
- POST /api/story
  - Body: { lang, genresList, avatarData, buddy, hobbies, traits, episodeNum, previousPlot, plotState }
  - Returns: { summary }
- POST /api/dialogues
  - Body: { plot, avatarData, buddy, lang, vocabPack, plotState }
  - Returns: { content } (a block of text which the frontend parses into lines and CHOICES)

## Security notes
- .env files are gitignored at root and under server/. Do not commit keys.
- The frontend prefers the backend proxy so your OpenAI key stays on the server.

## Project layout
- src/App.jsx — All app logic and UI in a single file
- server/index.js — Express backend to call OpenAI securely
- package.json — scripts: dev, build, preview, server
- DEV_RUN.md — quickstart notes for contributors

## What’s implemented per requirements
- Strategic choices only when replying to non-user, with at least 2–3 target-language options; no English choices
- ≥100 dialogue pages per episode (padded if needed)
- PlotState continuity across episodes (tone + recent decisions)
- Plot page countdown from 3 seconds; first plot auto-generated
- Vocab highlighting for target language only with 5s translation popup
- TTS: only in lesson; disabled on dialogue pages
- “Back to Main Page” always visible on the dialogue screen; episode/page labels in white; dialogue text black

## Troubleshooting
- If the plot/dialogue generation seems slow, ensure the backend is running and VITE_BACKEND_URL is set.
- If push to GitHub is blocked due to secret scanning, rotate any exposed key and ensure the key isn’t present in history. Our .gitignore prevents committing .env files.
          />

        );

