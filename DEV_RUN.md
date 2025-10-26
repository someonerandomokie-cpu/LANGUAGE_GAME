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
	- PORT=8787
	- ORIGIN=http://localhost:5173
- Optionally create root `.env`:
	- VITE_BACKEND_URL=http://localhost:8787

3) Run
- Terminal A (repo root): npm run server
- Terminal B (repo root): npm run dev
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
