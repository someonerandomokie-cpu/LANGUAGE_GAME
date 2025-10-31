import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs-extra';
import Replicate from 'replicate';

const router = express.Router();

// Lazily initialize Replicate after dotenv has loaded in the main server
function getReplicate() {
  if (!globalThis.__replicateInstance) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return null;
    globalThis.__replicateInstance = new Replicate({ auth: token });
  }
  return globalThis.__replicateInstance;
}

function hashPrompt(prompt) {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

function buildPrompt({ plot, dialogText, lang, genre }) {
  // Concise, model-friendly prompt with strong instruction to avoid text in images
  const core = [
    `${genre || 'Story'} scene in ${lang || 'English'}.`,
    `${dialogText || plot || 'A cinematic story background'}.`,
    'Ultra-detailed, realistic lighting, depth, 4K resolution.',
    'No text, no words, no letters, no signage, no captions, no subtitles, no watermarks.'
  ].join('\n  ');
  return `\n  ${core}\n`;
}

async function downloadAndSave(url, outPath) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Failed to download image: ' + r.status);
  const buffer = await r.arrayBuffer();
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, Buffer.from(buffer));
  return outPath;
}

router.post('/api/generate-image', async (req, res) => {
  try {
    const replicate = getReplicate();

    const {
      plot = '',
      lang = 'English',
      genre = '',
      dialogText = '',
      // seedream4 core controls (simple defaults, overridable)
      width = 1024,
      height = 576,
      num_inference_steps = 30,
      guidance_scale = 7.5,
  negative_prompt = 'text, letters, words, typography, signage, caption, subtitles, watermark, logo, people, low quality, blurry, distorted'
    } = req.body || {};

    const prompt = buildPrompt({ plot, dialogText, lang, genre });
    const key = hashPrompt(`${prompt}::${width}x${height}::${num_inference_steps}::${guidance_scale}::${negative_prompt}`);
    const publicDir = path.join(process.cwd(), 'public');
    const generatedDir = path.join(publicDir, 'generated');
    const outJpg = path.join(generatedDir, `${key}.jpg`);
    const publicJpg = `/generated/${key}.jpg`;

    // If cached image exists, return it immediately
    if (await fs.pathExists(outJpg)) {
      return res.json({ url: publicJpg, prompt, cached: true });
    }

  // Basic input sanitation
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n|0));
  // Per bytedance/seedream-4 docs, custom width/height ranges are 1024-4096
  const inWidth = clamp(width || 1024, 1024, 4096);
  const inHeight = clamp(height || 1024, 1024, 4096);
  const steps = clamp(num_inference_steps || 30, 1, 150);
  const guidance = Math.max(0.1, Math.min(20, Number(guidance_scale) || 7.5));

    // Enforce presence of Replicate token
    if (!replicate) {
      return res.status(500).json({ error: 'Missing REPLICATE_API_TOKEN on server. Set it in server/.env and restart backend.' });
    }

    // Try preferred slug then fallback to official slug if needed
    const slugs = [process.env.REPLICATE_MODEL_SLUG || 'seedream/seedream4', 'bytedance/seedream-4'];
    let output = null;
    let lastErr = null;
    for (const slug of slugs) {
      try {
        if (slug === 'bytedance/seedream-4') {
          output = await replicate.run(slug, {
            input: {
              // Reinforce no-text rule inside prompt for models without negative_prompt support
              prompt: `${prompt}\nNo text, no letters, no words, no signage, no captions, no watermark.`,
              size: '1K',
              aspect_ratio: '16:9',
              sequential_image_generation: 'disabled',
              max_images: 1,
              enhance_prompt: true
            }
          });
        } else {
          output = await replicate.run(slug, {
            input: {
              prompt,
              width: inWidth,
              height: inHeight,
              num_inference_steps: steps,
              guidance_scale: guidance,
              negative_prompt: negative_prompt
            }
          });
        }
        // If we got here without throwing, break; URL extraction below will validate
        break;
      } catch (e) {
        lastErr = e;
        output = null;
        continue;
      }
    }

    // output can vary by model/SDK version; try to extract a usable URL robustly
    const extractUrl = async (out) => {
      try {
        if (!out) return null;
        if (typeof out === 'string') return out;
        if (Array.isArray(out)) {
          for (const it of out) {
            const u = await extractUrl(it);
            if (u) return u;
          }
          return null;
        }
        if (typeof out === 'object') {
          try {
            const s = out.toString && out.toString();
            if (s && /^https?:\/\//i.test(String(s))) return String(s);
          } catch {}
          if (typeof out.url === 'string') return out.url;
          if (typeof out.proxy_url === 'string') return out.proxy_url;
          if (out && typeof out.href === 'string') return out.href;
          if (Array.isArray(out.images)) {
            for (const it of out.images) {
              const u = await extractUrl(it);
              if (u) return u;
            }
          }
          if (Array.isArray(out.output)) {
            for (const it of out.output) {
              const u = await extractUrl(it);
              if (u) return u;
            }
          }
        }
      } catch {}
      return null;
    };

    let firstUrl = await extractUrl(output);
    if ((!firstUrl || !/^https?:\/\//i.test(String(firstUrl))) && Array.isArray(output) && output.length) {
      try { firstUrl = String(output[0]); } catch {}
    }
    if (!firstUrl || !/^https?:\/\//i.test(String(firstUrl))) {
      const shape = (() => {
        try {
          if (Array.isArray(output)) return { type: 'array', length: output.length, sample: String(output[0]).slice(0, 200) };
          if (output && typeof output === 'object') return { type: 'object', keys: Object.keys(output).slice(0, 20) };
          return { type: typeof output, value: String(output).slice(0, 200) };
        } catch { return { type: 'unknown' }; }
      })();
      return res.status(502).json({ error: 'Unexpected Replicate output format', shape });
    }

    await downloadAndSave(firstUrl, outJpg);
    return res.json({ url: publicJpg, prompt, cached: false });
  } catch (err) {
    console.error('generate-image error:', err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

export default router;