// utils/avatarUtils.js
// Helpers for converting Ready Player Me GLB/GLTF links to PNG portrait URLs

export function glbToPng(glbUrl) {
  if (!glbUrl || typeof glbUrl !== 'string') return null;
  try {
    // Match api.readyplayer.me/v1/avatars/<id>.glb
    let m = glbUrl.match(/readyplayer\.me\/v1\/avatars\/([^\/.?#]+)\.(?:glb|gltf)/i);
    if (m && m[1]) return `https://api.readyplayer.me/v1/avatars/${m[1]}.png`;
    // Match models.readyplayer.me/<id>.glb
    m = glbUrl.match(/models\.readyplayer\.me\/([^\/.?#]+)\.(?:glb|gltf)/i);
    if (m && m[1]) return `https://api.readyplayer.me/v1/avatars/${m[1]}.png`;
    // Match .../avatars/<id>.glb (generic)
    m = glbUrl.match(/avatars\/([^\/.?#]+)\.(?:glb|gltf)/i);
    if (m && m[1]) return `https://api.readyplayer.me/v1/avatars/${m[1]}.png`;
  } catch {}
  return null;
}

export function preferImageUrl(url) {
  // If url is GLB/GLTF, convert to PNG; otherwise keep as-is
  if (!url) return null;
  const lower = String(url).toLowerCase();
  if (/(\.glb|\.gltf)(\?|#|$)/.test(lower)) {
    const png = glbToPng(url);
    return png || url;
  }
  return url;
}
