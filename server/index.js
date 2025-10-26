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

// Language -> country mapping for grounded prompts
const COUNTRY_BY_LANGUAGE = {
  Spanish: 'Spain',
  French: 'France',
  Chinese: 'China',
  Russian: 'Russia',
  Italian: 'Italy',
  Arabic: 'Morocco',
  Japanese: 'Japan',
  Korean: 'South Korea',
  Portuguese: 'Portugal',
  German: 'Germany',
  Hindi: 'India',
  Turkish: 'Turkey',
  Dutch: 'Netherlands',
  Swedish: 'Sweden',
  Polish: 'Poland'
};

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.post('/api/story', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { lang, genresList = [], avatarData = {}, buddy = 'Buddy', episodeNum = 1, previousPlot = '', plotState = {} } = req.body || {};
    const country = COUNTRY_BY_LANGUAGE[lang] || `${lang}-speaking region`;

    const prompt = `Write a SHORT, exciting story plot (1 paragraph, 3-4 sentences MAX) for episode ${episodeNum}.

Main Character: ${avatarData.name || 'The Traveler'}
Language: ${lang}
Country: ${country}
Setting: A specific place in ${country}
Genres: ${genresList.join(', ') || 'slice-of-life'}
Personality Traits: ${(avatarData.traits || []).join(', ') || 'curious'}
Hobbies: ${(avatarData.hobbies || []).join(', ') || 'exploring'}
Local Friend: ${buddy}
Previous plot: ${previousPlot || 'N/A'}
Tone preference from player choices so far: ${plotState?.tone || 'neutral'}

Requirements:
- Start with a HOOK that grabs attention immediately
- Include ONE specific conflict or mystery
- Conflicts, cultural details, and place names must fit ${country}
- Make it emotional and immersive
- NO mentions of teaching, lessons, or language learning
- End with suspense
- MUST be 1 paragraph, 3-4 sentences total`;

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
    const country = COUNTRY_BY_LANGUAGE[lang] || `${lang}-speaking region`;

    const vocabList = vocabPack.map(v => `${v.word}`).join(', ');
    const prompt = `Based on this story plot, create exactly 100 lines of natural dialogue that tell the story progressively.

Plot: ${plot}

Main Character: ${avatarData.name || 'Traveler'}
Friend: ${buddy}
Language: ${lang}
Country: ${country}
Setting: Specific places in ${country}
Vocabulary words to naturally use: ${vocabList}

Tone preference from player choices so far: ${plotState?.tone || 'neutral'}

Requirements:
- Exactly 100 dialogue exchanges
- Alternate between ${avatarData.name}, ${buddy}, and other characters (vendors, locals, strangers)
- Tell the story through conversation - advance the plot with each line
- Make it feel natural, fun, and emotional
- Focus on adventure and interaction - NO teaching or explaining words
- Use culturally and geographically appropriate references for ${country}
- Include moments of discovery, tension, and connection
- The final line should be poignant and set up the next episode
- Maintain consistent speaker names: protagonist is "${avatarData.name}", friend is "${buddy}". Do NOT use "You". Use named locals for other characters and keep them consistent.
- Only include CHOICES blocks at important moments, approximately every 5 lines. Choices should be 2-3 options in the TARGET LANGUAGE ONLY (no English translations, no parentheses). Do NOT include an option to respond in English.

Format each line as:
[Character Name]: [Their dialogue]

For choice moments, add on separate lines:
CHOICES:
- [Option 1 in target language]
- [Option 2 in target language]
- [Option 3 in target language] (optional)`;

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

// Generate vocabulary pack for lessons (5 items, simple -> slightly harder)
app.post('/api/vocab', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { lang = 'Spanish', episodeNum = 1, country: countryArg } = req.body || {};
    const country = countryArg || COUNTRY_BY_LANGUAGE[lang] || `${lang}-speaking region`;
    const prompt = `Generate a JSON array of 5 vocabulary items for learning ${lang}, suitable for episode ${episodeNum}. Start very simple and get slightly harder by item 5, but keep everything beginner-friendly. Focus on practical, high-frequency words or short phrases useful in ${country}. Each item MUST be an object with fields: "word" (in ${lang}), "meaning" (English), "examples" (array with 1-2 very short phrases in ${lang}). Output ONLY valid JSON array.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.7 })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'OpenAI call failed', detail: t });
    }
    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content?.trim() || '[]';
    let pack = [];
    try { pack = JSON.parse(txt); } catch { pack = []; }
    if (!Array.isArray(pack)) pack = [];
    res.json({ pack });
  } catch (e) {
    console.error('vocab error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Language-Game server listening on http://localhost:${PORT}`);
});
