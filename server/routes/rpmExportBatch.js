/**
 * rpmExportBatch.js (ESM)
 *
 * Mount at: app.use('/api/rpm', router)
 * Endpoint: POST /api/rpm/export-batch
 * Body: { characters: [{ id, seed?, params? }, ...] }
 * Returns: [{ characterId, url, metadata } | { characterId, url: null, error }]
 *
 * NOTE: Placeholder RPM implementation; replace with official Ready Player Me server API calls.
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import express from 'express';

const router = express.Router();

const AVATAR_DIR = path.resolve(process.cwd(), 'public', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Placeholder RPM API variables - replace with real values from RPM docs or .env
const RPM_API_BASE = process.env.RPM_API_BASE || 'https://api.readyplayer.me';
const RPM_API_KEY = process.env.RPM_API_KEY || '';

// Helper: call Ready Player Me to request an export for a character.
// RETURNS an object { exportUrl, metadata } or throws.
// NOTE: Replace this implementation with the exact RPM server API call (refer to RPM docs).
async function requestRpmExportForCharacter(character) {
  const body = {
    seed: character.seed || `auto-${character.id}-${Date.now()}`,
    options: character.params || {},
  };

  const res = await fetch(`${RPM_API_BASE}/v1/avatars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RPM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`RPM export request failed: ${res.status} ${txt}`);
  }

  const json = await res.json();
  // placeholder: json.export_url should be the GLB download URL. Adjust per RPM response.
  if (!json || !json.export_url) {
    throw new Error('Unexpected RPM response; no export_url: ' + JSON.stringify(json));
  }
  return { exportUrl: json.export_url, metadata: json.metadata || {} };
}

// Helper: download a remote URL to local path
async function downloadToFile(url, outfile) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download failed: ' + res.status);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(outfile, Buffer.from(arrayBuffer));
  return outfile;
}

router.post('/export-batch', async (req, res) => {
  try {
    const { characters } = req.body || {};
    if (!Array.isArray(characters)) return res.status(400).json({ error: 'characters array required' });

    const results = [];
    for (const ch of characters) {
      try {
        // 1) Request export from Ready Player Me
        const { exportUrl, metadata } = await requestRpmExportForCharacter(ch);

        // 2) Download GLB to public/avatars/{characterId}.glb (overwrite ok)
        const filename = `${ch.id || `npc-${Date.now()}`}.glb`;
        const outfile = path.join(AVATAR_DIR, filename);
        await downloadToFile(exportUrl, outfile);

        // 3) Build public URL that maps to static serving of /public
        const publicUrl = `/avatars/${filename}`;

        results.push({
          characterId: ch.id,
          url: publicUrl,
          metadata,
        });
      } catch (err) {
        console.error('Failed to export for character', ch, err);
        results.push({
          characterId: ch.id,
          url: null,
          error: err.message,
        });
      }
    }

    return res.json(results);
  } catch (err) {
    console.error('export-batch error', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;