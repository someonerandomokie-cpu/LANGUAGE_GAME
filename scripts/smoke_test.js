#!/usr/bin/env node
/* simple smoke test for local dev */
import fetch from 'node-fetch';

const BASE = process.env.SERVER_URL || 'http://127.0.0.1:8888';

async function main() {
  const out = { ok: true, steps: [] };
  const add = (name, res) => out.steps.push({ name, ...res });
  try {
    // health
    let health = null;
    try {
      const r = await fetch(`${BASE}/api/health`);
      const j = await r.json().catch(() => ({}));
      health = j;
      add('health', { status: r.status, body: j });
    } catch (e) {
      add('health', { error: String(e) });
      out.ok = false;
    }

    // story (OpenAI)
    try {
      const r = await fetch(`${BASE}/api/story`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'Spanish', genresList: ['Adventure'], avatarData: { name: 'Ari' }, buddy: 'Lucia', episodeNum: 1 })
      });
      const txt = await r.text();
      let body;
      try { body = JSON.parse(txt); } catch { body = txt; }
      add('story', { status: r.status, body });
      if (!r.ok) out.ok = false;
    } catch (e) {
      add('story', { error: String(e) });
      out.ok = false;
    }

    // dialogues
    try {
      const r = await fetch(`${BASE}/api/dialogues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plot: 'Ari and Lucia wander a night market', avatarData: { name: 'Ari' }, buddy: 'Lucia', lang: 'Spanish', vocabPack: [{ word: 'hola' }, { word: 'gracias' }, { word: 'adiós' }] })
      });
      const txt = await r.text();
      let body;
      try { body = JSON.parse(txt); } catch { body = txt; }
      add('dialogues', { status: r.status, body: typeof body === 'string' ? body.slice(0, 200) + '...' : body });
      if (!r.ok) out.ok = false;
    } catch (e) {
      add('dialogues', { error: String(e) });
      out.ok = false;
    }

    // lesson
    try {
      const r = await fetch(`${BASE}/api/lesson`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'Spanish', episodeNum: 1 })
      });
      const txt = await r.text();
      let body;
      try { body = JSON.parse(txt); } catch { body = txt; }
      add('lesson', { status: r.status, body });
      if (!r.ok) out.ok = false;
    } catch (e) {
      add('lesson', { error: String(e) });
      out.ok = false;
    }

    // image (Replicate) — only if REPLICATE token is present
    if (health && health.hasReplicate) {
      try {
        const r = await fetch(`${BASE}/api/generate-image`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plot: 'night market near the harbor', lang: 'Spanish', size: '2K', aspect_ratio: '4:3', max_images: 1 })
        });
        const txt = await r.text();
        let body;
        try { body = JSON.parse(txt); } catch { body = txt; }
        add('image', { status: r.status, body });
        if (!r.ok) out.ok = false;
      } catch (e) {
        add('image', { error: String(e) });
        out.ok = false;
      }
    } else {
      add('image', { skipped: true, reason: 'REPLICATE_API_TOKEN not configured' });
    }

    console.log(JSON.stringify(out, null, 2));
    process.exit(out.ok ? 0 : 1);
  } catch (e) {
    console.error('smoke test error', e);
    process.exit(2);
  }
}

main();
