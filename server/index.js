import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ORIGIN || '*';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY;

app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post('/api/story', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { lang, genresList = [], avatarData = {}, buddy = 'Buddy', episodeNum = 1, previousPlot = '', plotState = {} } = req.body || {};

    const prompt = `Create a short, punchy plot summary (3-4 sentences) for Episode ${episodeNum}.
Language context: ${lang}
Main Character: ${avatarData.name || 'Traveler'}
Friend: ${buddy}
Genres: ${genresList.join(', ')}
Previous episode summary (for continuity): ${previousPlot || 'N/A'}
Player tone preference: ${plotState?.tone || 'neutral'}

Requirements:
- Keep it fun and engaging, no language teaching in the narrative.
- The protagonist is ${avatarData.name || 'the user'}.
- Include a hook or tension point to pull the player in.
- 3-4 sentences only.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.9
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'OpenAI call failed', detail: t });
    }
    const data = await r.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() || '';
    res.json({ summary });
  } catch (e) {
    console.error('story error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/dialogues', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { plot = '', avatarData = {}, buddy = 'Buddy', lang = 'Spanish', vocabPack = [], plotState = {} } = req.body || {};

    const vocabList = vocabPack.map(v => `${v.word}`).join(', ');
    const prompt = `Based on this plot, write exactly 100 lines of dialogue that advance the story naturally.

Plot: ${plot}
Main Character: ${avatarData.name || 'Traveler'}
Friend: ${buddy}
Language setting: ${lang}
Preferred tone: ${plotState?.tone || 'neutral'}
Vocabulary to optionally weave in (without teaching): ${vocabList}

Rules:
- Only dialogue lines in format: [Name]: [line]
- Use consistent names: protagonist is "${avatarData.name}", friend is "${buddy}". Do NOT use "You".
- Add CHOICES blocks only every ~5 lines, 2-3 options, in the target language only (no English, no parentheses).
- No language lessons; keep it fun and story-driven.
- Final line should feel like a moment, no extra commentary.
`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.9
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'OpenAI call failed', detail: t });
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '';
    res.json({ content });
  } catch (e) {
    console.error('dialogues error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Language-Game server listening on http://localhost:${PORT}`);
});
