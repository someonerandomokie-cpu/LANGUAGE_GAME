import React, { useEffect, useState, useRef } from 'react';

// LangVoyage — merged single-file React prototype with improved avatar UI

// Expanded languages (15)
const LANGUAGES = ['Spanish','French','Chinese','Russian','Italian','Arabic','Japanese','Korean','Portuguese','German','Hindi','Turkish','Dutch','Swedish','Polish'];
const AVAILABLE_GENRES = ['Romance', 'Adventure', 'Mystery', 'Comedy', 'Drama', 'Sci-Fi'];

// Avatar categories: added Lip Shape (before Face Shape) and Nose Shape (after Eye Color)
const AVATAR_CATEGORIES = {
  Gender: ['Female', 'Male'],
  'Eye Shape': ['Almond', 'Round', 'Hooded', 'Monolid'],
  'Eye Color': ['Brown', 'Blue', 'Green', 'Hazel', 'Grey'],
  'Nose Shape': ['Button', 'Roman', 'Greek', 'Snub', 'Aquiline'],
  'Lip Shape': ['Full', 'Thin', 'Heart', 'Bow', 'Downturned'],
  'Face Shape': ['Oval', 'Round', 'Square', 'Heart', 'Diamond'],
  'Hair Style': ['Long waves', 'Bun', 'Curly bob', 'Ponytail', 'Pixie'],
  'Hair Color': ['Black', 'Brown', 'Blonde', 'Red', 'Silver', 'Pastel'],
  'Skin Tone': ['Very light', 'Light', 'Medium', 'Tan', 'Dark']
};

const PERSONALITY_TRAITS = ['Brave', 'Curious', 'Shy', 'Charming', 'Ambitious', 'Kind', 'Sarcastic', 'Dreamy', 'Confident', 'Calm'];
const HOBBIES = ['Photography', 'Cooking', 'Drawing', 'Dancing', 'Hiking', 'Music', 'Coding', 'Reading', 'Gardening', 'Sports'];

// Helper: confetti
function Confetti() {
  const pieces = Array.from({ length: 80 });
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
      {pieces.map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 8,
            height: 14,
            background: `hsl(${Math.random() * 360}deg, 70%, 60%)`,
            opacity: 0.9,
            transform: `rotate(${Math.random() * 360}deg)`
          }}
        />
      ))}
    </div>
  );
}

function useSpeech() {
  const speak = (text) => {
    try {
      if (!window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { console.warn('TTS failed', e); }
  };
  return { speak };
}

export default function App() {
  // Core state (merged)
  const [avatar, setAvatar] = useState({
    id: 'user_001',
    name: '',
    gender: 'Female',
    appearance: {},
    clothes: {},
    traits: [],
    hobbies: [],
    style: 'Casual' // kept in state but UI removed per request
  });

  const [selectedCategory, setSelectedCategory] = useState('Gender');
  // genres state now used as the *current* selection while editing; per-language genres are saved in episodes[lang].genres
  const [genres, setGenres] = useState([]);
  const [language, setLanguage] = useState(null);
  const [plotSummary, setPlotSummary] = useState('');
  // episodes will now track per-language progress including genres and started flag
  const [episodes, setEpisodes] = useState({});
  const [screen, setScreen] = useState('opening'); // opening | avatar | traits | genre | language | plot | home | animation | lesson | quiz | dialogue | story
  const [stats, setStats] = useState({ streak: 0, points: 0, wordsLearned: 0 });
  const [currentEpisode, setCurrentEpisode] = useState(null);

  // Avatar edit mode flag: when true, avatar Continue returns to home instead of proceeding to traits
  const [avatarEditMode, setAvatarEditMode] = useState(false);

  // Track if genres were just completed before language selection (to avoid double-show on first play)
  const [justCompletedGenres, setJustCompletedGenres] = useState(false);

  // Lesson / Quiz state
  const [buddyName, setBuddyName] = useState('');
  const [vocabPack, setVocabPack] = useState([]);
  const [quizItems, setQuizItems] = useState([]);
  const [quizResults, setQuizResults] = useState([]); // whether a question has been answered correct (ever)
  const [firstTryResults, setFirstTryResults] = useState([]); // track first-try correctness (true/false/null)
  const [showConfetti, setShowConfetti] = useState(false);
  const [storyDialogues, setStoryDialogues] = useState([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [translatePopup, setTranslatePopup] = useState({ visible: false, text: '' });
  const [practiceState, setPracticeState] = useState(null); // { targetWord, options: [], correctIndex, nextIndex }
  const [plotGenerating, setPlotGenerating] = useState(false);
  const [plotTimer, setPlotTimer] = useState(0);
  const [plotState, setPlotState] = useState({ tone: 'neutral', decisions: [] });

  const tts = useSpeech();
  const animationTimerRef = useRef(null);
  const plotTimerRef = useRef(null);

  useEffect(() => {
    console.log('App mounted');
    return () => {
      console.log('App unmounted');
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  // Auto-play TTS for dialogue lines when index changes
  useEffect(() => {
    const dlg = storyDialogues[dialogueIndex];
    if (dlg && tts && typeof tts.speak === 'function' && !practiceState) {
      try { tts.speak(`${dlg.speaker}: ${dlg.text}`); } catch (e) { console.warn('TTS failed for dialogue', e); }
    }
  }, [dialogueIndex, storyDialogues]);

  // Hide translate popup after 5 seconds automatically
  useEffect(() => {
    if (!translatePopup.visible) return;
    const id = setTimeout(() => setTranslatePopup({ visible: false, text: '' }), 5000);
    return () => clearTimeout(id);
  }, [translatePopup.visible]);

  function normalizeSpeakerName(name) {
    return (name || '').trim().toLowerCase();
  }

  function isUserSpeaker(dlg) {
    const n = normalizeSpeakerName(dlg?.speaker);
    const user = normalizeSpeakerName(avatar?.name || '');
    return n && (n === user || n === 'you' || n === 'player' || n === 'protagonist');
  }

  function createFallbackChoices(idx) {
    // Provide at least three generic reaction choices that affect plot tone and branch lightly
    return [
      { text: 'Respond warmly', effect: { tone: 'friendly' }, nextDelta: 1 },
      { text: 'Stay neutral', effect: { tone: 'neutral' }, nextDelta: 1 },
      { text: 'Be bold', effect: { tone: 'bold' }, nextDelta: 2 }
    ];
  }

  function applyChoiceEffect(effect) {
    if (!effect) return;
    setPlotState(prev => {
      const nextTone = effect.tone || prev.tone;
      const decisions = [...(prev.decisions || []), { at: dialogueIndex, effect }];
      return { ...prev, tone: nextTone, decisions };
    });
  }

  function padDialoguesForEpisode(dialogues, lang, userName, buddy) {
    const result = Array.isArray(dialogues) ? dialogues.slice() : [];
    let i = 0;
    // Simple padding to ensure at least 100 pages
    while (result.length < 100) {
      const speaker = i % 2 === 0 ? (buddy || 'Buddy') : (userName || 'You');
      const text = i % 2 === 0 
        ? '...'
        : '...';
      result.push({ speaker, text, isFinalLine: false });
      i++;
    }
    // ensure final page is flagged
    if (result.length > 0) {
      result.forEach((d, idx) => { d.isFinalLine = idx === result.length - 1; });
    }
    return result;
  }

  // Auto-generate plot when reaching plot screen for the first time
  useEffect(() => {
    if (screen === 'plot' && !plotSummary) {
      handleGenerateNewStory();
    }
  }, [screen]);

  // Utility: find vocab entry for a word (matches either target word or meaning)
  function findVocabForToken(token) {
    if (!vocabPack || vocabPack.length === 0) return null;
    const lower = token.toLowerCase();
    return vocabPack.find(v => (v.word && v.word.toLowerCase() === lower) || (v.meaning && v.meaning.toLowerCase() === lower));
  }

  // Utility: create React nodes with underlined vocab tokens. Matches vocabPack words and meanings with word boundaries.
  function highlightVocab(text) {
    if (!vocabPack || vocabPack.length === 0) return text;
    // Build regex from vocab words ONLY (not English meanings) - sort by length descending to match longer phrases first
    const tokens = [];
    vocabPack.forEach(v => {
      if (v.word) tokens.push(escapeRegExp(v.word));
    });
    if (tokens.length === 0) return text;
    
    // Sort by length descending to match longer phrases first (e.g., "por favor" before "por")
    tokens.sort((a, b) => b.length - a.length);
    
    // Use word boundaries (\b) for English words; for non-English use lookahead/behind or space/punctuation boundaries
    const re = new RegExp(`\\b(${tokens.join('|')})\\b`, 'gi');
    const parts = [];
    let lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const idx = m.index;
      if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
      const match = m[0];
      const vocab = findVocabForToken(match);
      parts.push(
        <span key={`${idx}-${match}`} style={{ textDecoration: 'underline', cursor: 'pointer', color: '#0b5fff' }} onClick={(e) => { e.stopPropagation(); if (vocab) setTranslatePopup({ visible: true, text: vocab.meaning || vocab.word }); else setTranslatePopup({ visible: true, text: match }); }}>
          {match}
        </span>
      );
      lastIndex = idx + match.length;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ----- Avatar helpers -----
  function handleAppearanceChange(category, option) {
    setAvatar(prev => ({ ...prev, appearance: { ...prev.appearance, [category]: option } }));
  }
  function toggleTrait(tr) {
    setAvatar(prev => ({ ...prev, traits: prev.traits.includes(tr) ? prev.traits.filter(x => x !== tr) : [...prev.traits, tr] }));
  }
  function toggleHobby(h) {
    setAvatar(prev => ({ ...prev, hobbies: prev.hobbies.includes(h) ? prev.hobbies.filter(x => x !== h) : [...prev.hobbies, h] }));
  }

  // ----- avatar finish -----
  function handleAvatarSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!avatar.name.trim()) return alert('Please enter your avatar name');
    console.log('Avatar created:', avatar);
    // If the avatar was opened from editing on the main page, return to main page.
    if (avatarEditMode) {
      setAvatarEditMode(false);
      setScreen('home');
      return;
    }
    // Otherwise go to traits/hobbies page (they should be on next page)
    setScreen('traits');
  }

  // ----- Genres -----
  function toggleGenre(genreChoice) {
    setGenres(prev => {
      const has = prev.includes(genreChoice);
      if (has) return prev.filter(g => g !== genreChoice);
      if (prev.length < 3) return [...prev, genreChoice];
      return prev;
    });
  }
  function confirmGenres() {
    if (genres.length === 0) return alert('Pick at least one genre');

    // If language is set AND we're here because user chose genres for that language, go to plot
    if (language) {
      // persist selected genres into episodes[language] so home can show selected genres per language
      setEpisodes(prev => {
        const existing = prev[language] || { unlocked: [1], completed: [], started: false, genres: [] };
        return { ...prev, [language]: { ...existing, genres: genres } };
      });
      setPlotSummary(''); // Clear plot so AI generates a new one
      setScreen('plot');
      return;
    }

    // If language not yet selected (typical initial flow), we move to language selection
    // but remember that genres were just completed so selecting a language won't show genres again
    setJustCompletedGenres(true);
    setScreen('language');
  }

  // ----- Language & Plot -----
  function selectLanguage(lang) {
    console.log('Language selected:', lang);

    // If we arrived here immediately after the initial genre selection (justCompletedGenres),
    // use the genres the user already picked and go straight to the plot page — avoid showing genres twice.
    if (justCompletedGenres) {
      setLanguage(lang);
      setEpisodes(prev => {
        if (prev[lang]) return prev;
        // create a placeholder entry for this language
        return { ...prev, [lang]: { unlocked: [1], completed: [], started: false, genres: genres } };
      });
      // Use the current genres (picked before language selection) to generate the plot
      setPlotSummary(''); // Clear plot so AI generates a new one
      setJustCompletedGenres(false);
      setScreen('plot');
      return;
    }

    // Normal selection flow:
    // If this language already has been started, switch directly to it and go home (skip plot/genres)
    const langData = episodes[lang];
    if (langData && langData.started) {
      setLanguage(lang);
      // ensure current genres are the ones for this language for consistent display
      setGenres(langData.genres || []);
      setScreen('home');
      return;
    }

    // If language exists but not started, load its saved genres (or empty) and show genres selection first
    setLanguage(lang);
    setEpisodes(prev => {
      if (prev[lang]) return prev;
      // create a placeholder entry for this language
      return { ...prev, [lang]: { unlocked: [1], completed: [], started: false, genres: [] } };
    });

    // If we have saved genres for this language, prefill them and show plot
    const existing = episodes[lang];
    if (existing && existing.genres && existing.genres.length) {
      setGenres(existing.genres);
      // go directly to plot if genres already set (but not started) — user may want to re-check plot
      setPlotSummary(''); // Clear plot so AI generates a new one
      setScreen('plot');
    } else {
      // Ask for genres first (normal flow when switching languages later)
      setGenres([]); // reset current genre selection for the new language
      setScreen('genres');
    }
  }

  // --- Embedded AI (local) generator: creates a unique story rather than just summarizing inputs.
  function aiGenerateStory({ lang, genresList = [], avatarData, buddy, hobbies = [], traits = [], plotState: ps = { tone: 'neutral', decisions: [] } }) {
    // Simple deterministic-ish pseudo-AI writer using templates and seeded randomness
  let seed = (genresList.join('|') + '::' + (hobbies || []).join('|') + '::' + (avatarData.name || '')).split('').reduce((s,c)=>s+ c.charCodeAt(0), 0);
  const rand = (n=1) => { seed = (seed * 9301 + 49297) % 233280; return Math.abs(seed / 233280) * n; };
    // Use stronger, handcrafted prose mixing in user choices
  const tone = (ps && ps.tone) || 'neutral';
  const toneAdj = tone === 'friendly' ? 'warm' : tone === 'bold' ? 'electric' : 'steady';
  const opening = `On a ${toneAdj} morning in a ${lang}-speaking port, ${avatarData.name || 'you'} steps off a rattling tram, pockets full of hope and an old ticket to a life that might be waiting.`;
    const mid = `Drawn into a ${genresList.length ? genresList.join(' and ') : 'quiet'} arc, ${avatarData.name || 'you'} meets ${buddy}, a local with a knack for ${hobbies && hobbies.length ? hobbies[0].toLowerCase() : 'small kindnesses'}. Together they chase a thread: a missing letter, a secret gallery, a late-night recipe, or a constellation of tiny favors that grow into a choice.`;
    const conflict = `The city doesn't give up answers easily. Small betrayals, a mysterious figure who remembers your family name, and a spilled map at a midnight mercado force choices that test honesty, courage and the language you're learning.`;
    const close = `By the time spring arrives, what started as a lesson in words becomes a lesson in belonging.`;
    // Combine and add unique beats using traits to color characters
    const traitBeat = traits && traits.length ? ` Along the way, ${traits.slice(0,2).join(' and ')} decisions steer moments that feel both intimate and large.` : '';
    const recent = (ps && Array.isArray(ps.decisions) ? ps.decisions.slice(-3) : []).map((d,i) => (d?.effect?.tone ? d.effect.tone : 'choice')).join(', ');
    const choiceBeat = recent ? ` Recent choices leaned ${recent}.` : '';
    const full = `${opening} ${mid} ${conflict}${traitBeat}${choiceBeat} ${close}`;
    return full;
  }

  // Optional remote LLM call (OpenAI) — only used if VITE_OPENAI_KEY is set at build/runtime.
  async function remoteGenerateStory({ lang, genresList = [], avatarData, buddy, hobbies = [], traits = [], episodeNum = 1, previousPlot = '', plotState: ps = { tone: 'neutral', decisions: [] } }) {
    try {
      const key = import.meta.env.VITE_OPENAI_KEY || process?.env?.VITE_OPENAI_KEY;
      if (!key) throw new Error('No OpenAI key');
      
  const contextNote = previousPlot ? `\n\nPrevious plot: ${previousPlot}\n\nContinue the story naturally from where it left off, maintaining continuity.` : '';
  const toneHint = ps && ps.tone ? `\n\nTone preference from player choices so far: ${ps.tone}.` : '';
  const decisionsHint = ps && Array.isArray(ps.decisions) && ps.decisions.length ? `\n\nRecent player decisions: ${ps.decisions.slice(-5).map((d,i)=> d?.effect?.tone || 'choice').join(', ')}.` : '';
  const prompt = `Write a SHORT, exciting story plot (1 paragraph, 3-4 sentences MAX) for episode ${episodeNum}.

Main Character: ${avatarData.name || 'The Traveler'}
Setting: ${lang}-speaking location
Genres: ${genresList.join(', ') || 'slice-of-life'}
Personality Traits: ${traits.join(', ') || 'curious'}
Hobbies: ${hobbies.join(', ') || 'exploring'}
Local Friend: ${buddy}${contextNote}${toneHint}${decisionsHint}

Requirements:
- Start with a HOOK that grabs attention immediately
- Focus on ${avatarData.name} experiencing adventure and interacting with ${buddy}
- Include ONE specific conflict or mystery
- Make it emotional and immersive
- NO mentions of teaching, lessons, or language learning
- End with suspense
- MUST be 1 paragraph, 3-4 sentences total`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ 
          model: 'gpt-4o-mini', 
          messages: [{ role: 'user', content: prompt }], 
          max_tokens: 200,
          temperature: 0.8
        })
      });
      if (!res.ok) throw new Error('LLM call failed');
      const data = await res.json();
      const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || data.choices?.[0]?.text || '';
      return txt.trim();
    } catch (e) {
      console.warn('Remote LLM failed, falling back to local generator', e);
    return aiGenerateStory({ lang, genresList, avatarData, buddy, hobbies, traits, plotState: ps });
    }
  }

  // AI-generate dialogues from the plot summary
  async function remoteGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp = [], plotState: ps = { tone: 'neutral', decisions: [] } }) {
    try {
      const key = import.meta.env.VITE_OPENAI_KEY || process?.env?.VITE_OPENAI_KEY;
      if (!key) throw new Error('No OpenAI key');
      
      const vocabList = vp.map(v => `${v.word} (${v.meaning})`).join(', ');
  const prompt = `Based on this story plot, create exactly 100 lines of natural dialogue that tell the story progressively.

Plot: ${plot}

Main Character: ${avatarData.name}
Friend: ${buddy}
Setting: ${lang}-speaking location
Vocabulary words to naturally use: ${vocabList}

 Tone preference from player choices so far: ${ps?.tone || 'neutral'}

Requirements:
- Exactly 100 dialogue exchanges
- Alternate between ${avatarData.name}, ${buddy}, and other characters (vendors, locals, strangers)
- Tell the story through conversation - advance the plot with each line
- Make it feel natural, fun, and emotional
- Focus on adventure and interaction - NO teaching or explaining words
- Include moments of discovery, tension, and connection
- The final line should be poignant and set up the next episode

Format each line as:
[Character Name]: [Their dialogue]

Example:
${buddy}: ${avatarData.name}, look at this old map I found.
${avatarData.name}: It shows a place I've never seen before.`;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ 
          model: 'gpt-4o-mini', 
          messages: [{ role: 'user', content: prompt }], 
          max_tokens: 4000,
          temperature: 0.9
        })
      });
      if (!res.ok) throw new Error('LLM dialogue call failed');
      const data = await res.json();
      const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      
      // Parse the response into dialogue objects
      const lines = txt.trim().split('\n').filter(l => l.includes(':')).map(l => l.trim());
      const dialogues = [];
      
      lines.forEach((line, i) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) return;
        const speaker = line.slice(0, colonIdx).trim().replace(/^\d+\.\s*/, ''); // Remove numbering if present
        const text = line.slice(colonIdx + 1).trim();
        
        // Add practice choices every ~20 lines
        const needsPractice = vp.length > 0 && i > 0 && i % 20 === 0 && i < 80;
        const vocabForPractice = needsPractice ? vp[Math.floor(i / 20) % vp.length] : null;
        
        dialogues.push({
          speaker,
          text,
          choices: vocabForPractice ? [
            { text: `Respond using "${vocabForPractice.word}"`, practiceWord: vocabForPractice.word, nextDelta: 1 },
            { text: 'Continue without practice', nextDelta: 1 }
          ] : null,
          isFinalLine: i === lines.length - 1,
          setting: i === lines.length - 1 ? 'The moment hangs in the air, charged with possibility.' : undefined
        });
      });
      
      return dialogues.length > 0 ? dialogues : aiGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp });
    } catch (e) {
      console.warn('Remote dialogue generation failed, using local fallback', e);
      return aiGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp });
    }
  }

  function aiGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp = [] }) {
    // Produce 100 dialogue lines that expand the generated plot into character voices.
    const aName = avatarData.name || 'Traveler';
    const bName = buddy || 'Buddy';
    const locals = ['Vendor', 'Old Friend', 'Mysterious Caller', 'Shop Owner', 'Street Musician', 'Guide', 'Child', 'Elder', 'Tourist', 'Artist'];
    const dialogues = [];
    
    // Opening sequence with practice
    const firstVocab = vp && vp.length ? vp[0] : null;
    dialogues.push({ speaker: bName, text: `Hey ${aName}, did you see the mural by the harbor? There's a symbol there that looks like your family crest.` });
    dialogues.push({ speaker: aName, text: `I thought I recognized something... I can't read the name on it, but it feels familiar.`, choices: firstVocab ? [
      { text: `Respond using the word "${firstVocab.word}"`, practiceWord: firstVocab.word, nextDelta: 1 },
      { text: `Say: "I don't know yet."`, nextDelta: 2 }
    ] : null });
    
    // Build out 100 dialogue lines with varied speakers and moments
    const vocabWords = vp.map(v => v.word).filter(Boolean);
    const storyBeats = [
      `You two shouldn't be asking about that. Some things are better left buried.`,
      `Don't listen to them. Come with me — there's a friend who can translate old letters.`,
      `Alright. If this leads to a clue about my past, I'm ready.`,
      `The map shows a place I've never heard of. Have you?`,
      `My family told stories about this neighborhood. I never thought I'd see it.`,
      `There's an old library near the square. Maybe we'll find records there.`,
      `Wait—someone's following us. Let's take a different route.`,
      `This street smells like cinnamon and rain. It reminds me of home.`,
      `Look at that door. The symbol matches the one from the harbor.`,
      `Should we knock? Or is this too dangerous?`,
      `I hear voices inside. They're speaking quickly—I can't catch everything.`,
      `The door opens. An elder appears, eyes narrowing at us.`,
      `They recognize your name. How is that possible?`,
      `Come inside, quickly. We don't have much time.`,
      `The room is filled with old photographs and maps.`,
      `This photo... it looks like my grandmother.`,
      `She was part of a network that helped travelers decades ago.`,
      `Your family has history here. More than you know.`,
      `There's a letter addressed to you. It's been waiting twenty years.`,
      `I'm afraid to open it. What if it changes everything?`,
      `Sometimes the truth is harder than the mystery. But you deserve to know.`,
      `The letter speaks of a hidden place, a meeting point for old friends.`,
      `We should go there tonight. Before anyone else finds out.`,
      `I trust you. Let's do this together.`,
      `The night market is loud and bright. We blend into the crowd.`,
      `A musician plays a song I know. My mother used to hum it.`,
      `Do you remember the tune? It's beautiful.`,
      `I remember it from a dream. Or maybe a memory.`,
      `We're close now. The meeting place is just beyond the fountain.`,
      `There's a small door under the bridge. Almost hidden.`,
      `Should we really go in? This feels like crossing a line.`,
      `We've come this far. I need to see what's inside.`,
      `The door creaks open. A narrow staircase leads down.`,
      `It's dark. I'll light the way with my phone.`,
      `The walls are covered in writing. Names, dates, messages.`,
      `Look—your family name is here, carved into the stone.`,
      `This place is a sanctuary. A refuge for those who needed it.`,
      `I feel connected to something bigger than myself.`,
      `Footsteps above. Someone else is coming.`,
      `Hide. We don't know who it is.`,
      `It's the elder from before. They followed us.`,
      `Don't be afraid. I came to help you understand.`,
      `This place holds the memories of many who came before you.`,
      `Your ancestors protected this space. And now it's your turn.`,
      `What do you mean, my turn?`,
      `There's a choice to make. To carry forward the legacy, or to walk away.`,
      `I never asked for this responsibility.`,
      `No one does. But it finds those who are ready.`,
      `I need time to think. This is overwhelming.`,
      `Take your time. But know that the world outside is changing fast.`,
      `We leave the hidden place and walk back through the market.`,
      `The city feels different now. Like I'm seeing it with new eyes.`,
      `Do you regret coming here? Learning all of this?`,
      `I don't know yet. But I'm glad I'm not alone.`,
      `We stop at a small café. The owner greets us warmly.`,
      `They seem to know who you are, even without introductions.`,
      `Word travels fast in this neighborhood.`,
      `What will you do next?`,
      `I think I'll stay a while. There's more to learn here.`,
      `And maybe more to uncover about my own past.`,
      `I'll help you. Whatever you need.`,
      `Thank you. That means more than you know.`,
      `The café owner brings us tea and a small pastry.`,
      `This tastes like something my grandmother used to make.`,
      `Recipes carry memory. Like language, like songs.`,
      `I want to learn more. About the food, the stories, everything.`,
      `Then let's start now. There's a cooking class tomorrow morning.`,
      `I'll be there. It feels right to dive in.`,
      `The evening fades into night. The streets glow with lanterns.`,
      `This city is alive. I can feel it breathing.`,
      `It's strange to think I almost didn't come here.`,
      `Some journeys choose us as much as we choose them.`,
      `We walk past the harbor again. The mural is lit by moonlight.`,
      `It looks different now. Like it's telling a fuller story.`,
      `Because now you know your place in it.`,
      `I wonder what my ancestors would think of me being here.`,
      `I think they'd be proud. You're honoring their path.`,
      `There's a festival next week. Will you still be here?`,
      `I plan to be. I want to see it through.`,
      `Good. Festivals are when the city truly comes alive.`,
      `A street vendor offers us roasted chestnuts. The smell is intoxicating.`,
      `Simple moments like this—they're what I'll remember most.`,
      `We find a bench near the water and sit in comfortable silence.`,
      `The waves lap gently against the stone. Rhythmic, calming.`,
      `I've been running from my past for so long. Maybe it's time to stop.`,
      `Sometimes standing still is the bravest thing you can do.`,
      `I think I'm ready. Ready to embrace this.`,
      `Then tomorrow, we begin the next chapter.`,
      `A boat passes by, its lights reflecting on the dark water.`,
      `Do you ever wonder where all these people are going?`,
      `Everyone has a story. A reason for being here.`,
      `And now I have mine too.`,
      `The night deepens. The city hums with life.`,
      `I'm grateful for this moment. For meeting you, for all of it.`,
      `The feeling is mutual. This journey has changed me too.`,
      `We should head back. Tomorrow will come quickly.`,
      `One more minute. I want to hold onto this feeling.`,
      `The stars above are faint, barely visible through the city glow.`,
      `But they're there. Constant, even when we can't see them clearly.`,
      `Like the threads that connect us to our past. Always present.`,
      `We stand and walk slowly back through the winding streets.`,
      `The night air is cool. Refreshing after the warmth of the day.`,
      `I'll see you tomorrow, then. At the cooking class.`
    ];
    
    storyBeats.forEach((line, i) => {
      const speakerIndex = i % (locals.length + 2);
      let speaker;
      if (speakerIndex === 0) speaker = bName;
      else if (speakerIndex === 1) speaker = aName;
      else speaker = locals[(speakerIndex - 2) % locals.length];
      
      // Add practice choice every 20 lines if vocab available
      const needsPractice = vp.length > 0 && i > 0 && i % 20 === 0 && i < 80;
      const vocabForPractice = needsPractice ? vp[Math.floor(i / 20) % vp.length] : null;
      
      dialogues.push({
        speaker,
        text: line,
        choices: vocabForPractice ? [
          { text: `Respond using "${vocabForPractice.word}"`, practiceWord: vocabForPractice.word, nextDelta: 1 },
          { text: 'Continue without practice', nextDelta: 1 }
        ] : null
      });
    });
    
    // Final line with tone/setting only
    dialogues.push({ speaker: aName, text: `Tomorrow. I'm ready.`, isFinalLine: true, setting: 'The streetlights flicker as a soft breeze carries the scent of jasmine through the narrow alley.' });
    
    return dialogues;
  }
  function acceptPlot() {
    if (!language) return alert('No language selected.');
    console.log('User accepted plot for', language, 'genres', genres);

    // mark language as started and save selected genres
    setEpisodes(prev => {
      const langData = prev[language] || { unlocked: [1], completed: [], started: false, genres: [] };
      const updated = { ...langData, started: true, genres: genres.length ? genres : (langData.genres || []) };
      return { ...prev, [language]: updated };
    });

    // We've now entered the main page for this language — clear justCompletedGenres to be safe
    setJustCompletedGenres(false);

    setScreen('home');
  }

  function handleGenerateNewStory() {
    // Regenerate plot only (dialogues are generated after quiz when vocabPack is ready)
    (async () => {
      setPlotGenerating(true);
      setPlotTimer(3);
      
      // Start countdown timer from 3 seconds
      const startTime = Date.now();
      plotTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 3 - elapsed);
        setPlotTimer(remaining);
      }, 100);
      
      const prevPlot = episodes[language]?.generatedPlot || '';
      const epNum = currentEpisode || 1;
      // Generate or reuse buddy name
      const buddy = buddyName || generateBuddyName(language);
      if (!buddyName) setBuddyName(buddy);
      
      const story = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddy, hobbies: avatar.hobbies, traits: avatar.traits, episodeNum: epNum, previousPlot: prevPlot });
      
      // Stop timer
      if (plotTimerRef.current) {
        clearInterval(plotTimerRef.current);
        plotTimerRef.current = null;
      }
      
      setPlotSummary(story);
      setPlotGenerating(false);
      // persist generated plot into episodes (dialogues will be generated later after lesson)
      setEpisodes(prev => {
        const langData = prev[language] || { unlocked: [1], completed: [], started: false, genres: genres };
        return { ...prev, [language]: { ...langData, generatedPlot: story } };
      });
    })();
  }

  // ----- Episode flow -----
  function startEpisode(epNum) {
    if (!language) return alert('Select a language first.');
    console.log('Starting episode', epNum, 'in', language);
    setCurrentEpisode(epNum);
    const buddy = generateBuddyName(language);
    setBuddyName(buddy);
    prepareLesson(language, epNum); // Pass episode number for unique vocab
    setScreen('animation');
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    animationTimerRef.current = setTimeout(() => { console.log('Animation finished — starting lesson'); setScreen('lesson'); }, 150000);
  }
  function finishEpisode(epNum) {
    console.log('Finishing episode', epNum, 'in', language);
    setEpisodes(prev => {
      const langData = prev[language] || { unlocked: [1], completed: [] };
      const completed = Array.from(new Set([...(langData.completed || []), epNum]));
      const unlocked = new Set(langData.unlocked || [1]);
      unlocked.add(epNum + 1);
      return { ...prev, [language]: { ...(langData || {}), unlocked: Array.from(unlocked), completed } };
    });
    setStats(prev => ({ ...prev, points: prev.points + 10 }));
    setCurrentEpisode(null);
    setScreen('home');
  }

  // ----- Buddy & lesson -----
  function generateBuddyName(lang) {
    const namesByLang = { Spanish: ['Lucia', 'Diego', 'Sofia', 'Mateo'], French: ['Claire', 'Luc', 'Amelie', 'Hugo'], Japanese: ['Yuki', 'Ren', 'Aiko', 'Hiro'] };
    const list = namesByLang[lang] || ['Ari'];
    const name = list[Math.floor(Math.random() * list.length)];
    console.log('Generated buddy:', name);
    return name;
  }

  function prepareLesson(lang, episodeNum = 1) {
    console.log('Preparing lesson for', lang, 'episode', episodeNum);
    const BANK = {
      Spanish: [
        // Episode 1 basics
        { word: 'hola', meaning: 'hello', examples: ['Hola, ¿cómo estás?', 'Hola, bienvenido.'], episode: 1 },
        { word: 'gracias', meaning: 'thank you', examples: ['Gracias por todo.', 'Muchas gracias.'], episode: 1 },
        { word: 'por favor', meaning: 'please', examples: ['Pásame la sal, por favor.'], episode: 1 },
        { word: 'sí', meaning: 'yes', examples: ['Sí, claro.'], episode: 1 },
        { word: 'no', meaning: 'no', examples: ['No, gracias.'], episode: 1 },
        // Episode 2
        { word: 'buenos días', meaning: 'good morning', examples: ['Buenos días, ¿cómo dormiste?'], episode: 2 },
        { word: 'adiós', meaning: 'goodbye', examples: ['Adiós, hasta luego.'], episode: 2 },
        { word: 'perdón', meaning: 'sorry/excuse me', examples: ['Perdón, no te escuché.'], episode: 2 },
        { word: '¿cómo estás?', meaning: 'how are you?', examples: ['¿Cómo estás hoy?'], episode: 2 },
        { word: 'bien', meaning: 'well/good', examples: ['Estoy bien, gracias.'], episode: 2 },
        // Episode 3+
        { word: 'la calle', meaning: 'the street', examples: ['Vivo en esta calle.'], episode: 3 },
        { word: 'el mercado', meaning: 'the market', examples: ['Vamos al mercado.'], episode: 3 },
        { word: 'agua', meaning: 'water', examples: ['Necesito agua, por favor.'], episode: 3 },
        { word: 'comida', meaning: 'food', examples: ['La comida está deliciosa.'], episode: 3 },
        { word: 'ayuda', meaning: 'help', examples: ['¿Me puedes ayudar?'], episode: 3 },
        { word: 'amigo', meaning: 'friend', examples: ['Él es mi amigo.'], episode: 4 },
        { word: 'casa', meaning: 'house/home', examples: ['Mi casa está cerca.'], episode: 4 },
        { word: 'tiempo', meaning: 'time/weather', examples: ['No tengo tiempo.'], episode: 4 },
        { word: 'dinero', meaning: 'money', examples: ['¿Cuánto dinero cuesta?'], episode: 4 },
        { word: 'trabajo', meaning: 'work/job', examples: ['Voy al trabajo.'], episode: 4 }
      ],
      French: [
        { word: 'bonjour', meaning: 'hello', examples: ['Bonjour, comment ça va?'], episode: 1 },
        { word: 'merci', meaning: 'thank you', examples: ['Merci beaucoup.'], episode: 1 },
        { word: "s'il vous plaît", meaning: 'please', examples: ["S'il vous plaît, donnez-moi ça."], episode: 1 },
        { word: 'oui', meaning: 'yes', examples: ['Oui, bien sûr.'], episode: 1 },
        { word: 'non', meaning: 'no', examples: ['Non, merci.'], episode: 1 },
        { word: 'au revoir', meaning: 'goodbye', examples: ['Au revoir, à bientôt.'], episode: 2 },
        { word: 'pardon', meaning: 'sorry/excuse me', examples: ['Pardon, excusez-moi.'], episode: 2 },
        { word: 'comment allez-vous', meaning: 'how are you', examples: ['Comment allez-vous?'], episode: 2 },
        { word: 'bien', meaning: 'well', examples: ['Je vais bien.'], episode: 2 },
        { word: 'mal', meaning: 'bad', examples: ['Je me sens mal.'], episode: 2 },
        { word: 'la rue', meaning: 'the street', examples: ['Cette rue est belle.'], episode: 3 },
        { word: 'le marché', meaning: 'the market', examples: ['Allons au marché.'], episode: 3 },
        { word: "l'eau", meaning: 'water', examples: ["J'ai besoin d'eau."], episode: 3 },
        { word: 'la nourriture', meaning: 'food', examples: ['La nourriture est délicieuse.'], episode: 3 },
        { word: "l'aide", meaning: 'help', examples: ['Pouvez-vous m\'aider?'], episode: 3 },
        { word: "l'ami", meaning: 'friend', examples: ['C\'est mon ami.'], episode: 4 },
        { word: 'la maison', meaning: 'house/home', examples: ['Ma maison est près d\'ici.'], episode: 4 },
        { word: 'le temps', meaning: 'time/weather', examples: ['Je n\'ai pas le temps.'], episode: 4 },
        { word: "l'argent", meaning: 'money', examples: ['Combien d\'argent?'], episode: 4 },
        { word: 'le travail', meaning: 'work/job', examples: ['Je vais au travail.'], episode: 4 }
      ],
      Japanese: [
        { word: 'こんにちは', meaning: 'hello', examples: ['こんにちは、元気ですか？'], episode: 1 },
        { word: 'ありがとう', meaning: 'thank you', examples: ['ありがとうございます。'], episode: 1 },
        { word: 'お願いします', meaning: 'please', examples: ['お願いします。'], episode: 1 },
        { word: 'はい', meaning: 'yes', examples: ['はい、わかりました。'], episode: 1 },
        { word: 'いいえ', meaning: 'no', examples: ['いいえ、違います。'], episode: 1 },
        { word: 'さようなら', meaning: 'goodbye', examples: ['さようなら、また会いましょう。'], episode: 2 },
        { word: 'すみません', meaning: 'excuse me/sorry', examples: ['すみません、わかりません。'], episode: 2 },
        { word: 'おはよう', meaning: 'good morning', examples: ['おはようございます。'], episode: 2 },
        { word: 'おやすみ', meaning: 'good night', examples: ['おやすみなさい。'], episode: 2 },
        { word: '元気', meaning: 'fine/healthy', examples: ['元気です。'], episode: 2 },
        { word: '道', meaning: 'street/road', examples: ['この道を行ってください。'], episode: 3 },
        { word: '市場', meaning: 'market', examples: ['市場に行きましょう。'], episode: 3 },
        { word: '水', meaning: 'water', examples: ['水をください。'], episode: 3 },
        { word: '食べ物', meaning: 'food', examples: ['食べ物が美味しいです。'], episode: 3 },
        { word: '助け', meaning: 'help', examples: ['助けてください。'], episode: 3 },
        { word: '友達', meaning: 'friend', examples: ['彼は私の友達です。'], episode: 4 },
        { word: '家', meaning: 'house/home', examples: ['私の家は近いです。'], episode: 4 },
        { word: '時間', meaning: 'time', examples: ['時間がありません。'], episode: 4 },
        { word: 'お金', meaning: 'money', examples: ['いくらですか？'], episode: 4 },
        { word: '仕事', meaning: 'work/job', examples: ['仕事に行きます。'], episode: 4 }
      ]
    };

    const pool = BANK[lang] || BANK['Spanish'];
    // Select vocab for this specific episode - 5 words starting from episode offset
    const startIdx = ((episodeNum - 1) * 5) % pool.length;
    const pack = [];
    for (let i = 0; i < 5; i++) {
      pack.push(pool[(startIdx + i) % pool.length]);
    }
    
    setVocabPack(pack);

    const q = pack.map((v, idx) => {
      const distractors = pool.filter(x => x.meaning !== v.meaning).slice(0, 3).map(d => d.meaning);
      const choices = [v.meaning, ...distractors].sort(() => Math.random() - 0.5).map(text => ({ text, correct: text === v.meaning }));
      return { id: `q_${idx}`, prompt: `What does \"${v.word}\" mean?`, choices, userAnswerIndex: null };
    });
    setQuizItems(q); setQuizResults(Array(q.length).fill(null)); setFirstTryResults(Array(q.length).fill(null));
  }

  // ----- Quiz handling -----
  function submitAnswer(qIndex, choiceIndex) {
    setQuizItems(prev => { const next = prev.slice(); next[qIndex] = { ...next[qIndex], userAnswerIndex: choiceIndex }; return next; });
    const item = quizItems[qIndex];
    if (!item) { console.warn('Quiz item not ready'); return; }
    const choice = item.choices[choiceIndex]; if (!choice) return;

    // determine if this is the first attempt for this question
    const firstAttempt = (item.userAnswerIndex === null || item.userAnswerIndex === undefined);

    if (choice.correct) {
      setQuizResults(prev => { const n = prev.slice(); n[qIndex] = true; return n; });
      if (firstAttempt) {
        setFirstTryResults(prev => { const n = prev.slice(); n[qIndex] = true; return n; });
      }
      tts.speak('Good job!');
      setStats(prev => ({ ...prev, points: prev.points + (quizResults[qIndex] ? 0 : 10) }));
    } else {
      setQuizResults(prev => { const n = prev.slice(); n[qIndex] = false; return n; });
      if (firstAttempt) {
        setFirstTryResults(prev => { const n = prev.slice(); n[qIndex] = false; return n; });
      }
      tts.speak('Try again');
    }
  }

  function computeFirstTryScore() {
    const arr = firstTryResults;
    if (!arr || arr.length === 0) return 0;
    const correct = arr.filter(x => x === true).length;
    return Math.round((correct / arr.length) * 100);
  }

  function finishPractice() {
    // This function now used on quiz screen to finalize and check first-try percent.
    const pct = computeFirstTryScore();
    console.log('Practice finished — first-try score', pct);
    if (pct >= 80) {
      setShowConfetti(true);
      tts.speak('Congratulations! You passed the practice.');
      setTimeout(() => setShowConfetti(false), 3000);
      setTimeout(() => setScreen('story'), 1000);
    } else {
      // lock out proceeding — only show retake option on quiz screen
      alert(`Score ${pct}%. You must score at least 80% on first try to continue. Please retake.`);
      // prepare for retake: reset userAnswerIndex for those not first-try-correct
      setQuizItems(prev => prev.map((q, i) => ({ ...q, userAnswerIndex: null })));
      setQuizResults(prev => prev.map((r, i) => (firstTryResults[i] === true ? true : null)));
    }
  }

  function retakeQuiz() {
    // clear user answers and quizResults, also reset firstTryResults to restart completely
    setQuizItems(prev => prev.map(q => ({ ...q, userAnswerIndex: null })));
    setQuizResults(Array(quizItems.length).fill(null));
    setFirstTryResults(Array(quizItems.length).fill(null));
  }

  function renderStoryScene() {
    const english = `You arrive at the bustling market. A friendly local greets you and asks if you need help.`;
    let transformed = english;
    vocabPack.forEach(v => {
      const englishKey = v.meaning.split(' ')[0];
      try { transformed = transformed.replace(new RegExp(englishKey, 'i'), v.word); } catch (e) {}
    });
    return transformed;
  }

  // ----- Render screens with improved aesthetics for avatar / traits -----
  if (screen === 'avatar') {
    return (
      <div style={styles.container}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
        `}</style>
        <h1 style={styles.title}>Design Your Avatar</h1>
        <form onSubmit={handleAvatarSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input value={avatar.name} onChange={(e) => setAvatar(a => ({ ...a, name: e.target.value }))} placeholder="Enter a name" style={styles.input} />

          <div style={styles.avatarLayout}>
            <div style={styles.categoryPanel}>
              {Object.keys(AVATAR_CATEGORIES).map(cat => (
                <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                  style={{ ...styles.categoryButton, background: selectedCategory === cat ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'rgba(255, 255, 255, 0.2)' }}>
                  {cat}
                </button>
              ))}
            </div>

            <div style={styles.optionPanel}>
              {AVATAR_CATEGORIES[selectedCategory].map(option => (
                <button key={option} type="button" onClick={() => handleAppearanceChange(selectedCategory, option)}
                  style={{ ...styles.optionButton, background: avatar.appearance[selectedCategory] === option ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 'rgba(255, 255, 255, 0.2)' }}>
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* STYLE UI removed per request (kept state) */}

          {/* Traits & Hobbies removed from avatar page — they appear on the next screen */}

          <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ ...styles.continueButton, marginTop: 0 }}>Continue →</button>
          </div>
        </form>
      </div>
    );
  }

  if (screen === 'opening') {
    return (
      <div style={styles.container} onClick={() => { /* keep clicks inert here */ }}>
        <h1 style={styles.title}>Welcome to LangVoyage</h1>
        <p style={{ maxWidth: 760, textAlign: 'center', color: 'white', fontSize: '1.1rem', lineHeight: 1.6 }}>A language-learning story engine. Create an avatar, pick genres, and embark on interactive episodes that teach language through narrative and dialogue.</p>
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setScreen('avatar')} style={{ ...styles.continueButton }}>Begin →</button>
        </div>
      </div>
    );
  }

  if (screen === 'traits') {
    // separate trait screen — personality and hobbies only here
    return (
      <div style={styles.container}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
        `}</style>
        <h1 style={styles.title}>Choose Personality & Hobbies</h1>
        <div style={styles.traitLayout}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Personality</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERSONALITY_TRAITS.map(t => (
              <button key={t} onClick={() => toggleTrait(t)} style={{ padding: '10px 16px', borderRadius: 15, border: 'none', background: avatar.traits.includes(t) ? 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' : 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={styles.traitLayout}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Hobbies</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HOBBIES.map(h => (
              <button key={h} onClick={() => toggleHobby(h)} style={{ padding: '10px 16px', borderRadius: 15, border: 'none', background: avatar.hobbies.includes(h) ? 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' : 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>{h}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setScreen('genres')} style={{ ...styles.continueButton, marginTop: 0 }}>Continue →</button>
        </div>
      </div>
    );
  }

  if (screen === 'genres') {
    return (
      <div style={styles.container}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
        `}</style>
        <h1 style={styles.title}>Choose up to 3 genres</h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '800px' }}>
          {AVAILABLE_GENRES.map(g => (
            <button key={g} onClick={() => toggleGenre(g)} style={{ padding: '12px 20px', borderRadius: 15, border: 'none', background: genres.includes(g) ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', backdropFilter: 'blur(10px)' }}>{g}</button>
          ))}
        </div>
        <div style={{ marginTop: 30, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button onClick={confirmGenres} style={styles.continueButton}>Continue →</button>
        </div>
      </div>
    );
  }

  if (screen === 'language') {
    return (
      <div style={styles.container}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
        `}</style>
        <h1 style={styles.title}>Select a language</h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '900px' }}>
          {LANGUAGES.map(l => (
            <button key={l} onClick={() => selectLanguage(l)} style={{ padding: '12px 20px', borderRadius: 15, border: 'none', background: language === l ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', backdropFilter: 'blur(10px)' }}>{l}</button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'plot') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Plot summary</h1>
        {plotGenerating && (
          <p style={{ color: 'white', fontSize: '1.1rem', marginBottom: 20 }}>
            Your story will be generated in <strong>{plotTimer}</strong> seconds...
          </p>
        )}
        {!plotGenerating && plotSummary && <p style={styles.summaryText}>{plotSummary}</p>}
        {!plotGenerating && !plotSummary && <p style={{ color: 'white', fontSize: '1.1rem', marginBottom: 20 }}>Generating your story...</p>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={acceptPlot} disabled={plotGenerating} style={{ ...styles.continueButton, background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', opacity: plotGenerating ? 0.5 : 1, cursor: plotGenerating ? 'not-allowed' : 'pointer' }}>Continue to Story</button>
          <button onClick={handleGenerateNewStory} disabled={plotGenerating} style={{ ...styles.continueButton, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', opacity: plotGenerating ? 0.5 : 1, cursor: plotGenerating ? 'not-allowed' : 'pointer' }}>Generate a New Story</button>
        </div>
      </div>
    );
  }

  if (screen === 'home') {
    const langList = LANGUAGES;
    const currentLang = language || langList[0];
    const currentEpisodes = episodes[currentLang]?.unlocked || [1];

    // Show selected genres for the current language if available, otherwise show the global genres state
    const selectedForLang = episodes[currentLang]?.genres && episodes[currentLang].genres.length ? episodes[currentLang].genres : genres;

    return (
      <div style={styles.container}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, color: 'white' }}>Welcome, {avatar?.name || 'Traveler'}</h2>
            <p style={{ margin: 0, color: 'white' }}>Day Streak: {stats.streak} | Points: {stats.points} | Words Learned: {stats.wordsLearned}</p>
            <p style={{ marginTop: 6, color: 'white' }}>Selected genres: {selectedForLang && selectedForLang.length ? selectedForLang.join(', ') : 'None'}</p>
          </div>
          <div>
            <button onClick={() => { setAvatarEditMode(true); setScreen('avatar'); }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'all 0.3s ease' }}>Edit Avatar</button>
          </div>
        </div>

        <div style={{ marginTop: 30, width: '100%' }}>
          <h3 style={{ color: 'white' }}>Languages</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {langList.map(l => (
              <button key={l} onClick={() => selectLanguage(l)} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: currentLang === l ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'rgba(255, 255, 255, 0.2)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 30, width: '100%' }}>
          <h3 style={{ color: 'white' }}>Episodes ({currentLang})</h3>
          <ul style={{ paddingLeft: 20 }}>
            {currentEpisodes.map(ep => (
              <li key={ep} style={{ marginTop: 8 }}>
                <button onClick={() => startEpisode(ep)} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>Start Episode {ep}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (screen === 'animation') {
    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
        <h2 style={styles.title}>Episode {currentEpisode}</h2>
      </div>
    );
  }

  if (screen === 'lesson') {
    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'rgba(255,255,255,0.3)', color: 'white', padding: '10px 15px', borderRadius: 10, backdropFilter: 'blur(10px)', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
        <h2 style={styles.title}>Welcome to your lesson!</h2>
        <p style={{ color: 'white', fontSize: '1.1rem' }}>Your learning buddy is <strong>{buddyName}</strong> — they will teach you up to 5 new words and grammar.</p>

        <div style={{ marginTop: 12, width: '100%', maxWidth: 720 }}>
          {vocabPack.map((v, i) => (
            <div key={v.word} style={{ padding: 20, borderRadius: 20, background: 'rgba(255, 255, 255, 0.95)', marginBottom: 15, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, color: '#1a1a1a' }}>{v.word} — <span style={{ fontWeight: 400, color: '#666' }}>{v.meaning}</span></div>
                <button 
                  onClick={() => tts.speak(v.word)} 
                  style={{ 
                    padding: '8px 15px', 
                    borderRadius: 10, 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    border: 'none', 
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 600,
                    transition: 'all 0.3s ease'
                  }}
                  title="Pronounce this word"
                >
                  🔊
                </button>
              </div>
              <ul style={{ marginTop: 8, marginLeft: 18, color: '#333' }}>{v.examples.map((ex,j) => <li key={j}>{ex}</li>)}</ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 25 }}>
          <button onClick={() => setScreen('quiz')} style={styles.continueButton}>Continue to Quiz →</button>
        </div>
      </div>
    );
  }

  if (screen === 'quiz') {
    // Quiz screen is separate — implements first-try tracking and retake loop
    const firstTryPct = computeFirstTryScore();
    const passed = firstTryPct >= 80;

    return (
      <div style={{ ...styles.container, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
          }
        `}</style>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'rgba(255,255,255,0.3)', color: 'white', padding: '10px 15px', borderRadius: 10, backdropFilter: 'blur(10px)', cursor: 'pointer', fontWeight: 600 }}>← Back</button>
        <h2 style={styles.title}>Quiz Time!</h2>
        <p style={{ color: 'white', fontSize: '1.2rem', marginBottom: 30 }}>Your score: <strong>{firstTryPct}%</strong></p>

        <div style={{ marginTop: 12, width: '100%', maxWidth: 800, animation: 'fadeIn 1s ease-out 0.2s both' }}>
          {quizItems.map((q, qi) => (
            <div key={q.id} style={{ padding: 30, borderRadius: 25, background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(20px)', marginBottom: 20, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)', border: '1px solid rgba(255, 255, 255, 0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
                <h3 style={{ color: 'white', fontSize: '1.3rem', marginRight: 15, flex: 1 }}>{q.prompt}</h3>
                {quizResults[qi] !== undefined && quizResults[qi] !== null && firstTryResults[qi] !== null && firstTryResults[qi] !== undefined && (
                  <span style={{ fontSize: '1.5rem' }}>
                    {firstTryResults[qi] ? '✅' : '❌'}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {q.choices.map((c, ci) => {
                  const userIdx = q.userAnswerIndex;
                  const result = quizResults[qi];
                  const isSelected = userIdx === ci;
                  const bg = isSelected && result === true 
                    ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' 
                    : isSelected && result === false 
                    ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' 
                    : 'rgba(255, 255, 255, 0.1)';
                  return (
                    <button key={ci} onClick={() => submitAnswer(qi, ci)} style={{ background: bg, padding: 15, borderRadius: 15, border: 'none', textAlign: 'left', color: 'white', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease' }}>{c.text}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 40, animation: 'fadeIn 1s ease-out 0.4s both' }}>
          {!passed && (
            // Per your requirement: when the Retake button appears, show the percentage answered correctly right above it.
            <div style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: 15, color: 'white', fontSize: '1.2rem' }}>You need 80% to continue.</div>
              <button onClick={retakeQuiz} style={{ padding: '15px 30px', borderRadius: 15, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>Retake Quiz</button>
            </div>
          )}

          {passed && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: 20 }}>Congratulations! You scored {Math.round(firstTryPct)}%!</p>
                <button onClick={() => {
                  setShowConfetti(true);
                  tts.speak('Congratulations!');
                  setTimeout(() => setShowConfetti(false), 3000);
                    // Generate dialogues for the story (prefer remote) and move into the dialogue flow rather than a static story page
                    (async () => {
                      const prevPlot = episodes[language]?.generatedPlot || '';
                      const prevPlotState = episodes[language]?.plotState || plotState;
                      const epNum = currentEpisode || 1;
                      const storyText = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddyName, hobbies: avatar.hobbies, traits: avatar.traits, episodeNum: epNum, previousPlot: prevPlot, plotState: prevPlotState });
                      const dialogues = await remoteGenerateDialogues({ plot: storyText, avatarData: avatar, buddy: buddyName, lang: language, vocabPack, plotState: prevPlotState });
                      const padded = padDialoguesForEpisode(dialogues, language, avatar.name, buddyName);
                      setPlotSummary(storyText);
                      setStoryDialogues(padded);
                      setDialogueIndex(0);
                      // persist generated plot+dialogues
                      setEpisodes(prev => {
                        const langData = prev[language] || { unlocked: [1], completed: [], started: true, genres };
                        return { ...prev, [language]: { ...langData, generatedPlot: storyText, generatedDialogues: padded } };
                      });
                      setScreen('dialogue');
                    })();
                }} style={{ padding: '15px 30px', borderRadius: 15, background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>Continue →</button>
              </div>
            )}
        </div>

        {showConfetti && <Confetti />}
      </div>
    );
  }

  if (screen === 'story') {
    const sceneText = renderStoryScene();
    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
        <h2 style={styles.title}>Episode {currentEpisode} — Story</h2>
        <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#F8FAFC', maxWidth: 720 }}>{sceneText}</div>
        <div style={{ marginTop: 16 }}>
          <p><strong>Cliffhanger:</strong> The episode ends with an unexpected call — someone knows more about your past.</p>
          <div style={{ marginTop: 12 }}><button onClick={() => finishEpisode(currentEpisode)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff' }}>Finish Episode</button></div>
        </div>
        {showConfetti && <Confetti />}
      </div>
    );
  }

  if (screen === 'dialogue') {
    const dlg = storyDialogues[dialogueIndex] || null;
    const isLastLine = dlg && dlg.isFinalLine;
    return (
      <div style={{ ...styles.container, justifyContent: 'center' }} onClick={() => {
        // Advance dialogue on background click (not on controls)
        const currentChoices = Array.isArray(dlg?.choices) ? dlg.choices : [];
        const shouldOfferChoices = dlg && !isLastLine && !isUserSpeaker(dlg);
        if (shouldOfferChoices) {
          // Do not advance if the user should select a reply
          return;
        }
        if (dialogueIndex < storyDialogues.length - 1) {
          setDialogueIndex(i => i + 1);
        } else {
          // dialogues finished -> persist that we've shown this episode and go to story page (or finish)
          setEpisodes(prev => {
            const langData = prev[language] || {};
            return { ...prev, [language]: { ...langData, lastSeenDialogueIndex: dialogueIndex, plotState } };
          });
          // On last page, finish episode directly instead of going to story
          if (currentEpisode) {
            finishEpisode(currentEpisode);
          } else {
            setScreen('story');
          }
        }
      }}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: 'white', cursor: 'pointer', fontSize: 14 }}>← Back to Main Page</button>
        <div style={{ maxWidth: 800, width: '100%', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>Episode {currentEpisode || 1}</div>
            <div style={{ fontSize: 14, color: 'white' }}>{dialogueIndex + 1}/{Math.max(1, storyDialogues.length)}</div>
          </div>
          {dlg ? (
            <div style={{ background: '#FFFFFF', color: '#111', padding: 20, borderRadius: 12, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{dlg.speaker}</div>
                  <div style={{ fontSize: 18 }}>{highlightVocab(dlg.text)}</div>
                  {isLastLine && dlg.setting && (
                    <div style={{ marginTop: 12, fontSize: 14, fontStyle: 'italic', color: '#64748B' }}>{dlg.setting}</div>
                  )}
                </div>
              </div>
              {/* Interactive choices area (only when replying to another character) */}
              {!isLastLine && dlg && !isUserSpeaker(dlg) && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(function() {
                    const base = Array.isArray(dlg.choices) ? dlg.choices : [];
                    const finalChoices = base.length >= 3 ? base : createFallbackChoices(dialogueIndex);
                    return finalChoices.map((c, ci) => (
                      <button key={ci} onClick={(e) => {
                        e.stopPropagation();
                        // If it's a practice option, set practiceState
                        if (c.practiceWord) {
                          // create multiple choice options for practice: correct English meaning + 2 English distractors from vocabPack
                          const targetVocab = (vocabPack || []).find(v => v.word === c.practiceWord);
                          if (!targetVocab) return;
                          const correctMeaning = targetVocab.meaning;
                          const distractors = (vocabPack || []).filter(v => v.word !== c.practiceWord && v.meaning !== correctMeaning).slice(0, 2).map(v => v.meaning);
                          const opts = [correctMeaning, ...distractors].sort(() => Math.random() - 0.5);
                          setPracticeState({ targetWord: c.practiceWord, options: opts, correctIndex: opts.indexOf(correctMeaning), nextIndex: (dialogueIndex + (c.nextDelta || 1)) });
                        } else {
                          // apply plot effect if present
                          if (c.effect) applyChoiceEffect(c.effect);
                          // normal choice: just advance nextDelta or 1
                          const delta = c.nextDelta != null ? c.nextDelta : 1;
                          const next = Math.min(storyDialogues.length - 1, dialogueIndex + delta);
                          setDialogueIndex(next);
                        }
                      }} style={{ padding: '10px 12px', borderRadius: 10, background: '#F0F9FF', border: 'none', textAlign: 'left' }}>{c.text}</button>
                    ));
                  })()}
                </div>
              )}
              {/* Practice UI */}
              {practiceState && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: '#FEFCE8' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ marginBottom: 8 }}>Practice: choose the correct translation for <strong>{practiceState.targetWord}</strong></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {practiceState.options.map((opt, oi) => (
                      <button key={oi} onClick={() => {
                        const correct = oi === practiceState.correctIndex;
                        if (correct) {
                          tts.speak('Correct');
                          // advance to nextIndex if provided
                          const next = practiceState.nextIndex != null ? practiceState.nextIndex : Math.min(storyDialogues.length - 1, dialogueIndex + 1);
                          setPracticeState(null);
                          setDialogueIndex(next);
                        } else {
                          tts.speak('Try again');
                        }
                      }} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#FFF' }}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>No dialogues available.</div>
          )}
          {!isLastLine && (
            <div style={{ marginTop: 18, color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>Click anywhere to continue</div>
          )}
          {/* Translation popup */}
          {translatePopup.visible && (
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1F2937', color: '#FFF', padding: '12px 20px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 9999 }}>
              {translatePopup.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: { 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    padding: 32, 
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
    minHeight: '100vh', 
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif', 
    color: 'white' 
  },
  title: { 
    fontSize: '2.5rem', 
    fontWeight: 'bold', 
    marginBottom: 40, 
    color: 'white', 
    textAlign: 'center',
    animation: 'fadeIn 1s ease-out',
    textShadow: '0 2px 10px rgba(0,0,0,0.2)'
  },
  subTitle: { 
    fontSize: '1.3rem', 
    fontWeight: 600, 
    marginBottom: 8, 
    color: 'white' 
  },
  input: { 
    padding: 15, 
    borderRadius: 15, 
    border: 'none', 
    width: '60%', 
    marginBottom: 20, 
    textAlign: 'center', 
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    fontSize: '1rem',
    fontWeight: '600'
  },
  avatarLayout: { 
    display: 'flex', 
    width: '90%', 
    gap: 20, 
    background: 'rgba(255, 255, 255, 0.1)', 
    backdropFilter: 'blur(20px)',
    borderRadius: 25, 
    padding: 40, 
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.18)'
  },
  categoryPanel: { 
    display: 'flex', 
    flexDirection: 'column', 
    width: '26%', 
    gap: 10 
  },
  categoryButton: { 
    border: 'none', 
    padding: '12px 16px', 
    borderRadius: 15, 
    cursor: 'pointer', 
    fontSize: 15, 
    transition: 'all 0.3s ease', 
    fontWeight: 600, 
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  optionPanel: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: '74%', 
    gap: 12 
  },
  categoryButtonSmall: { 
    padding: '8px 10px', 
    borderRadius: 10 
  },
  optionButton: { 
    border: 'none', 
    padding: '10px 14px', 
    borderRadius: 15, 
    cursor: 'pointer', 
    fontSize: 15, 
    transition: 'all 0.3s ease', 
    fontWeight: 600, 
    background: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  traitLayout: { 
    display: 'flex', 
    width: '90%', 
    gap: 20, 
    marginBottom: 30, 
    background: 'rgba(255, 255, 255, 0.1)', 
    backdropFilter: 'blur(20px)',
    borderRadius: 25, 
    padding: 40, 
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.18)'
  },
  continueButton: { 
    marginTop: 24, 
    padding: '15px 30px', 
    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
    color: 'white', 
    border: 'none', 
    borderRadius: 15, 
    cursor: 'pointer', 
    fontSize: '1rem', 
    fontWeight: 700, 
    transition: 'all 0.3s ease', 
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
    textTransform: 'none'
  },
  summaryText: { 
    fontSize: '1.1rem', 
    maxWidth: 760, 
    textAlign: 'center', 
    lineHeight: 1.6, 
    marginBottom: 20,
    color: 'white' 
  },
};

