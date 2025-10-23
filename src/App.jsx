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
  // Opening screen -> avatar -> traits -> genre -> language -> plot -> home -> animation -> lesson -> quiz -> story
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
  const [lastDialogueMode, setLastDialogueMode] = useState(false);

  const tts = useSpeech();
  const animationTimerRef = useRef(null);

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

  // Utility: find vocab entry for a word (matches either target word or meaning)
  function findVocabForToken(token) {
    if (!vocabPack || vocabPack.length === 0) return null;
    const lower = token.toLowerCase();
    return vocabPack.find(v => (v.word && v.word.toLowerCase() === lower) || (v.meaning && v.meaning.toLowerCase() === lower));
  }

  // Utility: create React nodes with underlined vocab tokens. Matches vocabPack words and meanings.
  function highlightVocab(text) {
    if (!vocabPack || vocabPack.length === 0) return text;
    // build regex from vocab words and meanings (escape)
    const tokens = [];
    vocabPack.forEach(v => {
      if (v.word) tokens.push(escapeRegExp(v.word));
      if (v.meaning) tokens.push(escapeRegExp(v.meaning));
    });
    if (tokens.length === 0) return text;
    const re = new RegExp(`(${tokens.join('|')})`, 'gi');
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
      generatePlotSummary(language, genres);
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
      generatePlotSummary(lang, genres);
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
      generatePlotSummary(lang, existing.genres);
      setScreen('plot');
    } else {
      // Ask for genres first (normal flow when switching languages later)
      setGenres([]); // reset current genre selection for the new language
      setScreen('genres');
    }
  }
  function generatePlotSummary(lang, genresList) {
    const g = genresList && genresList.length ? genresList.join(', ') : 'slice-of-life';
    const summary = `Plot preview — Genre(s): ${g}. You arrive in a ${lang}-speaking city to pursue a ${g} story: unexpected friendships, small conflicts, and cinematic moments that teach you ${lang}. Do you want to start this plot?`;
    console.log('Generated plot summary:', summary);
    setPlotSummary(summary);
  }

  // --- Embedded AI (local) generator: creates a unique story rather than just summarizing inputs.
  function aiGenerateStory({ lang, genresList = [], avatarData, buddy, hobbies = [], traits = [] }) {
    // Simple deterministic-ish pseudo-AI writer using templates and seeded randomness
  let seed = (genresList.join('|') + '::' + (hobbies || []).join('|') + '::' + (avatarData.name || '')).split('').reduce((s,c)=>s+ c.charCodeAt(0), 0);
  const rand = (n=1) => { seed = (seed * 9301 + 49297) % 233280; return Math.abs(seed / 233280) * n; };
    // Use stronger, handcrafted prose mixing in user choices
    const opening = `On a humid morning in a ${lang}-speaking port, ${avatarData.name || 'you'} steps off a rattling tram, pockets full of hope and an old ticket to a life that might be waiting.`;
    const mid = `Drawn into a ${genresList.length ? genresList.join(' and ') : 'quiet'} arc, ${avatarData.name || 'you'} meets ${buddy}, a local with a knack for ${hobbies && hobbies.length ? hobbies[0].toLowerCase() : 'small kindnesses'}. Together they chase a thread: a missing letter, a secret gallery, a late-night recipe, or a constellation of tiny favors that grow into a choice.`;
    const conflict = `The city doesn't give up answers easily. Small betrayals, a mysterious figure who remembers your family name, and a spilled map at a midnight mercado force choices that test honesty, courage and the language you're learning.`;
    const close = `By the time spring arrives, what started as a lesson in words becomes a lesson in belonging.`;
    // Combine and add unique beats using traits to color characters
    const traitBeat = traits && traits.length ? ` Along the way, ${traits.slice(0,2).join(' and ')} decisions steer moments that feel both intimate and large.` : '';
    const full = `${opening} ${mid} ${conflict}${traitBeat} ${close}`;
    return full;
  }

  // Optional remote LLM call (OpenAI) — only used if VITE_OPENAI_KEY is set at build/runtime.
  async function remoteGenerateStory({ lang, genresList = [], avatarData, buddy, hobbies = [], traits = [] }) {
    try {
      const key = import.meta.env.VITE_OPENAI_KEY || process?.env?.VITE_OPENAI_KEY;
      if (!key) throw new Error('No OpenAI key');
      const prompt = `Write a unique short story opening in English for a language-learning app. Language:${lang} Genres:${genresList.join(', ')} Avatar:${avatarData.name} Traits:${traits.join(', ')} Hobbies:${hobbies.join(', ')} Buddy:${buddy}. Keep it vivid and original, about 3-5 sentences.`;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
      });
      if (!res.ok) throw new Error('LLM call failed');
      const data = await res.json();
      const txt = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || data.choices?.[0]?.text || '';
      return txt.trim();
    } catch (e) {
      console.warn('Remote LLM failed, falling back to local generator', e);
      return aiGenerateStory({ lang, genresList, avatarData, buddy, hobbies, traits });
    }
  }

  function aiGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp = [] }) {
    // Produce 100 dialogue entries with occasional interactive choices using vocabPack
    const aName = avatarData.name || 'Traveler';
    const bName = buddy || 'Buddy';
    const locals = ['Vendor', 'Old Friend', 'Mysterious Caller', 'Passerby', 'Neighbour'];
    const dialogues = [];
    // seed for deterministic variation
    let seed = (plot || '').split('').reduce((s,c)=>s + c.charCodeAt(0), 0) + (aName.length || 0);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

    const templates = {
      open: [`${bName}: Have you seen the mural by the harbor?`, `${aName}: The city smells like rain and coffee this morning.`],
      smalltalk: [`${locals[0]}: The market is louder than usual.`, `${bName}: I like the way the light hits the canal at noon.`, `${aName}: I keep misplacing my map.`],
      hint: [`${bName}: There's someone who remembers old names.`, `${locals[1]}: Your face looks familiar, have we met?`],
      threat: [`${locals[2]}: Some questions stir trouble.`, `${locals[3]}: Best to mind your own business.`],
      resolve: [`${bName}: Let's check the ledger at the cafe.`, `${aName}: Okay, but quietly.`]
    };

    for (let i = 0; i < 100; i++) {
      const p = rnd();
      let text;
      if (i < 2) text = templates.open[i] || `${bName}: Hello.`;
      else if (p < 0.25) text = templates.smalltalk[Math.floor(rnd() * templates.smalltalk.length)];
      else if (p < 0.5) text = templates.hint[Math.floor(rnd() * templates.hint.length)];
      else if (p < 0.8) text = templates.threat[Math.floor(rnd() * templates.threat.length)];
      else text = templates.resolve[Math.floor(rnd() * templates.resolve.length)];

      // Occasionally insert a vocab word into the text to highlight learning
      if (vp && vp.length && rnd() > 0.6) {
        const v = vp[Math.floor(rnd() * vp.length)];
        // Insert the foreign word into the line naturally
        text = text.replace(/\.$/, '');
        text = `${text} — ${v.word}.`;
      }

      // Some entries include interactive choices (approx 12% of entries)
      let choices = null;
      if (rnd() > 0.88) {
        // create either a practice choice (if vp available) or simple branching
        if (vp && vp.length && rnd() > 0.4) {
          const v = vp[Math.floor(rnd() * vp.length)];
          choices = [
            { text: `Respond using "${v.word}"`, practiceWord: v.word, nextDelta: 1 },
            { text: `Say: I need more time.`, nextDelta: 2 }
          ];
        } else {
          choices = [
            { text: `Agree`, nextDelta: 1 },
            { text: `Decline`, nextDelta: 1 }
          ];
        }
      }

      // Alternate speakers
      const speaker = i % 3 === 0 ? bName : i % 3 === 1 ? aName : locals[i % locals.length];
      // Normalize text so it doesn't duplicate speaker
      const cleaned = text.replace(new RegExp(`^${speaker}:\s*`), '');
      dialogues.push({ speaker, text: cleaned, choices });
    }

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
  function regeneratePlot() {
    const shuffled = genres.slice().sort(() => Math.random() - 0.5).slice(0, genres.length || 1);
    generatePlotSummary(language, shuffled);
  }

  function handleGenerateNewStory() {
    // Prefer remote LLM if available, otherwise local generator. Persist result into episodes[language].
    (async () => {
      const story = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddyName, hobbies: avatar.hobbies, traits: avatar.traits });
      const dialogues = aiGenerateDialogues({ plot: story, avatarData: avatar, buddy: buddyName, lang: language, vocabPack });
      setPlotSummary(story);
      setStoryDialogues(dialogues);
      setDialogueIndex(0);
      // persist generated plot and dialogues into episodes
      setEpisodes(prev => {
        const langData = prev[language] || { unlocked: [1], completed: [], started: false, genres: genres };
        return { ...prev, [language]: { ...langData, generatedPlot: story, generatedDialogues: dialogues } };
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
    prepareLesson(language);
    setScreen('animation');
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    animationTimerRef.current = setTimeout(() => { console.log('Animation finished — starting lesson'); setScreen('lesson'); }, 1500);
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

  function prepareLesson(lang) {
    console.log('Preparing lesson for', lang);
    const BANK = {
      Spanish: [
        { word: 'hola', meaning: 'hello', examples: ['Hola, ¿cómo estás?', 'Hola, bienvenido.'] },
        { word: 'gracias', meaning: 'thank you', examples: ['Gracias por todo.', 'Muchas gracias.'] },
        { word: 'por favor', meaning: 'please', examples: ['Pásame la sal, por favor.'] },
        { word: 'sí', meaning: 'yes', examples: ['Sí, claro.'] },
        { word: 'no', meaning: 'no', examples: ['No, gracias.'] }
      ],
      French: [
        { word: 'bonjour', meaning: 'hello', examples: ['Bonjour, comment ça va?', 'Bonjour!'] },
        { word: 'merci', meaning: 'thank you', examples: ['Merci beaucoup.', 'Merci!'] },
        { word: "s'il vous plaît", meaning: 'please', examples: ["S'il vous plaît, donnez-moi ça."] },
        { word: 'oui', meaning: 'yes', examples: ['Oui, bien sûr.'] },
        { word: 'non', meaning: 'no', examples: ['Non, merci.'] }
      ],
      Japanese: [
        { word: 'こんにちは', meaning: 'hello (konnichiwa)', examples: ['こんにちは、元気ですか？'] },
        { word: 'ありがとう', meaning: 'thank you (arigatou)', examples: ['ありがとうございます。'] },
        { word: 'お願いします', meaning: 'please', examples: ['お願いします。'] },
        { word: 'はい', meaning: 'yes', examples: ['はい、わかりました。'] },
        { word: 'いいえ', meaning: 'no', examples: ['いいえ、違います。'] }
      ]
    };

    const pool = BANK[lang] || BANK['Spanish'];
    const pack = pool.slice(0, 5);
    setVocabPack(pack); setVocabPack(pack); setVocabPack(pack); // defensive repeats don't harm state

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
    // clear user answers and quizResults except keep firstTryResults so user sees which were wrong on first try
    setQuizItems(prev => prev.map(q => ({ ...q, userAnswerIndex: null })));
    setQuizResults(Array(quizItems.length).fill(null));
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
        <h1 style={styles.title}>Design Your Avatar</h1>
        <form onSubmit={handleAvatarSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input
            type="text"
            value={avatar.name}
            onChange={e => setAvatar(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter your avatar's name"
            style={styles.input}
          />

          <div style={styles.avatarLayout}>
            <div style={styles.categoryPanel}>
              {Object.keys(AVATAR_CATEGORIES).map(cat => (
                <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                  style={{ ...styles.categoryButton, backgroundColor: selectedCategory === cat ? '#7ED957' : '#C7F9CC' }}>
                  {cat}
                </button>
              ))}
            </div>

            <div style={styles.optionPanel}>
              {AVATAR_CATEGORIES[selectedCategory].map(option => (
                <button key={option} type="button" onClick={() => handleAppearanceChange(selectedCategory, option)}
                  style={{ ...styles.optionButton, backgroundColor: avatar.appearance[selectedCategory] === option ? '#57CC99' : '#E9F5E9' }}>
                  {option}
                </button>
              ))}
            </div>
          </div>

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
        <p style={{ maxWidth: 760, textAlign: 'center', color: '#334155' }}>A language-learning story engine. Create an avatar, pick genres, and embark on interactive episodes that teach language through narrative and dialogue.</p>
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
        <h1 style={styles.title}>Choose Personality & Hobbies</h1>
        <div style={styles.traitLayout}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Personality</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERSONALITY_TRAITS.map(t => (
              <button key={t} onClick={() => toggleTrait(t)} style={{ padding: '8px 12px', borderRadius: 12, border: 'none', background: avatar.traits.includes(t) ? '#F8BBD0' : '#FFF0F5' }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={styles.traitLayout}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Hobbies</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HOBBIES.map(h => (
              <button key={h} onClick={() => toggleHobby(h)} style={{ padding: '8px 12px', borderRadius: 12, border: 'none', background: avatar.hobbies.includes(h) ? '#FFD580' : '#FFF8E7' }}>{h}</button>
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
        <h1 style={styles.title}>Choose up to 3 genres</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {AVAILABLE_GENRES.map(g => (
            <button key={g} onClick={() => toggleGenre(g)} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: genres.includes(g) ? '#FFD1A9' : '#FFF3E0' }}>{g}</button>
          ))}
        </div>
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={confirmGenres} style={{ ...styles.continueButton, marginTop: 0 }}>Continue →</button>
        </div>
      </div>
    );
  }

  if (screen === 'language') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Select a language</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {LANGUAGES.map(l => (
            <button key={l} onClick={() => selectLanguage(l)} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: language === l ? '#BFEAD4' : '#F0FFF4' }}>{l}</button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'plot') {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Plot summary</h1>
        <p style={styles.summaryText}>{plotSummary}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={acceptPlot} style={{ ...styles.continueButton, backgroundColor: '#4CAF50' }}>Continue to Story</button>
          <button onClick={handleGenerateNewStory} style={{ padding: '12px 20px', borderRadius: 12, background: '#EEE', border: 'none' }}>Generate a New Story</button>
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
            <h2 style={{ margin: 0 }}>Welcome, {avatar?.name || 'Traveler'}</h2>
            <p style={{ margin: 0 }}>Day Streak: {stats.streak} | Points: {stats.points} | Words Learned: {stats.wordsLearned}</p>
            <p style={{ marginTop: 6, color: '#666' }}>Selected genres: {selectedForLang && selectedForLang.length ? selectedForLang.join(', ') : 'None'}</p>
          </div>
          <div>
            <button onClick={() => { setAvatarEditMode(true); setScreen('avatar'); }} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#E8F0FF' }}>Edit Avatar</button>
          </div>
        </div>

        <div style={{ marginTop: 18, width: '100%' }}>
          <h3>Languages</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {langList.map(l => (
              <button key={l} onClick={() => selectLanguage(l)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: currentLang === l ? '#FFF2B2' : '#FFF9E6' }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 18, width: '100%' }}>
          <h3>Episodes ({currentLang})</h3>
          <ul style={{ paddingLeft: 20 }}>
            {currentEpisodes.map(ep => (
              <li key={ep} style={{ marginTop: 8 }}>
                <button onClick={() => startEpisode(ep)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#9BE7FF', color: '#003049' }}>Start Episode {ep}</button>
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
        <h2 style={styles.title}>Episode {currentEpisode} — Opening Animation</h2>
        <p style={{ maxWidth: 720, textAlign: 'center' }}>(Playing a {genres.join(', ')}-style cinematic in English that shows why you came to this country... This animation is 2–3 minutes long.)</p>
        <p style={{ marginTop: 12 }}>When it ends, you'll meet your learning buddy and start a short lesson.</p>
      </div>
    );
  }

  if (screen === 'lesson') {
    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
        <h2 style={styles.title}>Welcome to your lesson!</h2>
        <p>Your learning buddy is <strong>{buddyName}</strong> — they will teach you up to 5 new words and grammar.</p>

        <div style={{ marginTop: 12, width: '100%', maxWidth: 720 }}>
          {vocabPack.map((v, i) => (
            <div key={v.word} style={{ padding: 12, borderRadius: 12, background: '#fff', marginBottom: 10, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ fontWeight: 700 }}>{v.word} — <span style={{ fontWeight: 400, color: '#666' }}>{v.meaning}</span></div>
              <ul style={{ marginTop: 8, marginLeft: 18 }}>{v.examples.map((ex,j) => <li key={j}>{ex}</li>)}</ul>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={() => setScreen('quiz')} style={{ padding: '10px 16px', borderRadius: 12, background: '#0EA5A4', color: '#fff', border: 'none' }}>Continue to Quiz →</button>
        </div>
      </div>
    );
  }

  if (screen === 'quiz') {
    // Quiz screen is separate — implements first-try tracking and retake loop
    const firstTryPct = computeFirstTryScore();
    const passed = firstTryPct >= 80;

    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
        <h2 style={styles.title}>Quiz — Practice</h2>
        <p>Your score on first try: <strong>{firstTryPct}%</strong></p>

        <div style={{ marginTop: 12, width: '100%', maxWidth: 720 }}>
          {quizItems.map((q, qi) => (
            <div key={q.id} style={{ padding: 12, borderRadius: 12, background: '#fff', marginBottom: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>{q.prompt}</div>
                <div style={{ minWidth: 28 }}>
                  {firstTryResults[qi] === true && <span style={{ color: 'green', fontWeight: 700 }}>✓</span>}
                  {firstTryResults[qi] === false && <span style={{ color: 'red', fontWeight: 700 }}>✗</span>}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {q.choices.map((c, ci) => {
                  const userIdx = q.userAnswerIndex;
                  const result = quizResults[qi];
                  const isSelected = userIdx === ci;
                  const bg = isSelected && result === true ? '#d1fae5' : isSelected && result === false ? '#fecaca' : '#F7F7F8';
                  return (
                    <button key={ci} onClick={() => submitAnswer(qi, ci)} style={{ background: bg, padding: 10, borderRadius: 8, border: 'none', textAlign: 'left' }}>{c.text}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
          {!passed && (
            // Per your requirement: when the Retake button appears, show the percentage answered correctly right above it.
            <div style={{ textAlign: 'right', maxWidth: 360 }}>
              <div style={{ marginBottom: 8, color: '#333' }}>You scored <strong>{firstTryPct}%</strong> on first try — try again to reach 80% or higher.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button onClick={retakeQuiz} style={{ padding: '10px 16px', borderRadius: 12, background: '#F97316', color: '#fff', border: 'none' }}>Retake Quiz</button>
              </div>
            </div>
          )}

          {passed && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => {
                  setShowConfetti(true);
                  tts.speak('Congratulations!');
                  setTimeout(() => setShowConfetti(false), 3000);
                    // Generate dialogues for the story (prefer remote) and move into the dialogue flow rather than a static story page
                    (async () => {
                      const storyText = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddyName, hobbies: avatar.hobbies, traits: avatar.traits });
                      const dialogues = aiGenerateDialogues({ plot: storyText, avatarData: avatar, buddy: buddyName, lang: language, vocabPack });
                      setPlotSummary(storyText);
                      setStoryDialogues(dialogues);
                      setDialogueIndex(0);
                      // persist generated plot+dialogues
                      setEpisodes(prev => {
                        const langData = prev[language] || { unlocked: [1], completed: [], started: true, genres };
                        return { ...prev, [language]: { ...langData, generatedPlot: storyText, generatedDialogues: dialogues } };
                      });
                      setTimeout(() => setScreen('dialogue'), 800);
                    })();
                }} style={{ padding: '10px 16px', borderRadius: 12, background: '#10B981', color: '#fff', border: 'none' }}>Continue →</button>
              </div>
            )}
        </div>

        {showConfetti && <Confetti />}
      </div>
    );
  }

  if (screen === 'story') {
    return (
      <div style={styles.container}>
        <button onClick={() => setScreen('home')} style={{ position: 'absolute', left: 20, top: 20, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
        {lastDialogueMode ? (
          <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#F8FAFC', maxWidth: 720 }}>
            {storyDialogues.length ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{storyDialogues[storyDialogues.length - 1].speaker}</div>
                <div style={{ marginTop: 8, fontSize: 18 }}>{highlightVocab(storyDialogues[storyDialogues.length - 1].text)}</div>
                <div style={{ marginTop: 12, color: '#64748B' }}>Quiet, tense— the city holds its breath.</div>
              </>
            ) : null}
            <div style={{ marginTop: 12 }}><button onClick={() => { finishEpisode(currentEpisode); setLastDialogueMode(false); }} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff' }}>Finish Episode</button></div>
          </div>
        ) : (
          <>
            <h2 style={styles.title}>Episode {currentEpisode} — Story</h2>
            <div style={{ marginTop: 12, padding: 16, borderRadius: 12, background: '#F8FAFC', maxWidth: 720 }}>{renderStoryScene()}</div>
            <div style={{ marginTop: 16 }}>
              <p><strong>Cliffhanger:</strong> The episode ends with an unexpected call — someone knows more about your past.</p>
              <div style={{ marginTop: 12 }}><button onClick={() => finishEpisode(currentEpisode)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff' }}>Finish Episode</button></div>
            </div>
          </>
        )}
        {showConfetti && <Confetti />}
      </div>
    );
  }

  if (screen === 'dialogue') {
    const dlg = storyDialogues[dialogueIndex] || null;
    return (
      <div style={{ ...styles.container, justifyContent: 'center' }} onClick={() => {
        // Advance dialogue on background click (not on controls)
        if (dialogueIndex < storyDialogues.length - 1) {
          setDialogueIndex(i => i + 1);
        } else {
          // dialogues finished -> persist that we've shown this episode and go to the main story page
          setEpisodes(prev => {
            const langData = prev[language] || {};
            return { ...prev, [language]: { ...langData, lastSeenDialogueIndex: dialogueIndex } };
          });
          setLastDialogueMode(true);
          setScreen('story');
        }
      }}>
        <div style={{ maxWidth: 800, width: '100%', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setScreen('home')} style={{ position: 'relative', left: 0, border: 'none', background: 'transparent', color: '#1E88E5' }}>← Back to Main Page</button>
              <div style={{ fontSize: 14, color: '#334155' }}>Episode {currentEpisode || 1}</div>
            </div>
            <div style={{ fontSize: 14, color: '#64748B' }}>{dialogueIndex + 1}/{Math.max(1, storyDialogues.length)}</div>
          </div>
          {dlg ? (
            <div style={{ background: '#FFFFFF', padding: 20, borderRadius: 12, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{dlg.speaker}</div>
                  <div style={{ fontSize: 18 }}>{highlightVocab(dlg.text)}</div>
                </div>
                <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); tts.speak(dlg.text); }} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#E0F2FE' }}>🔊 Speak</button>
                  <button onClick={(e) => { e.stopPropagation(); if (dialogueIndex < storyDialogues.length - 1) setDialogueIndex(i => i + 1); else setScreen('story'); }} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#DEF7EC' }}>Next</button>
                  <button onClick={(e) => { e.stopPropagation(); setDialogueIndex(storyDialogues.length - 1); }} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: '#FFF1F2' }}>Skip</button>
                </div>
              </div>
              {/* Interactive choices area (if present) */}
              {dlg.choices && Array.isArray(dlg.choices) && dlg.choices.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dlg.choices.map((c, ci) => (
                    <button key={ci} onClick={(e) => {
                      e.stopPropagation();
                      // If it's a practice option, set practiceState
                      if (c.practiceWord) {
                        // create multiple choice options for practice: show English meanings (translations)
                        const correct = c.practiceWord;
                        const correctEntry = (vocabPack || []).find(v => v.word === correct) || null;
                        const correctMeaning = correctEntry ? correctEntry.meaning : correct;
                        const distractors = (vocabPack || []).filter(v => v.word !== correct).slice(0, 2).map(v => v.meaning || v.word);
                        const opts = [correctMeaning, ...distractors].sort(() => Math.random() - 0.5);
                        setPracticeState({ targetWord: correct, options: opts, correctIndex: opts.indexOf(correctMeaning), nextIndex: (dialogueIndex + (c.nextDelta || 1)) });
                      } else {
                        // normal choice: just advance nextDelta or 1
                        const delta = c.nextDelta || 1;
                        const next = Math.min(storyDialogues.length - 1, dialogueIndex + delta);
                        setDialogueIndex(next);
                      }
                    }} style={{ padding: '10px 12px', borderRadius: 10, background: '#F0F9FF', border: 'none', textAlign: 'left' }}>{c.text}</button>
                  ))}
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
          <div style={{ marginTop: 18, color: '#94A3B8', fontSize: 14 }}>Click anywhere to continue</div>
        </div>
      </div>
    );
  }

  return null;
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32, background: 'linear-gradient(to bottom right, #F0FBF6, #E6F7FF)', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif', color: '#0F172A' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 16, color: '#052662' },
  subTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#334155' },
  input: { padding: 12, borderRadius: 12, border: '1px solid #D1D5DB', width: '60%', marginBottom: 20, textAlign: 'center', boxShadow: '0 4px 12px rgba(2,6,23,0.06)', outline: 'none', fontSize: 16 },
  avatarLayout: { display: 'flex', width: '90%', gap: 20, background: '#FFFFFF', borderRadius: 18, padding: 20, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' },
  categoryPanel: { display: 'flex', flexDirection: 'column', width: '26%', gap: 10 },
  categoryButton: { border: 'none', padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 15, transition: 'all 0.18s ease-in-out', fontWeight: 600, boxShadow: '0 4px 8px rgba(2,6,23,0.06)', '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 12px rgba(2,6,23,0.1)' } },
  optionPanel: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '74%', gap: 12 },
  categoryButtonSmall: { padding: '8px 10px', borderRadius: 10 },
  optionButton: { border: 'none', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 15, transition: 'all 0.18s ease-in-out', fontWeight: 600, boxShadow: '0 4px 10px rgba(2,6,23,0.04)', '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 6px 14px rgba(2,6,23,0.08)' } },
  traitLayout: { display: 'flex', width: '90%', gap: 20, marginBottom: 30, background: '#FFFFFF', borderRadius: 18, padding: 16, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' },
  continueButton: { 
    marginTop: 24, 
    padding: '12px 26px', 
    backgroundColor: '#1E90FF', 
    color: '#fff', 
    border: 'none', 
    borderRadius: 16, 
    cursor: 'pointer', 
    fontSize: 16, 
    fontWeight: 700, 
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 6px 16px rgba(30,144,255,0.18)',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 20px rgba(30,144,255,0.25)',
      backgroundColor: '#1A7FE5'
    },
    '&:active': {
      transform: 'translateY(0)',
      boxShadow: '0 4px 12px rgba(30,144,255,0.15)'
    }
  },
  summaryText: { fontSize: 16, maxWidth: 760, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 },
  smallButton: { 
    padding: '8px 14px', 
    borderRadius: 10, 
    border: 'none', 
    background: '#F3F4F6', 
    color: '#374151', 
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      background: '#E5E7EB',
      transform: 'translateY(-1px)'
    }
  },
  dialogueBox: {
    padding: 16,
    borderRadius: 12,
    background: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
    marginBottom: 16
  }
};

