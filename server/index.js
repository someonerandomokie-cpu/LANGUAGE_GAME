import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// Optional: RunwayML video generation (only used if RUNWAY_API_KEY is set)
let RunwayML = null;
try {
  // Dynamically import so server can run even if not installed
  const mod = await import('@runwayml/sdk').catch(() => null);
  RunwayML = mod && (mod.default || mod.RunwayML) ? (mod.default || mod.RunwayML) : null;
} catch {}

// Load environment variables from the server folder explicitly
const __filenameEnv = fileURLToPath(import.meta.url);
const __dirnameEnv = path.dirname(__filenameEnv);
dotenv.config({ path: path.resolve(__dirnameEnv, '.env') });

const app = express();
const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ORIGIN || '*';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY;
const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_KEY;

app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// --- Minimal JSON file store for user avatars ---
let __filenameDb, __dirnameDb;
try {
  __filenameDb = fileURLToPath(import.meta.url);
  __dirnameDb = path.dirname(__filenameDb);
} catch {}
const dataDir = path.resolve(__dirnameDb || '.', 'data');
const usersDbPath = path.join(dataDir, 'users.json');

function ensureDataStore() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(usersDbPath)) fs.writeFileSync(usersDbPath, JSON.stringify({ users: {} }, null, 2));
  } catch (e) {
    console.warn('Failed to ensure data store', e);
  }
}

function readUsersDb() {
  try {
    ensureDataStore();
    const raw = fs.readFileSync(usersDbPath, 'utf-8');
    const json = JSON.parse(raw || '{}');
    if (!json.users || typeof json.users !== 'object') return { users: {} };
    return json;
  } catch {
    return { users: {} };
  }
}

function writeUsersDb(db) {
  try {
    ensureDataStore();
    fs.writeFileSync(usersDbPath, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.warn('Failed to write users DB', e);
    return false;
  }
}

// Save avatar URL for a user
app.post('/api/save-avatar', (req, res) => {
  try {
    const { userId, avatarUrl } = req.body || {};
    if (!userId || !avatarUrl) return res.status(400).json({ error: 'Missing userId or avatarUrl' });
    const db = readUsersDb();
    db.users[userId] = { ...(db.users[userId] || {}), avatarUrl, updatedAt: Date.now() };
    const ok = writeUsersDb(db);
    if (!ok) return res.status(500).json({ error: 'Failed to persist avatar' });
    return res.json({ ok: true, userId, avatarUrl });
  } catch (e) {
    console.error('save-avatar error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Fetch avatar URL for a user
app.get('/api/user-avatar', (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    const db = readUsersDb();
    const rec = db.users[userId] || null;
    return res.json({ userId, avatarUrl: rec?.avatarUrl || null, updatedAt: rec?.updatedAt || null });
  } catch (e) {
    console.error('user-avatar error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Language -> Country and City mapping to ground content locally
const LANGUAGE_COUNTRY = {
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
const COUNTRY_CITY = {
  Spain: 'Barcelona',
  France: 'Paris',
  China: 'Shanghai',
  Russia: 'Saint Petersburg',
  Italy: 'Rome',
  Morocco: 'Marrakesh',
  Japan: 'Tokyo',
  'South Korea': 'Seoul',
  Portugal: 'Lisbon',
  Germany: 'Berlin',
  India: 'Mumbai',
  Turkey: 'Istanbul',
  Netherlands: 'Amsterdam',
  Sweden: 'Stockholm',
  Poland: 'Kraków'
};

app.post('/api/story', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { lang, genresList = [], avatarData = {}, buddy = 'Buddy', episodeNum = 1, previousPlot = '', plotState = {} } = req.body || {};
    const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
    const city = COUNTRY_CITY[country] || 'the capital';

    const contextNote = previousPlot ? `\n\nPrevious episode summary (for continuity): ${previousPlot}` : '';
    const toneNote = plotState?.tone ? `\n\nPlayer tone preference so far: ${plotState.tone}` : '';

    const prompt = `Write a SHORT plot summary (3-4 sentences MAX) for Episode ${episodeNum}.

Main Character: ${avatarData.name || 'The Traveler'}
Friend: ${buddy}
Genres: ${genresList.join(', ') || 'slice-of-life'}
Setting: ${city}, ${country}
Country: ${country}${contextNote}${toneNote}

Requirements:
- Output in English only
- Keep it fun and engaging, no language teaching in the narrative
- Include ONE specific conflict or mystery grounded in ${country}
- End with a small suspense beat
- STRICTLY 1 paragraph, 3-4 sentences total`;

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
    const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
    const city = COUNTRY_CITY[country] || 'the capital';

    const vocabList = vocabPack.map(v => `${v.word}`).join(', ');
  const prompt = `Based on this plot, write exactly 100 lines of natural dialogue in ENGLISH that advance the story progressively. You may embed ONLY the learner's target-language vocabulary words in-line when natural, but all other text must remain English.

Plot: ${plot}
Main Character: ${avatarData.name || 'Traveler'}
Friend: ${buddy}
Setting: ${city}, ${country}
Vocabulary words (TARGET LANGUAGE, may be embedded as-is): ${vocabList}
Preferred tone from player choices: ${plotState?.tone || 'neutral'}

Requirements:
- Dialogue lines must be in English ONLY. The ONLY allowed non-English words are from the provided vocabulary list (embed sparingly and naturally).
- Exactly 100 dialogue exchanges (do NOT count CHOICES lines as dialogue exchanges)
- Alternate between ${avatarData.name}, ${buddy}, and consistent local characters
- No teaching or explaining words; keep it emotional and story-driven
- Include grounded references to ${country} (neighborhoods, markets, landmarks)
- The final line should set up the next episode
- Maintain speaker names (no "You")
- CHOICES blocks appear only every ~5 lines, 2-3 options
- CHOICES must be in the format: Say: "<vocab word>" and ONLY use words from the provided vocabulary list

Format:
[Character Name]: [Their dialogue]
CHOICES:
- Say: "<one of the provided vocab words>"
- Say: "<one of the provided vocab words>"
- Say: "<one of the provided vocab words>" (optional)`;

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

// Generate lesson content (vocabulary + short phrases) for the selected language
app.post('/api/lesson', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { lang = 'Spanish', episodeNum = 1 } = req.body || {};

    const prompt = `You are a language tutor. Create a small lesson for learners of ${lang}.

Difficulty: start very simple and gradually get slightly harder by episode number; this is episode ${episodeNum}.
Return STRICT JSON only, no prose, matching exactly this schema:
{
  "words": [
    { "word": "<target word in ${lang}", "meaning": "<English meaning>", "examples": ["<short example sentence in ${lang}", "<another>"] },
    ... (exactly 5 items)
  ],
  "phrases": [
    { "phrase": "<short phrase in ${lang}", "meaning": "<English meaning>" },
    ... (exactly 3 items)
  ]
}

Constraints:
- Choose high-utility, everyday words and phrases
- Keep example sentences short and natural
- Do not include any explanations outside the JSON
- Ensure all target-language text is in ${lang}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7
      })
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: 'OpenAI call failed', detail: t });
    }
    const data = await r.json();
    const txt = data?.choices?.[0]?.message?.content || '';
    // Try to parse strict JSON; if wrapped in code fences, extract
    let jsonText = txt.trim();
    const fenceMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenceMatch) jsonText = fenceMatch[1].trim();
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch {
      // Attempt to find first JSON object
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        try { parsed = JSON.parse(jsonText.slice(start, end + 1)); } catch {}
      }
    }
    if (!parsed || !parsed.words) return res.status(500).json({ error: 'Malformed AI lesson payload', raw: txt });
    res.json(parsed);
  } catch (e) {
    console.error('lesson error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Generate an 8-second intro video using RunwayML (best-effort). Returns { videoUrl } or { videoUrl: null } if not configured.
app.post('/api/intro-video', async (req, res) => {
  try {
    const { lang = 'Spanish', genre = 'Adventure', city = 'Barcelona', plot = '', avatarUrl = '' } = req.body || {};
    if (!RUNWAY_API_KEY) {
      return res.json({ videoUrl: null, reason: 'RUNWAY not configured' });
    }

    // Build a prompt that explicitly uses BOTH the plot and the user's avatar
    const promptText = [
      `Cinematic 8-second intro for a ${genre} story set in ${city}.`,
      `Plot summary: ${plot}`,
      avatarUrl ? `The main character should clearly resemble the avatar from this model URL: ${avatarUrl}.` : 'Focus on a single protagonist. ',
      'Show local mood and location establishing shots; no text overlays; cohesive, filmic look.'
    ].join(' ');

    // Prefer text-to-video when available; fall back to image-to-video with prompt-only
    if (RunwayML) {
      try {
        const client = new RunwayML({ apiKey: RUNWAY_API_KEY });
        let task = null;
        if (client?.textToVideo?.create) {
          task = await client.textToVideo
            .create({ model: 'gen4_turbo', promptText, ratio: '1280:720', duration: 8 })
            .waitForTaskOutput();
        } else if (client?.imageToVideo?.create) {
          task = await client.imageToVideo
            .create({ model: 'gen4_turbo', promptText, ratio: '1280:720', duration: 8 })
            .waitForTaskOutput();
        }
        const url = (task && (task.outputs?.[0]?.url || task.result?.url || task.url)) || null;
        return res.json({ videoUrl: url });
      } catch (sdkErr) {
        console.warn('Runway SDK failed; falling back to REST', sdkErr?.message || sdkErr);
      }
    }

    // REST fallback (best-effort): submit a generation task via Runway API
    try {
      const createResp = await fetch('https://api.runwayml.com/v1/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RUNWAY_API_KEY}`
        },
        body: JSON.stringify({ model: 'gen4_turbo', promptText, ratio: '1280:720', duration: 8 })
      });
      if (!createResp.ok) {
        const detail = await createResp.text().catch(() => '');
        return res.status(502).json({ error: 'Runway create failed', detail });
      }
      const createData = await createResp.json();
      const id = createData?.id || createData?.task_id || createData?.taskId;
      if (!id) return res.status(502).json({ error: 'Runway create returned no id' });

      // Poll for completion up to ~20s
      let attempts = 0;
      let videoUrl = null;
      while (attempts < 10) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        const statusResp = await fetch(`https://api.runwayml.com/v1/videos/${id}`, {
          headers: { Authorization: `Bearer ${RUNWAY_API_KEY}` }
        });
        if (!statusResp.ok) continue;
        const statusData = await statusResp.json();
        const st = statusData?.status || statusData?.state || '';
        if (/complete|succeed/i.test(st)) {
          videoUrl = statusData?.outputs?.[0]?.url || statusData?.result?.url || statusData?.url || null;
          break;
        }
        if (/failed|error/i.test(st)) {
          break;
        }
      }
      return res.json({ videoUrl });
    } catch (restErr) {
      console.warn('Runway REST failed', restErr?.message || restErr);
      return res.status(500).json({ error: 'intro video generation failed (Runway REST)' });
    }
  } catch (e) {
    console.error('intro-video error', e);
    return res.status(500).json({ error: 'intro video generation failed' });
  }
});

// Serve built frontend (dist) for production single-host deployment
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} catch (e) {
  // ignore if not available (e.g., during dev)
}

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Language-Game server listening on http://${HOST === '0.0.0.0' ? '0.0.0.0' : HOST}:${PORT}`);
});
