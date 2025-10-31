# Run the Language Game locally

Vite + React frontend in `src/App.jsx` and an optional Node/Express backend in `server/index.js`.

## Quick start

1) Install deps
- Frontend (root):
	- npm install
- Backend:
	- cd server && npm install

2) Environment
- Create `server/.env` (do NOT commit):
	- OPENAI_API_KEY=sk-...
	- REPLICATE_API_TOKEN=r8_...
	- ORIGIN=http://localhost:5173
	- (optional) PORT=8888
- Optionally create root `.env`:
	- VITE_BACKEND_URL=http://localhost:8888

Alternative to OpenAI for plot/dialogues:
- You can run locally without any cloud keys by using Ollama as the LLM provider.
- Set `LLM_PROVIDER=ollama` (or leave `OPENAI_API_KEY` empty) and ensure Ollama is running.
- Optional env vars:
  - `OLLAMA_URL` (default `http://127.0.0.1:11434`)
  - `OLLAMA_MODEL` (default `llama3.1:8b`)

Hosted alternative from the public APIs list:
- Use OpenRouter by setting `LLM_PROVIDER=openrouter` and providing `OPENROUTER_API_KEY`.
- Optional: `OPENROUTER_MODEL` (default `meta-llama/llama-3.1-8b-instruct:free`), `OPENROUTER_SITE`, `OPENROUTER_TITLE`.

Quick start with Ollama (macOS):
1) Install Ollama: https://ollama.com/download
2) Pull a model (example): `ollama pull llama3.1:8b`
3) Start the backend: it will use Ollama automatically when `OPENAI_API_KEY` is not set.
4) Check `/api/health` — `llmProvider` will show `"ollama"` when active.

3) Run
- Option A: two terminals
	- Terminal A (repo root): `npm run server`
	- Terminal B (repo root): `npm run dev`
- Option B: one terminal
	- Terminal (repo root): `npm run dev:full`
- Open http://localhost:5173

The frontend calls the backend when `VITE_BACKEND_URL` is set; otherwise it will try the client key or fall back to a local generator.

## Notes: PlotState, choices, and continuity

- Player choices update a persistent `plotState` with:
	- `tone`: one of `friendly`, `neutral`, or `bold` (expandable later)
	- `decisions`: a log of significant choice effects with their dialogue index
- Generation uses `plotState` to steer the next episode:
	- Story prompt includes tone preference and a short summary of recent decisions
	- Dialogue prompt includes tone preference so conversations align with prior choices
- Interactive dialogue rules:
	- At least 3 reply options are shown when you’re replying to another character
	- No options are shown when the current speaker is the user (avatar)
	- Background click won’t advance if a choice is required; you must pick one
	- Each choice can branch the dialogue a bit (`nextDelta`) and apply an effect to `plotState`
- Length: Each episode has ≥ 100 dialogue pages (padded if the generator returns fewer)
- UI: “Back to Main Page” button is always visible at top-left in white on dialogue screens

### Future improvements
- Deeper branching: add structured flags (relationship scores, risks taken) and condition future scenes on them
- Stronger continuity: feed `plotState` and selected flags into subsequent episode prompts to tightly guide plot and tone
- Optional UI surfacing: show tone/branch tags or a mini recap before each new episode
