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
  const [screen, setScreen] = useState('avatar'); // avatar | traits | genre | language | plot | home | animation | lesson | quiz | story
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

  const tts = useSpeech();
  const animationTimerRef = useRef(null);

  useEffect(() => {
    console.log('App mounted');
    return () => {
      console.log('App unmounted');
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

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
          <input value={avatar.name} onChange={(e) => setAvatar(a => ({ ...a, name: e.target.value }))} placeholder="Enter a name" style={styles.input} />

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

          {/* STYLE UI removed per request (kept state) */}

          {/* Traits & Hobbies removed from avatar page — they appear on the next screen */}

          <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" style={{ ...styles.continueButton, marginTop: 0 }}>Continue →</button>
          </div>
        </form>
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
          <button onClick={acceptPlot} style={{ ...styles.continueButton, backgroundColor: '#4CAF50' }}>Yes, start this story</button>
          <button onClick={regeneratePlot} style={{ padding: '12px 20px', borderRadius: 12, background: '#EEE', border: 'none' }}>Generate another plot</button>
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
              <button onClick={() => { setShowConfetti(true); tts.speak('Congratulations!'); setTimeout(() => setShowConfetti(false), 3000); setTimeout(() => setScreen('story'), 800); }} style={{ padding: '10px 16px', borderRadius: 12, background: '#10B981', color: '#fff', border: 'none' }}>Continue →</button>
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

  return null;
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32, background: 'linear-gradient(to bottom right, #F0FBF6, #E6F7FF)', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif', color: '#0F172A' },
  title: { fontSize: 28, fontWeight: 700, marginBottom: 16, color: '#052662' },
  subTitle: { fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#334155' },
  input: { padding: 12, borderRadius: 12, border: '1px solid #D1D5DB', width: '60%', marginBottom: 20, textAlign: 'center', boxShadow: '0 4px 12px rgba(2,6,23,0.06)' },
  avatarLayout: { display: 'flex', width: '90%', gap: 20, background: '#FFFFFF', borderRadius: 18, padding: 20, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' },
  categoryPanel: { display: 'flex', flexDirection: 'column', width: '26%', gap: 10 },
  categoryButton: { border: 'none', padding: '12px 16px', borderRadius: 12, cursor: 'pointer', fontSize: 15, transition: 'all 0.18s', fontWeight: 600, boxShadow: '0 4px 8px rgba(2,6,23,0.06)' },
  optionPanel: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '74%', gap: 12 },
  categoryButtonSmall: { padding: '8px 10px', borderRadius: 10 },
  optionButton: { border: 'none', padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 15, transition: 'all 0.18s', fontWeight: 600, boxShadow: '0 4px 10px rgba(2,6,23,0.04)' },
  traitLayout: { display: 'flex', width: '90%', gap: 20, marginBottom: 30, background: '#FFFFFF', borderRadius: 18, padding: 16, boxShadow: '0 6px 18px rgba(2,6,23,0.06)' },
  continueButton: { marginTop: 24, padding: '12px 26px', backgroundColor: '#1E90FF', color: '#fff', border: 'none', borderRadius: 16, cursor: 'pointer', fontSize: 16, fontWeight: 700, transition: 'all 0.18s', boxShadow: '0 6px 16px rgba(30,144,255,0.18)' },
  summaryText: { fontSize: 16, maxWidth: 760, textAlign: 'center', lineHeight: 1.5, marginBottom: 20 },
};

