import React, { useEffect, useMemo, useState } from 'react';

// Simple heuristic context analyzer inspired by provided spec
export function analyzeStoryContext(text = '', prev = {}) {
  const t = (text || '').toLowerCase();

  // Mood keywords
  const moods = {
    happy: ['happy', 'smile', 'laugh', 'joy', 'excited', 'thrilled', 'celebrate'],
    romantic: ['love', 'heart', 'romance', 'romantic', 'kiss', 'date', 'tender'],
    mysterious: ['mystery', 'secret', 'hidden', 'strange', 'shadow', 'whisper'],
    adventurous: ['adventure', 'explore', 'journey', 'discover', 'quest'],
    tense: ['nervous', 'afraid', 'danger', 'rush', 'urgent', 'threat'],
    sad: ['sad', 'lonely', 'tears', 'cry', 'hurt', 'loss'],
    peaceful: ['calm', 'quiet', 'peaceful', 'serene', 'tranquil']
  };
  let mood = prev.mood || 'peaceful';
  let bestMoodScore = -1;
  Object.entries(moods).forEach(([k, words]) => {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestMoodScore) { bestMoodScore = score; mood = k; }
  });

  // Location keywords
  const locations = {
    cafe: ['cafe', 'café', 'coffee', 'espresso', 'table', 'barista'],
    market: ['market', 'stall', 'vendor', 'bazaar'],
    park: ['park', 'garden', 'bench', 'trees'],
    museum: ['museum', 'gallery', 'exhibit'],
    beach: ['beach', 'ocean', 'sea', 'shore'],
    street: ['street', 'road', 'avenue', 'alley', 'square', 'plaza'],
    home: ['home', 'apartment', 'house', 'kitchen', 'room']
  };
  let location = prev.location || 'street';
  let bestLocScore = -1;
  Object.entries(locations).forEach(([k, words]) => {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestLocScore) { bestLocScore = score; location = k; }
  });

  // Time of day
  const times = {
    morning: ['morning', 'dawn', 'sunrise'],
    afternoon: ['afternoon', 'noon', 'midday'],
    evening: ['evening', 'sunset', 'dusk', 'twilight'],
    night: ['night', 'midnight', 'moonlight', 'stars']
  };
  let timeOfDay = prev.timeOfDay || 'afternoon';
  let bestTime = -1;
  Object.entries(times).forEach(([k, words]) => {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestTime) { bestTime = score; timeOfDay = k; }
  });

  // Weather
  const weathers = {
    sunny: ['sunny', 'bright', 'warm', 'clear'],
    rainy: ['rain', 'storm', 'umbrella', 'drizzle'],
    cloudy: ['cloudy', 'overcast', 'grey'],
    foggy: ['fog', 'mist', 'haze']
  };
  let atmosphere = prev.atmosphere || 'sunny';
  let bestWx = -1;
  Object.entries(weathers).forEach(([k, words]) => {
    const score = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    if (score > bestWx) { bestWx = score; atmosphere = k; }
  });

  return {
    mood,
    location,
    atmosphere,
    timeOfDay,
    confidence: {
      mood: Math.max(0, bestMoodScore),
      location: Math.max(0, bestLocScore),
      time: Math.max(0, bestTime),
      weather: Math.max(0, bestWx)
    }
  };
}

// Deterministic pseudo-random generator seeded by string (so a city renders consistently)
function seededRandom(seedStr = '') {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => {
    // xorshift32
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; // eslint-disable-line no-param-reassign
    // Convert to [0,1)
    return ((seed >>> 0) % 1_000_000) / 1_000_000;
  };
}

function skyGradientByTime(timeOfDay = 'afternoon') {
  switch (timeOfDay) {
    case 'morning':
      return ['#FFE29F', '#FFA99F']; // soft sunrise
    case 'evening':
      return ['#FDB99B', '#CF8BF3']; // warm dusk
    case 'night':
      return ['#0f172a', '#1e293b']; // deep night blues
    case 'afternoon':
    default:
      return ['#80d0ff', '#4098ff']; // bright sky
  }
}

function buildingColor(timeOfDay = 'afternoon') {
  switch (timeOfDay) {
    case 'night': return '#0b1220';
    case 'evening': return '#2d2a3f';
    case 'morning': return '#2b3a55';
    default: return '#2a3b5f';
  }
}

function windowOnColor(timeOfDay = 'night') {
  return timeOfDay === 'night' ? '#ffd166' : '#bcd7ff';
}

// Generate a stylized skyline SVG as a data URL
function generateCitySvgDataUrl(city = 'City', context = { timeOfDay: 'afternoon', atmosphere: 'sunny' }) {
  const width = 1600; const height = 900;
  const rng = seededRandom(city + ':' + (context?.timeOfDay || 'afternoon'));
  const [c1, c2] = skyGradientByTime(context?.timeOfDay);
  const bColor = buildingColor(context?.timeOfDay);
  const wOn = windowOnColor(context?.timeOfDay);
  const hasRain = context?.atmosphere === 'rainy';
  const isNight = context?.timeOfDay === 'night';

  // Create N buildings with varying widths/heights
  const n = 24;
  const margin = 20;
  let x = margin;
  const groundY = Math.round(height * 0.78);
  const buildings = [];
  for (let i = 0; i < n && x < width - margin; i++) {
    const w = Math.max(30, Math.round(40 + rng() * 90));
    const h = Math.round(150 + rng() * 400);
    buildings.push({ x, w, y: groundY - h, h });
    x += w + Math.round(8 + rng() * 22);
  }

  // Windows per building (grid)
  function windowsFor(b) {
    const cell = 16; const pad = 8;
    const cols = Math.floor((b.w - pad * 2) / cell);
    const rows = Math.floor((b.h - pad * 2) / cell);
    const rects = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Randomly decide if lit (more at night)
        const lit = rng() < (isNight ? 0.35 : 0.12);
        if (!lit) continue;
        const x = b.x + pad + c * cell + 3;
        const y = b.y + pad + r * cell + 3;
        rects.push(`<rect x="${x}" y="${y}" width="10" height="10" rx="2" ry="2" fill="${wOn}" opacity="${isNight ? 0.95 : 0.6}" />`);
      }
    }
    return rects.join('');
  }

  // Sun/Moon
  const orb = isNight
    ? `<circle cx="${Math.round(width * 0.82)}" cy="${Math.round(height * 0.18)}" r="42" fill="#f8fafc" opacity="0.8" />`
    : `<circle cx="${Math.round(width * 0.82)}" cy="${Math.round(height * 0.2)}" r="46" fill="#ffe066" opacity="0.9" />`;

  // Stars for night
  let stars = '';
  if (isNight) {
    const k = 120;
    for (let i = 0; i < k; i++) {
      const sx = Math.round(rng() * width);
      const sy = Math.round(rng() * Math.round(height * 0.6));
      const sr = (rng() * 1.5 + 0.2).toFixed(2);
      const op = (0.5 + rng() * 0.5).toFixed(2);
      stars += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#e2e8f0" opacity="${op}" />`;
    }
  }

  // Rain lines
  let rain = '';
  if (hasRain) {
    const drops = 220;
    for (let i = 0; i < drops; i++) {
      const rx = Math.round(rng() * width);
      const ry = Math.round(rng() * height);
      const len = Math.round(12 + rng() * 24);
      rain += `<line x1="${rx}" y1="${ry}" x2="${rx + 6}" y2="${ry + len}" stroke="rgba(255,255,255,0.35)" stroke-width="1" />`;
    }
  }

  // Build SVG
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <!-- Sky -->
    <rect x="0" y="0" width="${width}" height="${height}" fill="url(#sky)" />
    ${stars}
    ${orb}
    <!-- Buildings -->
    ${buildings.map(b => `
      <g>
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${bColor}" opacity="0.95" />
        ${windowsFor(b)}
      </g>
    `).join('')}
    <!-- Ground shadow strip -->
    <rect x="0" y="${groundY}" width="${width}" height="${height - groundY}" fill="rgba(0,0,0,0.25)" />
    ${rain}
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function StoryBackground({ city, context }) {
  const bgImage = useMemo(() => city ? generateCitySvgDataUrl(city, context) : null, [city, context]);
  // Fade-in on mount and when city changes (plot page mounts after summary appears)
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(false);
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [city]);

  // Subtle gradient by mood/time
  const gradientByMood = (m, t) => {
    const g = {
      happy: {
        morning: 'linear-gradient(135deg, rgba(255,224,102,0.35), rgba(255,107,149,0.25))',
        afternoon: 'linear-gradient(135deg, rgba(255,167,38,0.35), rgba(233,30,99,0.25))',
        evening: 'linear-gradient(135deg, rgba(255,138,101,0.35), rgba(216,67,21,0.25))',
        night: 'linear-gradient(135deg, rgba(171,71,188,0.35), rgba(74,20,140,0.25))'
      },
      mysterious: {
        night: 'linear-gradient(135deg, rgba(55,71,79,0.5), rgba(0,0,0,0.4))'
      },
      adventurous: {
        afternoon: 'linear-gradient(135deg, rgba(66,165,245,0.35), rgba(13,71,161,0.2))'
      },
      peaceful: {
        morning: 'linear-gradient(135deg, rgba(232,245,232,0.35), rgba(165,214,167,0.2))',
        night: 'linear-gradient(135deg, rgba(232,234,246,0.35), rgba(159,168,218,0.2))'
      }
    };
    return (g[m] && g[m][t]) || 'linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.15))';
  };

  const overlay = gradientByMood(context?.mood || 'peaceful', context?.timeOfDay || 'afternoon');

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 500ms ease'
      }}
    >
      {/* Generated city SVG layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: bgImage ? `url(${bgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: context?.timeOfDay === 'night' ? 'brightness(0.7)' : 'none',
          transform: 'scale(1.10)',
          transformOrigin: 'center center'
        }}
      />
      {/* Mood overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: overlay
        }}
      />
    </div>
  );
}

export default StoryBackground;
