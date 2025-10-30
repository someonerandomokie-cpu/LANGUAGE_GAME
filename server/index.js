import express from 'express';

// Global error logging for diagnostics
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', err => {
  console.error('Unhandled Rejection:', err);
});
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Load environment variables: root .env first, then server/.env to allow overrides locally
const __filenameEnv = fileURLToPath(import.meta.url);
const __dirnameEnv = path.dirname(__filenameEnv);
dotenv.config();
dotenv.config({ path: path.resolve(__dirnameEnv, '.env') });

const app = express();
// Pin to a stable local port to avoid shell/env conflicts
const PORT = 8888;
const ORIGIN = process.env.ORIGIN || '*';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY;
// Optional separate API key to use exclusively for image generation (do NOT commit the key)
const IMAGE_OPENAI_KEY = process.env.IMAGE_OPENAI_API_KEY || process.env.IMAGE_OPENAI_KEY || '';
// Model used to produce a refined image prompt from the plot text (GPT-4o requested by user).
// Can be overridden via IMAGE_PROMPT_MODEL in env. If not set, no intermediate prompt-gen call is made.
const IMAGE_PROMPT_MODEL = process.env.IMAGE_PROMPT_MODEL || process.env.IMAGE_PROMPT_MODEL || 'gpt-4o';
// Removed Runway API key (not used)

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
const imagesDir = path.join(dataDir, 'images');
const audioDir = path.join(dataDir, 'audio');

// near other requires
const generateImageRoute = require('./routes/generate-image-replicate');

// after express app is created and middleware set:
app.use(express.json({ limit: '1mb' }));
app.use(generateImageRoute);

function ensureDataStore() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(usersDbPath)) fs.writeFileSync(usersDbPath, JSON.stringify({ users: {} }, null, 2));
    if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
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
  const inspiration = `\n\nInspiration: Take high-level inspiration from anthology-style romance/adventure stories in mobile visual novels (for example, lists like the Romance Club wiki of Complete Stories). Do NOT copy or reference the source directly; keep the plot fully original.`;

  const prompt = `Write a SHORT plot summary (3-4 sentences MAX) for Episode ${episodeNum}.

Main Character: ${avatarData.name || 'The Traveler'}
Friend: ${buddy}
Genres: ${genresList.join(', ') || 'slice-of-life'}
Setting: ${city}, ${country}
Country: ${country}${contextNote}${toneNote}${inspiration}

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
Inspiration: Take high-level inspiration from anthology-style romance/adventure visual novels (e.g., lists like the Romance Club wiki). Do NOT copy or reference the source; keep all dialogue fully original.

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

// Removed /api/intro-video (Runway) — video generation disabled

// Serve cached data (images) statically
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const dataPath = path.resolve(__dirname, 'data');
  app.use('/data', express.static(dataPath));
} catch {}

// Utility: quick hash for cache keys
function sha1(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

// Generate an illustrative photo for the plot or location using OpenAI Images API
app.post('/api/generate-image', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
  const { plot = '', lang = 'Spanish', genres = [], size: reqSize } = req.body || {};
    const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
    const city = COUNTRY_CITY[country] || 'the capital';

    // Short, photorealistic prompt tuned for speed and clarity
    const basePromptPieces = [
      genres && genres.length ? `Cinematic, realistic photo inspired by a ${genres.join(' & ')} story.` : 'Cinematic, realistic photo.',
      `Location: ${city}, ${country}.`,
      `Natural lighting, no text, no watermarks, richly detailed streetscape or skyline.`,
      `If people appear, keep them incidental (no faces prominent).`,
      plot ? `Mood cues from this short plot: ${plot.slice(0, 320)}` : ''
    ].filter(Boolean);

    let prompt = basePromptPieces.join(' ');

    // If we have a prompt-generation model available (e.g. gpt-4o) and an OPENAI_KEY,
    // use it to create a concise, image-model-optimized prompt. This keeps the image API
    // call on the image-only key (IMAGE_OPENAI_KEY) while using the main key to craft the prompt.
    if (IMAGE_PROMPT_MODEL && OPENAI_KEY) {
      try {
        const instruct = `You are a terse prompt-engineer for image generation models. Given the context and mood cues, produce ONE short, photorealistic prompt (1-2 sentences) optimized for a modern image model. Do NOT add commentary or markdown.`;
        const msg = `${instruct}\n\nContext: ${basePromptPieces.join(' ')}`;
        const pr = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: IMAGE_PROMPT_MODEL, messages: [{ role: 'user', content: msg }], max_tokens: 200, temperature: 0.8 })
        });
        if (pr.ok) {
          const prData = await pr.json();
          const candidate = prData?.choices?.[0]?.message?.content?.trim();
          if (candidate) {
            // prefer the generated candidate as the final prompt
            prompt = candidate.replace(/```/g, '').trim();
          }
        } else {
          const detail = await pr.text().catch(() => '');
          console.warn('Prompt-gen call failed, falling back to base prompt', { status: pr.status, detail: detail.slice(0, 200) });
        }
      } catch (err) {
        console.warn('Prompt-gen error; using base prompt', err?.message || err);
      }
    }

    ensureDataStore();
  // Coerce to API-supported sizes
  const supportedSizes = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);
  let size = (reqSize && typeof reqSize === 'string') ? reqSize : '1024x1024';
  if (!supportedSizes.has(size)) size = '1024x1024';
  const key = sha1(`${lang}::${city}::${country}::${(genres||[]).join(',')}::${size}::${prompt}`);
    const cached = path.join(imagesDir, `${key}.png`);
    if (fs.existsSync(cached)) {
      return res.json({ url: `/data/images/${key}.png`, cached: true });
    }

    // Call OpenAI Images with a timeout guard; typical times 4–10s (use 15s max)
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    try {
      // Use the image-specific key if provided; otherwise fall back to the main OPENAI_KEY
      const imagesKey = IMAGE_OPENAI_KEY || OPENAI_KEY;
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${imagesKey}`
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          size
        }),
        signal: controller.signal
      });
      clearTimeout(t);
      if (!r.ok) {
        const detail = await r.text().catch(()=> '');
        return res.status(502).json({ error: 'image generation failed', detail });
      }
      const data = await r.json();
      let buf;
      const b64 = data?.data?.[0]?.b64_json;
      const url = data?.data?.[0]?.url;
      if (b64) {
        buf = Buffer.from(b64, 'base64');
      } else if (url) {
        try {
          const ir = await fetch(url);
          if (!ir.ok) {
            const detail = await ir.text().catch(()=>'');
            return res.status(502).json({ error: 'image download failed', detail });
          }
          const ab = await ir.arrayBuffer();
          buf = Buffer.from(ab);
        } catch (dlErr) {
          console.error('image download error', dlErr);
          return res.status(500).json({ error: 'server error' });
        }
      } else {
        return res.status(502).json({ error: 'no image returned' });
      }
      fs.writeFileSync(cached, buf);
      return res.json({ url: `/data/images/${key}.png`, cached: false });
    } catch (e) {
      if (e?.name === 'AbortError') return res.status(504).json({ error: 'timeout' });
      console.error('generate-image error', e);
      return res.status(500).json({ error: 'server error' });
    }
  } catch (e) {
    console.error('generate-image error (outer)', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Text-to-Speech generation and caching
app.post('/api/tts', async (req, res) => {
  try {
    if (!OPENAI_KEY) return res.status(400).json({ error: 'Missing OPENAI_API_KEY' });
    const { text = '', lang = 'English', voice: reqVoice } = req.body || {};
    const cleanText = String(text || '').trim();
    if (!cleanText) return res.status(400).json({ error: 'Missing text' });

    // Basic voice mapping by language (can be expanded)
    const defaultVoice = 'alloy';
    const voice = typeof reqVoice === 'string' && reqVoice.trim() ? reqVoice.trim() : defaultVoice;

    ensureDataStore();
    const key = sha1(`${lang}::${voice}::${cleanText}`);
    const outPath = path.join(audioDir, `${key}.mp3`);
    if (fs.existsSync(outPath)) {
      return res.json({ url: `/data/audio/${key}.mp3`, cached: true });
    }

    // Call OpenAI TTS with a timeout
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice,
          input: cleanText,
          format: 'mp3'
        }),
        signal: controller.signal
      });
      clearTimeout(t);
      if (!r.ok) {
        const detail = await r.text().catch(()=> '');
        return res.status(502).json({ error: 'tts failed', detail });
      }
      const ab = await r.arrayBuffer();
      const buf = Buffer.from(ab);
      fs.writeFileSync(outPath, buf);
      return res.json({ url: `/data/audio/${key}.mp3`, cached: false });
    } catch (e) {
      if (e?.name === 'AbortError') return res.status(504).json({ error: 'timeout' });
      console.error('tts error', e);
      return res.status(500).json({ error: 'server error' });
    }
  } catch (e) {
    console.error('tts (outer) error', e);
    return res.status(500).json({ error: 'server error' });
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

const HOST = '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Language-Game server listening on http://${HOST === '0.0.0.0' ? '0.0.0.0' : HOST}:${PORT}`);
});
