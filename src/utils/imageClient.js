export async function fetchGeneratedImage({ plot = '', lang = 'English', genre = '', role = 'plot', dialogText = '', avatarName = '', buddyName = '' } = {}) {
  try {
    const resp = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plot, lang, genre, role, dialogText, avatarName, buddyName })
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Image generation failed: ${resp.status} ${txt}`);
    }
    const data = await resp.json();
    // data: { url: "/generated/<hash>.png", prompt: "...", cached: true|false }
    return data;
  } catch (e) {
    console.warn('fetchGeneratedImage error', e);
    return null;
  }
}