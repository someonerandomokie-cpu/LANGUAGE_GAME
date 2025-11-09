import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

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
import { chat as llmChat, currentProvider as llmCurrentProvider, getOpenAIClient } from './llm.js';
import OpenAI from 'openai'; // import line requested by user

// Load environment variables: root .env first, then server/.env to allow overrides locally
const __filenameEnv = fileURLToPath(import.meta.url);
const __dirnameEnv = path.dirname(__filenameEnv);
// Load root .env then server/.env, allowing server/.env to override and also override any pre-set empties
dotenv.config({ override: true });
dotenv.config({ path: path.resolve(__dirnameEnv, '.env'), override: true });

const app = express();
// Pin to a stable local port to avoid shell/env conflicts
const PORT = 8888;
const ORIGIN = process.env.ORIGIN || '*';
// Some environments prefix shell exports with the word "export"; strip it defensively
const cleanKey = (s) => (s || '').replace(/^\s*export\s+/i, '').trim();
const OPENAI_KEY = cleanKey(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_KEY);
// Optional separate API key to use exclusively for image generation (do NOT commit the key)
const IMAGE_OPENAI_KEY = cleanKey(process.env.IMAGE_OPENAI_API_KEY || process.env.IMAGE_OPENAI_KEY || '');
// Per user request: instantiate an OpenAI client using the official SDK
const client = new OpenAI();
// Model used to produce a refined image prompt from the plot text (GPT-4o requested by user).
// Can be overridden via IMAGE_PROMPT_MODEL in env. If not set, no intermediate prompt-gen call is made.
const IMAGE_PROMPT_MODEL = process.env.IMAGE_PROMPT_MODEL || 'gpt-5-mini';
// Removed Runway API key (not used)

app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.json());

// Startup diagnostics for configuration
// Per requirements: OpenAI must be used for text generation
if (!OPENAI_KEY) {
  console.error('ERROR: OPENAI_API_KEY is required for text generation. Please set it in server/.env');
  console.error('The application will not function properly without OpenAI API access.');
}
const LLM_PROVIDER = 'openai'; // Enforce OpenAI per requirements
console.log(`LLM provider: ${LLM_PROVIDER} (OpenAI API required for text generation)`);

// In dev, re-load env on every request so editing server/.env takes effect without restart.
// This is safe because dotenv only sets process.env for missing keys unless override:true.
app.use((req, _res, next) => {
  try {
    dotenv.config({ override: true });
    dotenv.config({ path: path.resolve(__dirnameEnv, '.env'), override: true });
  } catch {}
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    ts: Date.now(),
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasReplicate: !!process.env.REPLICATE_API_TOKEN,
    llmProvider: llmCurrentProvider()
  });
});

// Simple demo endpoint for frontend connectivity checks
app.get('/api/data', (_req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Simple OpenAI echo endpoint for connectivity/debug (matches ChatGPT sample semantics)
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt = '' } = req.body || {};
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    }
    const primary = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const userMsg = { role: 'user', content: String(prompt || '').slice(0, 4000) };
    let text = '';
    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: primary,
        messages: [userMsg]
      });
      text = completion?.choices?.[0]?.message?.content || '';
    } catch (err) {
      const m = String(err?.message || err || '');
      if (/must be verified|not found|unsupported model|404/i.test(m)) {
        const fallback = 'gpt-4o-mini';
        const completion2 = await getOpenAIClient().chat.completions.create({
          model: fallback,
          messages: [userMsg]
        });
        text = completion2?.choices?.[0]?.message?.content || '';
      } else {
        throw err;
      }
    }
    res.json({ text });
  } catch (e) {
    console.error('/api/generate error', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
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
import generateImageRoute from './routes/generate-image-replicate.js';
import rpmExportBatchRoute from './routes/rpmExportBatch.js';

// after express app is created and middleware set:
app.use(express.json({ limit: '1mb' }));
// Default image generation uses Replicate (Imagen 4) mounted at /api/generate-image
app.use(generateImageRoute);
// Mount Ready Player Me export batch route under /api/rpm
app.use('/api/rpm', rpmExportBatchRoute);

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
    const { lang = 'English', genresList = [], avatarData = {}, buddy = 'Buddy', episodeNum = 1, previousPlot = '', plotState = {} } = req.body || {};
    const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
    const city = COUNTRY_CITY[country] || 'the capital';

    const name = avatarData?.name || 'You';
    const contextNote = previousPlot ? `Previous episode summary (for continuity): ${previousPlot}` : '';
    const toneNote = plotState?.tone ? `Player tone preference so far: ${plotState.tone}` : '';
    const instruction = [
      `Write a vivid, single-paragraph plot summary (~4-7 sentences) for an episodic story in English.`,
      `Episode ${episodeNum}. Incorporate themes from genres [${genresList.join(', ') || 'slice-of-life'}] and hobbies [${(avatarData?.hobbies || []).join(', ') || 'none'}].`,
      `Main characters must be ${name} (the user) and ${buddy} (the user's best friend and study buddy).`,
      previousPlot
        ? `Create an entirely new plot. Do NOT reuse specific events, locations, or conflicts from the previous plot. Vary setting details (different venue/neighborhood/time) while keeping tone continuity.`
        : `Create a fresh plot from scratch aligned with the selected genres/hobbies.`,
      `Set the story in ${city}, ${country} with grounded cultural texture.`,
      `Maintain character consistency across episodes and keep unresolved threads plausible, but ensure this episode stands on its own.`,
      `Avoid any mention or implication that characters are learning English or improving their English. Do not reference language learning at all in the summary.`,
      `Do not include meta notes, bullet points, or headings. Output only the paragraph.`
    ].join('\n');

    const result = await llmChat([
      { role: 'system', content: 'You are a narrative designer. Output in English only.' },
      { role: 'user', content: `${instruction}\n\n${contextNote}\n${toneNote}` }
    ], { provider: 'openai', temperature: 0.9, max_tokens: 400 });

    let summary = String(result.content || '').trim();
    if (!summary) {
      throw new Error('LLM returned empty response for story generation');
    }
    res.json({ summary, story: summary, text: summary });
  } catch (e) {
    console.error('story error', e);
    res.status(500).json({ error: 'server error' });
  }
});

app.post('/api/dialogues', async (req, res) => {
  try {
    const { plot = '', avatarData = {}, buddy = 'Buddy', lang = 'English', vocabPack = [], plotState = {} } = req.body || {};
    const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
    const city = COUNTRY_CITY[country] || 'the capital';
    const name = avatarData?.name || 'You';

    const vocabWords = (Array.isArray(vocabPack) ? vocabPack.map(v => v && (v.word || v.phrase)).filter(Boolean) : []).slice(0, 24);
    const instruction = [
      `Write exactly 100 lines of natural dialogue in English.`,
      `Main characters: ${name} (the user) and ${buddy} (best friend and study buddy). Include a few recurring named NPCs with stable names.`,
      `Each line format: Speaker: text`,
      `Always keep precise track of who is speaking. Maintain a consistent cast of names; do not switch between "you" and ${name} arbitrarily. Avoid ambiguous pronouns. Never output unlabeled lines or 'Narrator' lines.`,
      `Keep the plot consistent with the provided plot summary and prior tone/state. Maintain continuity across episodes.`,
      vocabWords.length ? `Gradually incorporate these target-language words inline when it makes narrative sense (no brackets/translations): ${vocabWords.join(', ')}.` : null,
      `When offering player choices, prefer a "Say: \"<target word>\"" option only if it fits the context. If no target word fits, present sensible English plot choices instead.`,
      `CHOICES format example (only when appropriate):\nCHOICES:\n- Say: "<target word>"\n- Make a plan to <plot-relevant action>\n- Ask ${buddy} about <relevant topic>`,
      `No meta commentary. Keep everything in English except the inline target words.`
    ].filter(Boolean).join('\n');

    const result = await llmChat([
      { role: 'system', content: 'You are a screenwriter. Output only dialogue lines and occasional CHOICES blocks. Keep exact speaker names consistent across the entire script.' },
      { role: 'user', content: `${instruction}\n\nPlot summary:\n${plot}\n\nSetting: ${city}, ${country}\nTone/state: ${JSON.stringify(plotState)}` }
    ], { provider: 'openai', temperature: 0.9, max_tokens: 4000 });

    let content = result.content || '';
    if (!content) {
      throw new Error('LLM returned empty response for dialogue generation');
    }
    res.json({ content, text: content });
  } catch (e) {
    console.error('dialogues error', e);
    res.status(500).json({ error: 'server error' });
  }
});

// Generate contextual choices for a dialogue turn
app.post('/api/choices', async (req, res) => {
  try {
    const { plot = '', contextLines = [], lang = 'English', vocabPack = [], buddy = 'Buddy', tone = 'neutral' } = req.body || {};
    const vocabWords = (Array.isArray(vocabPack) ? vocabPack.map(v => v && (v.word || v.phrase)).filter(Boolean) : []).slice(0, 16);
    const instruction = [
      `Given the plot summary and the recent dialogue context, generate 2-3 interactive choices for the player.`,
      `Choices must be short and make sense in context. They may be in English or (occasionally) include a single ${lang} word inline if natural.`,
      `Do not include translations in parentheses.`,
      `Some choices can subtly influence tone ('friendly' | 'neutral' | 'bold'), others have no effect.`,
      `Return STRICT JSON only as { "choices": [ { "text": "...", "effect": {"tone": "friendly"|"neutral"|"bold"} | null, "nextDelta": 1 }, ... ] }`,
      vocabWords.length ? `Useful ${lang} words to optionally use: ${vocabWords.join(', ')}` : null
    ].filter(Boolean).join('\n');

    const ctxSnippet = (Array.isArray(contextLines) ? contextLines.slice(-6) : []).map(l => `${l.speaker}: ${l.text}`).join('\n');
    const user = { role: 'user', content: `${instruction}\n\nPlot:\n${plot}\n\nRecent lines:\n${ctxSnippet}\n\nCurrent tone: ${tone}` };
    let out = '';
    try {
      const completion = await getOpenAIClient().chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-5-mini', messages: [user] });
      out = completion?.choices?.[0]?.message?.content || '';
    } catch (err) {
      const m = String(err?.message||'');
      if (/must be verified|not found|unsupported model|404/i.test(m)) {
        const completion2 = await getOpenAIClient().chat.completions.create({ model: 'gpt-4o-mini', messages: [user] });
        out = completion2?.choices?.[0]?.message?.content || '';
      } else {
        throw err;
      }
    }
    // Extract JSON
    const fence = out.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fence) out = fence[1];
    let parsed = null;
    try { parsed = JSON.parse(out); } catch {
      const s = out.indexOf('{'); const e = out.lastIndexOf('}');
      if (s !== -1 && e !== -1) { try { parsed = JSON.parse(out.slice(s, e+1)); } catch {} }
    }
    if (!parsed || !Array.isArray(parsed.choices)) return res.status(500).json({ error: 'bad ai payload', raw: out });
    // Normalize fields
    const norm = parsed.choices.slice(0,3).map(c => ({
      text: String(c.text || '').slice(0, 140),
      effect: c.effect && c.effect.tone ? { tone: c.effect.tone } : null,
      nextDelta: Number.isFinite(c.nextDelta) ? c.nextDelta : 1
    }));
    return res.json({ choices: norm });
  } catch (e) {
    console.error('/api/choices error', e);
    return res.status(500).json({ error: 'server error' });
  }
});

// Generate lesson content (vocabulary + short phrases) for the selected language
app.post('/api/lesson', async (req, res) => {
  try {
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

    // Use LLM provider if available
    let jsonText = '';
    try {
      const { content, provider } = await llmChat([{ role: 'user', content: prompt }], { provider: 'openai', temperature: 0.7, max_tokens: 800 });
      jsonText = String(content || '').trim();
      // If provider returned nothing (mock), fall through to local template
      if (!jsonText) throw new Error('empty-lesson');
    } catch (err) {
      // No fallback - require LLM for lesson generation
      throw err;
    }

    // Parse JSON from the LLM
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
    if (!parsed || !parsed.words) return res.status(500).json({ error: 'Malformed AI lesson payload', raw: jsonText });
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
  // Also serve public folder to expose /generated/* images from Replicate route
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
  app.use('/generated', express.static(path.join(publicPath, 'generated')));
} catch {}

// Utility: quick hash for cache keys
function sha1(text) {
  try { return crypto.createHash('sha1').update(String(text || '')).digest('hex'); } catch { return String(text || ''); }
}

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
