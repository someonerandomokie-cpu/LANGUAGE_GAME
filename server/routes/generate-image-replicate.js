const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) {
  console.warn('REPLICATE_API_TOKEN is not set — /api/generate-image will fail until configured');
}

function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

function buildPrompt({ plot, dialogText, role, lang, genre, avatarName, buddyName, style = 'photorealistic, cinematic' }) {
  const sceneBase = role === 'dialogue'
    ? `Create a cinematic scene matching this dialogue line: "${dialogText}".`
    : `Create a cinematic scene that represents this plot summary: "${plot}".`;
  const cultural = lang ? `Include local details for ${lang}.` : '';
  const gen = genre ? `Genre: ${genre}.` : '';
  const characters = avatarName ? `Include a protagonist named ${avatarName}` : '';
  const mood = `Mood: nostalgic, slightly mysterious.`;
  const framing = role === 'dialogue' ? 'Camera: medium/close shot, intimate framing.' : 'Camera: wide-angle cinematic panorama.';
  const final = `${sceneBase} ${cultural} ${gen} ${characters}. ${mood} ${framing} Style: ${style}. Aspect ratio: 16:9. High detail, realistic lighting, cinematic color grading.`;
  return final;
}

async function startReplicatePrediction(prompt) {
  const url = 'https://api.replicate.com/v1/predictions';
  const body = {
    version: 'google/imagen-4', // If Replicate requires a specific version id replace this with the version id string
    input: {
      prompt: prompt,
      // Many models accept width/height; imagen may accept different params – keep them modest for speed/cost.
      // For safety, model params are left minimal; adjust if necessary for your Replicate plan.
      width: 2048,
      height: 1152
    }
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Replicate start failed: ${resp.status} ${text}`);
  }
  return await resp.json();
}

async function pollPrediction(predictionId) {
  const pollUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
  for (let attempt = 0; attempt < 80; attempt++) {
    const r = await fetch(pollUrl, {
      headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` }
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Replicate poll failed: ${r.status} ${t}`);
    }
    const j = await r.json();
    if (j.status === 'succeeded') return j;
    if (j.status === 'failed') throw new Error('Replicate prediction failed: ' + JSON.stringify(j));
    // backoff a bit
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Replicate prediction timed out');
}

async function downloadAndSave(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to download image: ' + r.status);
  const buffer = await r.buffer();
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, buffer);
  return outPath;
}

router.post('/api/generate-image', async (req, res) => {
  try {
    if (!REPLICATE_TOKEN) return res.status(500).json({ error: 'Server not configured with REPLICATE_API_TOKEN' });

    const { plot = '', lang = 'English', genre = '', role = 'plot', dialogText = '', avatarName = '', buddyName = '' } = req.body || {};
    const prompt = buildPrompt({ plot, dialogText, role, lang, genre, avatarName, buddyName });
    const key = hashPrompt(prompt);
    const publicDir = path.join(process.cwd(), 'public');
    const generatedDir = path.join(publicDir, 'generated');
    const outPath = path.join(generatedDir, `${key}.png`);
    const publicUrl = `/generated/${key}.png`;

    // If cached image exists, return it immediately
    if (await fs.pathExists(outPath)) {
      return res.json({ url: publicUrl, prompt, cached: true });
    }

    // Start prediction on Replicate
    const start = await startReplicatePrediction(prompt);
    const predictionId = start.id;
    // Poll for completion
    const finished = await pollPrediction(predictionId);

    const output = finished.output;
    if (!output || output.length === 0) throw new Error('No output from Replicate prediction');

    // Use the first output URL (hosted)
    const imageUrl = Array.isArray(output) ? output[0] : output;
    await downloadAndSave(imageUrl, outPath);

    return res.json({ url: publicUrl, prompt, cached: false });
  } catch (err) {
    console.error('generate-image error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

module.exports = router;