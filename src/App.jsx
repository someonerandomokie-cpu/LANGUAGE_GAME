import React, { useEffect, useState, useRef } from 'react';

// LangVoyage — merged single-file React prototype with improved avatar UI

// Expanded languages (15)
const LANGUAGES = ['Spanish','French','Chinese','Russian','Italian','Arabic','Japanese','Korean','Portuguese','German','Hindi','Turkish','Dutch','Swedish','Polish'];
const AVAILABLE_GENRES = ['Romance', 'Adventure', 'Mystery', 'Comedy', 'Drama', 'Sci-Fi'];

// Map language to a representative country and city to ground plots/conflicts
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
// Personality and hobbies options (used on traits screen)
const PERSONALITY_TRAITS = ['Curious', 'Brave', 'Kind', 'Adventurous', 'Calm', 'Funny', 'Creative', 'Honest', 'Optimistic'];
const HOBBIES = ['Cooking', 'Music', 'Art', 'Travel', 'Reading', 'Sports', 'Photography', 'Gardening', 'Gaming'];

// Lightweight speech synthesis helper (lesson-only TTS)
function useSpeech() {
  const speak = (text) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || !text) return;
      const utter = new SpeechSynthesisUtterance(text);
      synth.cancel();
      synth.speak(utter);
    } catch {}
  };
  return { speak };
}

// Minimal confetti placeholder
function Confetti() {
  return <div style={{ position: 'fixed', top: 10, right: 10, fontSize: 24 }}>🎉</div>;
}

export default function App() {
  const [avatar, setAvatar] = useState({ id: 'user_001', name: '', appearance: {}, traits: [], hobbies: [], avatarUrl: '' });
  const rpmIframeRef = useRef(null);
  const [rpmSaving, setRpmSaving] = useState(false);
  const [rpmSaveError, setRpmSaveError] = useState('');
  const [rpmFrameReady, setRpmFrameReady] = useState(false);
  const rpmExportRetryRef = useRef(null);
  const rpmExportAttemptsRef = useRef(0);
  const pendingRpmExportRef = useRef(false);
  const [language, setLanguage] = useState('');
  const [genres, setGenres] = useState([]);
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
  const [lessonPhrases, setLessonPhrases] = useState([]);
  const [quizItems, setQuizItems] = useState([]);
  const [quizResults, setQuizResults] = useState([]); // whether a question has been answered correct (ever)
  const [firstTryResults, setFirstTryResults] = useState([]); // track first-try correctness (true/false/null)
  const [showConfetti, setShowConfetti] = useState(false);
  const [storyDialogues, setStoryDialogues] = useState([]);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [dialogueError, setDialogueError] = useState('');
  const [translatePopup, setTranslatePopup] = useState({ visible: false, text: '' });
  const [practiceState, setPracticeState] = useState(null); // { targetWord, options: [], correctIndex, nextIndex }
  // Prefetch next story/dialogues during quiz to eliminate delay on continue
  const [prefetch, setPrefetch] = useState({ inFlight: false, plot: '', dialogues: [] });

  // Kick off background generation when entering quiz
  useEffect(() => {
    if (screen !== 'quiz') return;
    if (prefetch.inFlight || (prefetch.plot && prefetch.dialogues && prefetch.dialogues.length)) return;
    (async () => {
      try {
        setPrefetch(prev => ({ ...prev, inFlight: true }));
        const prevPlot = episodes[language]?.generatedPlot || '';
        const prevPlotState = episodes[language]?.plotState || plotState;
        const epNum = currentEpisode || 1;
        const storyText = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddyName, hobbies: avatar.hobbies, traits: avatar.traits, episodeNum: epNum, previousPlot: prevPlot, plotState: prevPlotState });
        const dialogues = await remoteGenerateDialogues({ plot: storyText, avatarData: avatar, buddy: buddyName, lang: language, vocabPack, plotState: prevPlotState });
        const padded = padDialoguesForEpisode(dialogues, language, avatar.name, buddyName);
        setPrefetch({ inFlight: false, plot: storyText, dialogues: padded });
      } catch (e) {
        console.warn('Background generation failed', e);
        setPrefetch(prev => ({ ...prev, inFlight: false }));
      }
    })();
  }, [screen]);

  // When on dialogue screen and prefetch finishes, adopt the prefetched content
  useEffect(() => {
    if (screen !== 'dialogue') return;
    if (storyDialogues && storyDialogues.length > 0) return;
    if (prefetch.dialogues && prefetch.dialogues.length) {
      setPlotSummary(prefetch.plot);
      setStoryDialogues(prefetch.dialogues);
      setDialogueIndex(0);
      setEpisodes(prev => {
        const langData = prev[language] || { unlocked: [1], completed: [], started: true, genres };
        return { ...prev, [language]: { ...langData, generatedPlot: prefetch.plot, generatedDialogues: prefetch.dialogues } };
      });
      return;
    }
    // If we reached dialogue screen without prefetched content, fetch on-demand now
    (async () => {
      try {
        setDialogueError('');
        setDialogueLoading(true);
        const prevPlotState = episodes[language]?.plotState || plotState;
        const dlg = await remoteGenerateDialogues({ plot: plotSummary, avatarData: avatar, buddy: buddyName, lang: language, vocabPack, plotState: prevPlotState });
        const padded = padDialoguesForEpisode(dlg, language, avatar.name, buddyName);
        setStoryDialogues(padded);
        setDialogueIndex(0);
        setEpisodes(prev => {
          const langData = prev[language] || { unlocked: [1], completed: [], started: true, genres };
          return { ...prev, [language]: { ...langData, generatedPlot: plotSummary, generatedDialogues: padded } };
        });
      } catch (e) {
        console.warn('On-demand dialogue generation failed', e);
        setDialogueError('Failed to load dialogue. Please try again.');
      } finally {
        setDialogueLoading(false);
      }
    })();
  }, [screen, prefetch.dialogues]);
  const [plotGenerating, setPlotGenerating] = useState(false);
  const [plotTimer, setPlotTimer] = useState(0);
  const [plotError, setPlotError] = useState('');
  const [plotState, setPlotState] = useState({ tone: 'neutral', decisions: [] });
  // Intro video state (animation screen)
  const [introVideoUrl, setIntroVideoUrl] = useState('');
  const [introVideoLoading, setIntroVideoLoading] = useState(false);
  const [introVideoError, setIntroVideoError] = useState('');

  // Best-effort intro video request when entering the animation screen
  async function requestIntroVideo() {
    if (screen !== 'animation') return;
    if (introVideoLoading || introVideoUrl) return;
    if (!avatar?.avatarUrl || !plotSummary) { setIntroVideoError(''); return; }
    try {
      setIntroVideoError('');
      setIntroVideoLoading(true);
      const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      const country = LANGUAGE_COUNTRY[language];
      const city = COUNTRY_CITY[country] || 'the capital';
      const primaryGenre = (genres && genres[0]) || 'Adventure';
      const r = await fetch(`${backend.replace(/\/$/, '')}/api/intro-video`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: language, genre: primaryGenre, city, plot: plotSummary, avatarUrl: avatar.avatarUrl })
      });
      if (r.ok) {
        const data = await r.json();
        if (data && data.videoUrl) {
          setIntroVideoUrl(data.videoUrl);
          // Cancel the 5s fallback timer; we'll switch after the video ends
          if (animationTimerRef.current) { clearTimeout(animationTimerRef.current); animationTimerRef.current = null; }
        } else {
          const reason = (data && (data.reason || data.error)) || 'Intro video not available.';
          setIntroVideoError(typeof reason === 'string' ? reason : 'Intro video not available.');
        }
      } else {
        setIntroVideoError(`Failed to request intro video (status ${r.status}).`);
      }
    } catch (e) {
      console.warn('Intro video generation failed', e);
      setIntroVideoError('Intro video generation failed. Is the server running on the correct port?');
    } finally {
      setIntroVideoLoading(false);
    }
  }

  // Subscribe helper
  function ensureRpmSubscriptions() {
    try {
      const iframe = rpmIframeRef.current;
      const win = iframe && iframe.contentWindow;
      if (!win) return;
      win.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }, '*');
      win.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.export.failed' }, '*');
      // Optionally: win.postMessage({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.*' }, '*');
    } catch {}
  }

  // Trigger Ready Player Me export via Frame API (always callable)
  function requestRpmExport() {
    try {
      const iframe = rpmIframeRef.current;
      const win = iframe && iframe.contentWindow;
      if (!win) return;
      setRpmSaveError('');
      setRpmSaving(true);
      ensureRpmSubscriptions();
      const sendExport = () => {
        try { win.postMessage({ target: 'readyplayerme', type: 'v1.avatar.export' }, '*'); } catch {}
      };
      if (rpmExportRetryRef.current) { clearInterval(rpmExportRetryRef.current); rpmExportRetryRef.current = null; }
      rpmExportAttemptsRef.current = 0;
      sendExport();
      rpmExportRetryRef.current = setInterval(() => {
        if (avatar.avatarUrl) {
          clearInterval(rpmExportRetryRef.current);
          rpmExportRetryRef.current = null;
          return;
        }
        rpmExportAttemptsRef.current += 1;
  if (rpmExportAttemptsRef.current > 25) {
          clearInterval(rpmExportRetryRef.current);
          rpmExportRetryRef.current = null;
          setRpmSaving(false);
          setRpmSaveError('Export timed out. Please press Save again. If it persists, click Next inside the creator once, then Save.');
          return;
        }
        sendExport();
  }, 400);
    } catch (e) {
      // no-op
    }
  }

  useEffect(() => {
    if (screen !== 'animation') return;
    requestIntroVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const tts = useSpeech();
  const animationTimerRef = useRef(null);
  const plotTimerRef = useRef(null);

  useEffect(() => {
    console.log('App mounted');
    // On mount, try to fetch any previously saved avatar for this user
    (async () => {
      try {
        const userId = (avatar && avatar.id) || 'user_001';
        const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const r = await fetch(`${backend.replace(/\/$/, '')}/api/user-avatar?userId=${encodeURIComponent(userId)}`);
        if (r.ok) {
          const data = await r.json();
          if (data && data.avatarUrl) {
            setAvatar(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
            return;
          }
        }
        // Fallback to localStorage if backend has none
        try {
          const ls = localStorage.getItem('langvoyage_user_avatar_url') || localStorage.getItem('langvoyage_avatar');
          if (ls) setAvatar(prev => ({ ...prev, avatarUrl: ls }));
        } catch {}
      } catch (e) {
        console.warn('Failed to fetch saved avatar', e);
      }
    })();
    return () => {
      console.log('App unmounted');
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  // Listen for avatar export messages from Ready Player Me iframe and save model URL
  useEffect(() => {
    function handleRpmMessage(event) {
      try {
        const data = event.data;
        if (!data) return;
        // Debug: console.log messages for troubleshooting
        try { if (data && data.type) console.debug('[RPM message]', data.type, data); } catch {}
        // const fromRPM = typeof event.origin === 'string' && /readyplayer\.me$/i.test(new URL(event.origin).hostname || '');
        // When frame is ready, subscribe to exported event
        if (data.type === 'v1.frame.ready') {
          setRpmFrameReady(true);
          ensureRpmSubscriptions();
          if (pendingRpmExportRef.current) {
            pendingRpmExportRef.current = false;
            requestRpmExport();
          }
        }
        // Expected payload: { type: 'v1.avatar.exported', url: 'https://models.readyplayer.me/....glb' }
        if (data.type === 'v1.avatar.exported') {
          const url = data.url || (data.data && data.data.url);
          if (!url) return;
          setAvatar(prev => ({ ...prev, avatarUrl: url }));
          // Persist to backend so it survives across gameplay
          (async () => {
            try {
              const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
              const userId = (avatar && avatar.id) || 'user_001';
              await fetch(`${backend.replace(/\/$/, '')}/api/save-avatar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, avatarUrl: url })
              });
            } catch (e) {
              console.warn('Failed to save avatar to backend', e);
            }
          })();
          setRpmSaving(false);
          setRpmSaveError('');
          if (rpmExportRetryRef.current) { clearInterval(rpmExportRetryRef.current); rpmExportRetryRef.current = null; }
          // Return to avatar screen after export
          setScreen('avatar');
        }
        if (data.type === 'v1.avatar.export.failed') {
          // Immediately retry if currently saving
          if (rpmSaving) {
            try {
              const iframe = rpmIframeRef.current;
              const win = iframe && iframe.contentWindow;
              if (win) win.postMessage({ target: 'readyplayerme', type: 'v1.avatar.export' }, '*');
            } catch {}
          }
        }
      } catch (e) {
        // ignore
      }
    }
    window.addEventListener('message', handleRpmMessage);
    return () => window.removeEventListener('message', handleRpmMessage);
  }, []);

  // Auto-play TTS for dialogue lines when index changes
  // Voice is disabled on dialogue pages for now (no auto TTS)
  // useEffect(() => {
  //   const dlg = storyDialogues[dialogueIndex];
  //   if (dlg && tts && typeof tts.speak === 'function' && !practiceState) {
  //     try { tts.speak(`${dlg.speaker}: ${dlg.text}`); } catch (e) { console.warn('TTS failed for dialogue', e); }
  //   }
  // }, [dialogueIndex, storyDialogues]);

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

  function createFallbackChoices(idx, vocabPack) {
    // Create meaningful choices only at strategic moments, incorporating vocabulary when available
    // Return null if no choices should be shown (most of the time)
    // Only show choices about every 5 lines, and only if we have vocab to practice
    const shouldShowChoice = idx > 0 && idx % 5 === 0 && vocabPack && vocabPack.length > 0;
    if (!shouldShowChoice) return null;
    // Select up to 3 vocab words to offer as different utterance options (no English translations shown)
    const baseIndex = Math.floor(idx / 5) % vocabPack.length;
    const candidates = [
      vocabPack[baseIndex],
      vocabPack[(baseIndex + 1) % vocabPack.length],
      vocabPack[(baseIndex + 2) % vocabPack.length]
    ].filter(Boolean);
    if (candidates.length === 0) return null;
    // Map to choice objects with different internal tones but target-language text only
    const tones = ['friendly', 'neutral', 'bold'];
    return candidates.slice(0, 3).map((v, i) => ({
      text: `Say: "${v.word}"`,
      practiceWord: v.word,
      effect: { tone: tones[i % tones.length] },
      nextDelta: 1
    }));
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
    if (!avatar.avatarUrl) return alert('Please click "Save Avatar" to export your 3D avatar before continuing.');
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
  const country = LANGUAGE_COUNTRY[lang] || `${lang}-speaking country`;
  const city = COUNTRY_CITY[country] || 'the capital';
  const opening = `On a ${toneAdj} morning in ${city}, ${country}, ${avatarData.name || 'you'} step off a rattling tram, the air sweet with street food and possibility.`;
    const mid = `Drawn into a ${genresList.length ? genresList.join(' and ') : 'quiet'} arc, ${avatarData.name || 'you'} meets ${buddy}, a local with a knack for ${hobbies && hobbies.length ? hobbies[0].toLowerCase() : 'small kindnesses'}. Together they chase a thread: a missing letter, a secret gallery, a late-night recipe, or a constellation of tiny favors that grow into a choice.`;
    const conflict = `But ${city} doesn't give up answers easily. Small betrayals, a figure who remembers your family name, and a spilled map at a midnight market force choices that test honesty and courage—rooted in the customs of ${country}.`;
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
      const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      if (backend) {
        const r = await fetch(`${backend.replace(/\/$/, '')}/api/story`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, genresList, avatarData, buddy, hobbies, traits, episodeNum, previousPlot, plotState: ps })
        });
        if (!r.ok) {
          let detail = '';
          try { const t = await r.text(); detail = t; } catch {}
          let msg = 'Backend story failed';
          try { const j = JSON.parse(detail); msg = j.error || msg; if (j.detail) msg += `: ${j.detail}`; } catch {}
          throw new Error(msg);
        }
        const data = await r.json();
        return (data.summary || '').trim();
      }
      throw new Error('No backend configured');
    } catch (e) {
      console.warn('Story generation failed', e);
      throw e;
    }
  }

  // AI-generate dialogues from the plot summary
  async function remoteGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp = [], plotState: ps = { tone: 'neutral', decisions: [] } }) {
    try {
      const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      if (backend) {
        const r = await fetch(`${backend.replace(/\/$/, '')}/api/dialogues`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plot, avatarData, buddy, lang, vocabPack: vp, plotState: ps })
        });
        if (!r.ok) throw new Error('Backend dialogues failed');
        const data = await r.json();
        const txt = data.content || '';
        // Parse same as below
        const lines = txt.trim().split('\n').filter(l => l.trim()).map(l => l.trim());
        const dialogues = [];
        let currentDialogue = null;
        let collectingChoices = false;
        let choicesList = [];
        lines.forEach((line) => {
          if (line.toUpperCase().includes('CHOICES:')) { collectingChoices = true; choicesList = []; return; }
          if (collectingChoices && (line.startsWith('-') || line.startsWith('•') || line.startsWith('*'))) {
            const choiceText = line.replace(/^[-•*]\s*/, '').trim();
            const vocabMatch = choiceText.match(/Say:\s*["']?([^"'(]+)["']?/i);
            if (vocabMatch) {
              const word = vocabMatch[1].trim();
              choicesList.push({ text: `Say: "${word}"`, practiceWord: word, nextDelta: 1 });
            } else {
              const cleaned = choiceText.replace(/\s*\([^)]*\)\s*$/, '').trim();
              choicesList.push({ text: cleaned, nextDelta: 1 });
            }
            return;
          }
          if (collectingChoices && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*')) {
            if (currentDialogue && choicesList.length > 0) currentDialogue.choices = choicesList;
            collectingChoices = false; choicesList = [];
          }
          const colonIdx = line.indexOf(':'); if (colonIdx === -1) return;
          if (currentDialogue) dialogues.push(currentDialogue);
          let speaker = line.slice(0, colonIdx).trim().replace(/^\d+\.\s*/, '');
          const text = line.slice(colonIdx + 1).trim();
          if (/^you$/i.test(speaker)) speaker = avatarData.name;
          if (new RegExp(`^${avatarData.name}\s*$`, 'i').test(speaker)) speaker = avatarData.name;
          if (new RegExp(`^${buddy}\s*$`, 'i').test(speaker)) speaker = buddy;
          currentDialogue = { speaker, text, choices: null, isFinalLine: false, setting: undefined };
        });
        if (currentDialogue) { if (collectingChoices && choicesList.length) currentDialogue.choices = choicesList; dialogues.push(currentDialogue); }
        if (dialogues.length > 0) { dialogues[dialogues.length - 1].isFinalLine = true; dialogues[dialogues.length - 1].setting = 'The moment hangs in the air, charged with possibility.'; }
        return dialogues;
      }
      throw new Error('No backend configured');
    } catch (e) {
      console.warn('Dialogue generation failed', e);
      throw e;
    }
  }

  function aiGenerateDialogues({ plot, avatarData, buddy, lang, vocabPack: vp = [] }) {
    // Produce 100 dialogue lines that expand the generated plot into character voices.
    const aName = avatarData.name || 'Traveler';
    const bName = buddy || 'Buddy';
    const locals = ['Vendor', 'Old Friend', 'Mysterious Caller', 'Shop Owner', 'Street Musician', 'Guide', 'Child', 'Elder', 'Tourist', 'Artist'];
    const dialogues = [];
    
  // Opening sequence (no immediate choice - let story flow first)
    dialogues.push({ speaker: bName, text: `Hey ${aName}, did you see the mural by the harbor? There's a symbol there that looks like your family crest.` });
    dialogues.push({ speaker: aName, text: `I thought I recognized something... I can't read the name on it, but it feels familiar.` });
    
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
      
      // Add strategic vocabulary choices every ~5 lines at key moments
      const shouldAddChoice = vp.length > 0 && i > 0 && i % 5 === 0 && i < 95;
      let choices = null;
      if (shouldAddChoice) {
        const baseIndex = Math.floor(i / 5) % vp.length;
        const picks = [vp[baseIndex], vp[(baseIndex + 1) % vp.length], vp[(baseIndex + 2) % vp.length]].filter(Boolean);
        if (picks.length) {
          const tones = ['friendly', 'neutral', 'bold'];
          choices = picks.slice(0, 3).map((v, idx) => ({
            text: `Say: "${v.word}"`,
            practiceWord: v.word,
            effect: { tone: tones[idx % tones.length] },
            nextDelta: 1
          }));
        }
      }
      
      dialogues.push({
        speaker,
        text: line,
        choices: choices
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
      setPlotError('');
      
      // Start countdown timer from 3 seconds
      const startTime = Date.now();
      plotTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = Math.max(0, 3 - elapsed);
        setPlotTimer(remaining);
      }, 100);
      
      try {
        const prevPlot = episodes[language]?.generatedPlot || '';
        const prevPlotState = episodes[language]?.plotState || plotState;
        const epNum = currentEpisode || 1;
        // Generate or reuse buddy name
        const buddy = buddyName || generateBuddyName(language);
        if (!buddyName) setBuddyName(buddy);

        const story = await remoteGenerateStory({ lang: language, genresList: genres, avatarData: avatar, buddy: buddy, hobbies: avatar.hobbies, traits: avatar.traits, episodeNum: epNum, previousPlot: prevPlot, plotState: prevPlotState });

        setPlotSummary(story);
        // persist generated plot into episodes (dialogues will be generated later after lesson)
        setEpisodes(prev => {
          const langData = prev[language] || { unlocked: [1], completed: [], started: false, genres: genres };
          return { ...prev, [language]: { ...langData, generatedPlot: story } };
        });
      } catch (err) {
        const msg = String(err?.message || err || 'Failed to generate plot');
        setPlotError(msg.includes('Missing OPENAI_API_KEY') ? 'Server is missing OPENAI_API_KEY. Add it to server/.env and restart.' : msg);
      } finally {
        // Stop timer and clear generating flag regardless of success
        if (plotTimerRef.current) {
          clearInterval(plotTimerRef.current);
          plotTimerRef.current = null;
        }
        setPlotGenerating(false);
      }
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
    // Reset intro video state
    setIntroVideoUrl('');
    setIntroVideoLoading(false);
    // Do NOT auto-advance anymore; wait for video to play or user action (Skip)
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
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
    (async () => {
      try {
        const backend = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin : '');
        const r = await fetch(`${backend.replace(/\/$/, '')}/api/lesson`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, episodeNum })
        });
        if (!r.ok) throw new Error('Lesson generation failed');
        const data = await r.json();
        const words = Array.isArray(data.words) ? data.words : [];
        const phrases = Array.isArray(data.phrases) ? data.phrases : [];
        setVocabPack(words);
        setLessonPhrases(phrases);
        const pool = words;
        const q = words.map((v, idx) => {
          const distractors = pool.filter(x => x.meaning !== v.meaning).slice(0, 3).map(d => d.meaning);
          const choices = [v.meaning, ...distractors].sort(() => Math.random() - 0.5).map(text => ({ text, correct: text === v.meaning }));
          return { id: `q_${idx}`, prompt: `What does \"${v.word}\" mean?`, choices, userAnswerIndex: null };
        });
        setQuizItems(q);
        setQuizResults(Array(q.length).fill(null));
        setFirstTryResults(Array(q.length).fill(null));
      } catch (e) {
        console.warn('Lesson generation failed', e);
        alert('Lesson generation failed. Please try again.');
      }
    })();
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
          <input value={avatar.name} onChange={(e) => setAvatar(a => ({ ...a, name: e.target.value }))} placeholder="Enter your name" style={styles.input} />

          {/* Embedded 3D Avatar Creator (Ready Player Me) with Save overlay */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 1000, height: '70vh', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', background: 'rgba(0,0,0,0.15)' }}>
            <iframe
              ref={rpmIframeRef}
              title="ReadyPlayerMe Creator"
              src="https://readyplayer.me/avatar?frameApi"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="camera; microphone; autoplay; clipboard-write; encrypted-media;"
              onLoad={() => {
                try { ensureRpmSubscriptions(); } catch {}
              }}
            />
            {/* Overlay Save button to request export from the creator */}
            <button
              type="button"
              onClick={() => {
                if (!rpmFrameReady) {
                  pendingRpmExportRef.current = true;
                  setRpmSaving(true);
                  ensureRpmSubscriptions();
                  try {
                    const win = rpmIframeRef.current && rpmIframeRef.current.contentWindow;
                    if (win) win.postMessage({ target: 'readyplayerme', type: 'v1.avatar.export' }, '*');
                  } catch {}
                } else {
                  requestRpmExport();
                }
              }}
              style={{ position: 'absolute', top: 6, right: 8, padding: '12px 20px 14px 12px', border: 'none', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', fontWeight: 800, cursor: rpmSaving ? 'wait' : 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 1000, minWidth: 168, textAlign: 'center', borderRadius: '10px 16px 18px 8px' }}
              aria-label="Save Avatar"
            >
              {avatar.avatarUrl ? 'Saved ✓' : (rpmSaving ? 'Saving…' : 'Save Avatar')}
            </button>
            {rpmSaveError && (
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 66, color: '#FFE082', background: 'rgba(0,0,0,0.4)', padding: '8px 12px', borderRadius: 10, zIndex: 1000, maxWidth: 560, textAlign: 'center' }}>
                {rpmSaveError}
              </div>
            )}
          </div>

          

          <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={!avatar.avatarUrl} style={{ ...styles.continueButton, marginTop: 0, opacity: avatar.avatarUrl ? 1 : 0.5, cursor: avatar.avatarUrl ? 'pointer' : 'not-allowed' }}>
              Continue →
            </button>
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
        {plotError && (
          <div style={{ color: '#FFE082', background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, marginBottom: 10 }}>
            {plotError}
          </div>
        )}
        {plotGenerating && (
          <p style={{ color: 'white', fontSize: '1.1rem', marginBottom: 20 }}>
            Your story will be generated in <strong>{plotTimer}</strong> seconds...
          </p>
        )}
        {!plotGenerating && plotSummary && <p style={styles.summaryText}>{plotSummary}</p>}
        {!plotGenerating && !plotSummary && <p style={{ color: 'white', fontSize: '1.1rem', marginBottom: 20 }}>Generating your story...</p>}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={acceptPlot} disabled={plotGenerating || !plotSummary} style={{ ...styles.continueButton, background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', opacity: (plotGenerating || !plotSummary) ? 0.5 : 1, cursor: (plotGenerating || !plotSummary) ? 'not-allowed' : 'pointer' }}>Continue to Story</button>
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
        {introVideoUrl ? (
          <div style={{ width: '100%', maxWidth: 960, borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <video
              key={introVideoUrl}
              src={introVideoUrl}
              style={{ width: '100%', height: 'auto', background: 'black' }}
              autoPlay
              muted
              playsInline
              onPlay={() => { if (animationTimerRef.current) { clearTimeout(animationTimerRef.current); animationTimerRef.current = null; } }}
              onEnded={() => { setScreen('lesson'); }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <p style={{ color: 'white', opacity: 0.9 }}>
              {introVideoLoading ? 'Generating intro video…' : 'Preparing your episode…'}
            </p>
            {introVideoError && !introVideoLoading && (
              <>
                <div style={{ color: '#FFE082' }}>{introVideoError}</div>
                <button onClick={() => requestIntroVideo()} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, cursor: 'pointer' }}>Retry video</button>
              </>
            )}
            <button onClick={() => { if (animationTimerRef.current) { clearTimeout(animationTimerRef.current); animationTimerRef.current = null; } setScreen('lesson'); }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Skip video →</button>
          </div>
        )}
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
          {lessonPhrases && lessonPhrases.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ color: 'white', marginBottom: 12 }}>Useful phrases</h3>
              {lessonPhrases.map((p, idx) => (
                <div key={`${p.phrase}-${idx}`} style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.9)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: '#1a1a1a', fontWeight: 600 }}>
                    {p.phrase} — <span style={{ fontWeight: 400, color: '#555' }}>{p.meaning}</span>
                  </div>
                  <button
                    onClick={() => tts.speak(p.phrase)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 10,
                      background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                    title="Pronounce this phrase"
                  >
                    🔊
                  </button>
                </div>
              ))}
            </div>
          )}
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
    const allAnswered = firstTryResults.length > 0 && firstTryResults.every(r => r !== null);
    const passed = allAnswered && firstTryPct >= 80;

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
  <p style={{ color: 'white', fontSize: '1.2rem', marginBottom: 30 }}>Your score: <strong>{firstTryPct}%</strong>{!allAnswered && ' (finish all questions)'}
  </p>

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
            <div style={{ textAlign: 'center' }}>
              {!allAnswered ? (
                <div style={{ marginBottom: 15, color: 'white', fontSize: '1.2rem' }}>Answer all questions to see your result.</div>
              ) : (
                <div style={{ marginBottom: 15, color: 'white', fontSize: '1.2rem' }}>You need 80% to continue.</div>
              )}
              {allAnswered && (
                <button onClick={retakeQuiz} style={{ padding: '15px 30px', borderRadius: 15, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', border: 'none', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }}>Retake Quiz</button>
              )}
            </div>
          )}

          {passed && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'white', fontSize: '1.5rem', marginBottom: 20 }}>Congratulations! You scored {Math.round(firstTryPct)}%!</p>
                <button onClick={() => {
                  setShowConfetti(true);
                  setTimeout(() => setShowConfetti(false), 1000);
                  // Move to dialogue immediately; use prefetched content when ready
                  if (prefetch.dialogues && prefetch.dialogues.length) {
                    setPlotSummary(prefetch.plot);
                    setStoryDialogues(prefetch.dialogues);
                    setDialogueIndex(0);
                    setEpisodes(prev => {
                      const langData = prev[language] || { unlocked: [1], completed: [], started: true, genres };
                      return { ...prev, [language]: { ...langData, generatedPlot: prefetch.plot, generatedDialogues: prefetch.dialogues } };
                    });
                  }
                  setScreen('dialogue');
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
        // Advance dialogue on background click only when no choices are present
        const hasChoices = dlg && dlg.choices && dlg.choices.length > 0;
        if (hasChoices) {
          // Do not advance if choices are available - user must select one
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
              {/* Interactive choices area (only when choices are explicitly provided) */}
              {!isLastLine && dlg && dlg.choices && dlg.choices.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dlg.choices.map((c, ci) => (
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
                          // advance to nextIndex if provided
                          const next = practiceState.nextIndex != null ? practiceState.nextIndex : Math.min(storyDialogues.length - 1, dialogueIndex + 1);
                          setPracticeState(null);
                          setDialogueIndex(next);
                        } else {
                          // Remain on practice until correct, no voice feedback
                        }
                      }} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#FFF' }}>{opt}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              {dialogueLoading ? 'Loading dialogue…' : (dialogueError || (prefetch.inFlight ? 'Preparing dialogue…' : 'Preparing dialogue…'))}
              {!dialogueLoading && dialogueError && (
                <div style={{ marginTop: 12 }}>
                  <button onClick={(e) => { e.stopPropagation(); setScreen('dialogue'); }} style={{ padding: '10px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
                </div>
              )}
            </div>
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

