import React, { useEffect, useState, useRef } from 'react';

// LangVoyage — with smooth animations inspired by the character customization UI
const LANGUAGES = ['Spanish','French','Chinese','Russian','Italian','Arabic','Japanese','Korean','Portuguese','German','Hindi','Turkish','Dutch','Swedish','Polish'];
const AVAILABLE_GENRES = ['Romance', 'Adventure', 'Mystery', 'Comedy', 'Drama', 'Sci-Fi'];
const AVATAR_CATEGORIES = {
```

## Developer Notes

- PlotState continuity
  - `plotState` tracks a tone (friendly, neutral, bold) and a list of player decisions with effects.
  - At the end of each episode’s dialogue, we persist `plotState` into `episodes[language].plotState`.
  - The next episode’s story and dialogue generation receive this `plotState` so tone and recent decisions steer the narrative.

- Branching and choices
  - Reply options can carry an `effect` (e.g., tone) and a `nextDelta` to branch the next line(s).
  - If the model returns fewer than three reply options, we add fallbacks: “Respond warmly”, “Stay neutral”, “Be bold”.
  - When choices are expected, background clicks won’t advance; the player must pick an option.

- Dialogue length guarantee
  - After generation, dialogues are padded to ensure at least 100 pages per episode and the final page is flagged.

- Future enhancements
  - Expand `plotState` beyond tone (relationship scores, risk/rule-breaking, trust) and use them for deeper branching.
  - Feed richer state back into subsequent episodes for stronger continuity.
  - Optionally surface tone/branch outcomes in the UI (subtle badges, recap).

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

// Global keyframe animations
const globalStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(126, 217, 87, 0.5); }
    50% { box-shadow: 0 0 30px rgba(126, 217, 87, 0.8); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  @keyframes sparkle {
    0%, 100% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes confettiFall {
    to { transform: translateY(100vh) rotate(720deg); opacity: 0; }
  }
`;

// Animated confetti
function Confetti() {
  const pieces = Array.from({ length: 80 });
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
      {pieces.map((_, i) => {
        const duration = 2 + Math.random() * 2;
        const delay = Math.random() * 0.5;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${Math.random() * 100}%`,
              top: '-20px',
              width: 10,
              height: 16,
              background: `hsl(${Math.random() * 360}deg, 70%, 60%)`,
              opacity: 0.9,
              animation: `confettiFall ${duration}s linear ${delay}s forwards`
            }}
          />
        );
      })}
    </div>
  );
}

// Sparkle effect for selected buttons
function Sparkles({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            background: 'white',
            borderRadius: '50%',
            top: `${20 + i * 30}%`,
            right: `${10 + i * 15}%`,
            animation: `sparkle ${1 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`
          }}
        />
      ))}
    </>
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
  const [avatar, setAvatar] = useState({
    id: 'user_001',
    name: '',
    gender: 'Female',
    appearance: {},
    clothes: {},
    traits: [],
    hobbies: [],
    style: 'Casual'
  });
  const [selectedCategory, setSelectedCategory] = useState('Gender');
  const [genres, setGenres] = useState([]);
  const [language, setLanguage] = useState(null);
  const [plotSummary, setPlotSummary] = useState('');
  const [episodes, setEpisodes] = useState({});
  const [screen, setScreen] = useState('avatar');
  const [stats, setStats] = useState({ streak: 0, points: 0, wordsLearned: 0 });
  const [currentEpisode, setCurrentEpisode] = useState(null);
  const [avatarEditMode, setAvatarEditMode] = useState(false);
  const [justCompletedGenres, setJustCompletedGenres] = useState(false);
  const [buddyName, setBuddyName] = useState('');
  const [vocabPack, setVocabPack] = useState([]);
  const [quizItems, setQuizItems] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [firstTryResults, setFirstTryResults] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const tts = useSpeech();
  const animationTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };
  }, []);

  function handleAppearanceChange(category, option) {
    setAvatar(prev => ({ ...prev, appearance: { ...prev.appearance, [category]: option } }));
  }
  
  function toggleTrait(tr) {
    setAvatar(prev => ({ ...prev, traits: prev.traits.includes(tr) ? prev.traits.filter(x => x !== tr) : [...prev.traits, tr] }));
  }
  
  function toggleHobby(h) {
    setAvatar(prev => ({ ...prev, hobbies: prev.hobbies.includes(h) ? prev.hobbies.filter(x => x !== h) : [...prev.hobbies, h] }));
  }

  function handleAvatarSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!avatar.name.trim()) return alert('Please enter your avatar name');
    if (avatarEditMode) {
      setAvatarEditMode(false);
      setScreen('home');
      return;
    }
    setScreen('traits');
  }

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
    if (language) {
      setEpisodes(prev => {
        const existing = prev[language] || { unlocked: [1], completed: [], started: false, genres: [] };
        return { ...prev, [language]: { ...existing, genres: genres } };
      });
      generatePlotSummary(language, genres);
      setScreen('plot');
      return;
    }
    setJustCompletedGenres(true);
    setScreen('language');
  }

  function selectLanguage(lang) {
    if (justCompletedGenres) {
      setLanguage(lang);
      setEpisodes(prev => {
        if (prev[lang]) return prev;
        return { ...prev, [lang]: { unlocked: [1], completed: [], started: false, genres: genres } };
      });
      generatePlotSummary(lang, genres);
      setJustCompletedGenres(false);
      setScreen('plot');
      return;
    }
    const langData = episodes[lang];
    if (langData && langData.started) {
      setLanguage(lang);
      setGenres(langData.genres || []);
      setScreen('home');
      return;
    }
    setLanguage(lang);
    setEpisodes(prev => {
      if (prev[lang]) return prev;
      return { ...prev, [lang]: { unlocked: [1], completed: [], started: false, genres: [] } };
    });
    const existing = episodes[lang];
    if (existing && existing.genres && existing.genres.length) {
      setGenres(existing.genres);
      generatePlotSummary(lang, existing.genres);
      setScreen('plot');
    } else {
      setGenres([]);
      setScreen('genres');
    }
  }

  function generatePlotSummary(lang, genresList) {
    const g = genresList && genresList.length ? genresList.join(', ') : 'slice-of-life';
    const summary = `Plot preview — Genre(s): ${g}. You arrive in a ${lang}-speaking city to pursue a ${g} story: unexpected friendships, small conflicts, and cinematic moments that teach you ${lang}. Do you want to start this plot?`;
    setPlotSummary(summary);
  }

  function acceptPlot() {
    if (!language) return alert('No language selected.');
    setEpisodes(prev => {
      const langData = prev[language] || { unlocked: [1], completed: [], started: false, genres: [] };
      const updated = { ...langData, started: true, genres: genres.length ? genres : (langData.genres || []) };
      return { ...prev, [language]: updated };
    });
    setJustCompletedGenres(false);
    setScreen('home');
  }

  function regeneratePlot() {
    const shuffled = genres.slice().sort(() => Math.random() - 0.5).slice(0, genres.length || 1);
    generatePlotSummary(language, shuffled);
  }

  function startEpisode(epNum) {
    if (!language) return alert('Select a language first.');
    setCurrentEpisode(epNum);
    const buddy = generateBuddyName(language);
    setBuddyName(buddy);
    prepareLesson(language);
    setScreen('animation');
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    animationTimerRef.current = setTimeout(() => { setScreen('lesson'); }, 150000);
  }

  function finishEpisode(epNum) {
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

  function generateBuddyName(lang) {
    const namesByLang = { Spanish: ['Lucia', 'Diego', 'Sofia', 'Mateo'], French: ['Claire', 'Luc', 'Amelie', 'Hugo'], Japanese: ['Yuki', 'Ren', 'Aiko', 'Hiro'] };
    const list = namesByLang[lang] || ['Ari'];
    return list[Math.floor(Math.random() * list.length)];
  }

  function prepareLesson(lang) {
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
        { word: 'こんにちは', meaning: 'hello (konnichiwa)', examples: ['こんにちは、元気ですか?'] },
        { word: 'ありがとう', meaning: 'thank you (arigatou)', examples: ['ありがとうございます。'] },
        { word: 'お願いします', meaning: 'please', examples: ['お願いします。'] },
        { word: 'はい', meaning: 'yes', examples: ['はい、わかりました。'] },
        { word: 'いいえ', meaning: 'no', examples: ['いいえ、違います。'] }
      ]
    };
    const pool = BANK[lang] || BANK['Spanish'];
    const pack = pool.slice(0, 5);
    setVocabPack(pack);
    const q = pack.map((v, idx) => {
      const distractors = pool.filter(x => x.meaning !== v.meaning).slice(0, 3).map(d => d.meaning);
      const choices = [v.meaning, ...distractors].sort(() => Math.random() - 0.5).map(text => ({ text, correct: text === v.meaning }));
      return { id: `q_${idx}`, prompt: `What does \"${v.word}\" mean?`, choices, userAnswerIndex: null };
    });
    setQuizItems(q);
    setQuizResults(Array(q.length).fill(null));
    setFirstTryResults(Array(q.length).fill(null));
  }

  function submitAnswer(qIndex, choiceIndex) {
    setQuizItems(prev => { const next = prev.slice(); next[qIndex] = { ...next[qIndex], userAnswerIndex: choiceIndex }; return next; });
    const item = quizItems[qIndex];
    if (!item) return;
    const choice = item.choices[choiceIndex];
    if (!choice) return;
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
    const pct = computeFirstTryScore();
    if (pct >= 80) {
      setShowConfetti(true);
      tts.speak('Congratulations! You passed the practice.');
      setTimeout(() => setShowConfetti(false), 3000);
      setTimeout(() => setScreen('story'), 1000);
    } else {
      alert(`Score ${pct}%. You must score at least 80% on first try to continue. Please retake.`);
      setQuizItems(prev => prev.map((q, i) => ({ ...q, userAnswerIndex: null })));
      setQuizResults(prev => prev.map((r, i) => (firstTryResults[i] === true ? true : null)));
    }
  }

  function retakeQuiz() {
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

  // Render screens
  if (screen === 'avatar') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <h1 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Design Your Avatar</h1>
        <form onSubmit={handleAvatarSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <input 
            value={avatar.name} 
            onChange={(e) => setAvatar(a => ({ ...a, name: e.target.value }))} 
            placeholder="Enter a name" 
            style={{...styles.input, animation: 'fadeIn 0.8s ease-out'}} 
          />
          <div style={{...styles.avatarLayout, animation: 'fadeIn 1s ease-out'}}>
            <div style={styles.categoryPanel}>
              {Object.keys(AVATAR_CATEGORIES).map((cat, idx) => (
                <button 
                  key={cat} 
                  type="button" 
                  onClick={() => setSelectedCategory(cat)}
                  style={{ 
                    ...styles.categoryButton, 
                    backgroundColor: selectedCategory === cat ? '#7ED957' : '#C7F9CC',
                    animation: `fadeIn ${0.3 + idx * 0.1}s ease-out`,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: selectedCategory === cat ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: selectedCategory === cat ? '0 8px 16px rgba(126, 217, 87, 0.3)' : '0 4px 8px rgba(2,6,23,0.06)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = selectedCategory === cat ? 'scale(1.05)' : 'scale(1)'}
                >
                  {cat}
                  {selectedCategory === cat && <Sparkles count={2} />}
                </button>
              ))}
            </div>
            <div style={styles.optionPanel}>
              {AVATAR_CATEGORIES[selectedCategory].map((option, idx) => (
                <button 
                  key={option} 
                  type="button" 
                  onClick={() => handleAppearanceChange(selectedCategory, option)}
                  style={{ 
                    ...styles.optionButton, 
                    backgroundColor: avatar.appearance[selectedCategory] === option ? '#57CC99' : '#E9F5E9',
                    animation: `fadeIn ${0.2 + idx * 0.05}s ease-out`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: avatar.appearance[selectedCategory] === option ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: avatar.appearance[selectedCategory] === option ? '0 6px 12px rgba(87, 204, 153, 0.3)' : '0 4px 10px rgba(2,6,23,0.04)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = avatar.appearance[selectedCategory] === option ? 'scale(1.08)' : 'scale(1)'}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 1.2s ease-out' }}>
            <button 
              type="submit" 
              style={{ 
                ...styles.continueButton, 
                marginTop: 0,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(30,144,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,144,255,0.18)';
              }}
            >
              Continue →
              <Sparkles count={3} />
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (screen === 'traits') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <h1 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Choose Personality & Hobbies</h1>
        <div style={{...styles.traitLayout, animation: 'fadeIn 0.8s ease-out'}}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Personality</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERSONALITY_TRAITS.map((t, idx) => (
              <button 
                key={t} 
                onClick={() => toggleTrait(t)} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 12, 
                  border: 'none', 
                  background: avatar.traits.includes(t) ? '#F8BBD0' : '#FFF0F5',
                  animation: `fadeIn ${0.3 + idx * 0.05}s ease-out`,
                  transition: 'all 0.25s ease',
                  transform: avatar.traits.includes(t) ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: avatar.traits.includes(t) ? '0 4px 12px rgba(248, 187, 208, 0.4)' : 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = avatar.traits.includes(t) ? 'scale(1.05)' : 'scale(1)'}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div style={{...styles.traitLayout, animation: 'fadeIn 1s ease-out'}}>
          <div style={{ width: '30%' }}>
            <h3 style={styles.subTitle}>Hobbies</h3>
          </div>
          <div style={{ width: '70%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HOBBIES.map((h, idx) => (
              <button 
                key={h} 
                onClick={() => toggleHobby(h)} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 12, 
                  border: 'none', 
                  background: avatar.hobbies.includes(h) ? '#FFD580' : '#FFF8E7',
                  animation: `fadeIn ${0.3 + idx * 0.05}s ease-out`,
                  transition: 'all 0.25s ease',
                  transform: avatar.hobbies.includes(h) ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: avatar.hobbies.includes(h) ? '0 4px 12px rgba(255, 213, 128, 0.4)' : 'none',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = avatar.hobbies.includes(h) ? 'scale(1.05)' : 'scale(1)'}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 1.2s ease-out' }}>
          <button 
            onClick={() => setScreen('genres')} 
            style={{ 
              ...styles.continueButton, 
              marginTop: 0,
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(30,144,255,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,144,255,0.18)';
            }}
          >
            Continue →
            <Sparkles count={3} />
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'genres') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <h1 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Choose up to 3 genres</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeIn 0.8s ease-out' }}>
          {AVAILABLE_GENRES.map((g, idx) => (
            <button 
              key={g} 
              onClick={() => toggleGenre(g)} 
              style={{ 
                padding: '10px 14px', 
                borderRadius: 12, 
                border: 'none', 
                background: genres.includes(g) ? '#FFD1A9' : '#FFF3E0',
                animation: `fadeIn ${0.3 + idx * 0.1}s ease-out`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: genres.includes(g) ? 'scale(1.1)' : 'scale(1)',
                boxShadow: genres.includes(g) ? '0 6px 16px rgba(255, 209, 169, 0.4)' : 'none',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = genres.includes(g) ? 'scale(1.1)' : 'scale(1)'}
            >
              {g}
              {genres.includes(g) && (
                <div style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#FF6B35',
                  animation: 'glow 2s ease-in-out infinite'
                }} />
              )}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 18, width: '100%', display: 'flex', justifyContent: 'flex-end', animation: 'fadeIn 1s ease-out' }}>
          <button 
            onClick={confirmGenres} 
            style={{ 
              ...styles.continueButton, 
              marginTop: 0,
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(30,144,255,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,144,255,0.18)';
            }}
          >
            Continue →
            <Sparkles count={3} />
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'language') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <h1 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Select a language</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', animation: 'fadeIn 0.8s ease-out' }}>
          {LANGUAGES.map((l, idx) => (
            <button 
              key={l} 
              onClick={() => selectLanguage(l)} 
              style={{ 
                padding: '10px 14px', 
                borderRadius: 12, 
                border: 'none', 
                background: language === l ? '#BFEAD4' : '#F0FFF4',
                animation: `fadeIn ${0.2 + idx * 0.05}s ease-out`,
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(191, 234, 212, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'plot') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <h1 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Plot summary</h1>
        <p style={{...styles.summaryText, animation: 'fadeIn 0.8s ease-out'}}>{plotSummary}</p>
        <div style={{ display: 'flex', gap: 12, animation: 'fadeIn 1s ease-out' }}>
          <button 
            onClick={acceptPlot} 
            style={{ 
              ...styles.continueButton, 
              backgroundColor: '#4CAF50',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(76, 175, 80, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,144,255,0.18)';
            }}
          >
            Yes, start this story
          </button>
          <button 
            onClick={regeneratePlot} 
            style={{ 
              padding: '12px 20px', 
              borderRadius: 12, 
              background: '#EEE', 
              border: 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.background = '#DDD';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = '#EEE';
            }}
          >
            Generate another plot
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'home') {
    const langList = LANGUAGES;
    const currentLang = language || langList[0];
    const currentEpisodes = episodes[currentLang]?.unlocked || [1];
    const selectedForLang = episodes[currentLang]?.genres && episodes[currentLang].genres.length ? episodes[currentLang].genres : genres;
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.6s ease-out' }}>
          <div>
            <h2 style={{ margin: 0 }}>Welcome, {avatar?.name || 'Traveler'}</h2>
            <p style={{ margin: 0 }}>Day Streak: {stats.streak} | Points: {stats.points} | Words Learned: {stats.wordsLearned}</p>
            <p style={{ marginTop: 6, color: '#666' }}>Selected genres: {selectedForLang && selectedForLang.length ? selectedForLang.join(', ') : 'None'}</p>
          </div>
          <div>
            <button 
              onClick={() => { setAvatarEditMode(true); setScreen('avatar'); }} 
              style={{ 
                padding: '8px 12px', 
                borderRadius: 10, 
                border: 'none', 
                background: '#E8F0FF',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 144, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Edit Avatar
            </button>
          </div>
        </div>
        <div style={{ marginTop: 18, width: '100%', animation: 'fadeIn 0.8s ease-out' }}>
          <h3>Languages</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {langList.map((l, idx) => (
              <button 
                key={l} 
                onClick={() => selectLanguage(l)} 
                style={{ 
                  padding: '8px 12px', 
                  borderRadius: 10, 
                  border: 'none', 
                  background: currentLang === l ? '#FFF2B2' : '#FFF9E6',
                  animation: `slideInRight ${0.3 + idx * 0.05}s ease-out`,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 18, width: '100%', animation: 'fadeIn 1s ease-out' }}>
          <h3>Episodes ({currentLang})</h3>
          <ul style={{ paddingLeft: 20 }}>
            {currentEpisodes.map((ep, idx) => (
              <li key={ep} style={{ marginTop: 8, animation: `fadeIn ${0.5 + idx * 0.1}s ease-out` }}>
                <button 
                  onClick={() => startEpisode(ep)} 
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: 10, 
                    border: 'none', 
                    background: '#9BE7FF', 
                    color: '#003049',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(5px) scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(155, 231, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0) scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Start Episode {ep}
                </button>
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
        <style>{globalStyles}</style>
        <button 
          onClick={() => setScreen('home')} 
          style={{ 
            position: 'absolute', 
            left: 20, 
            top: 20, 
            border: 'none', 
            background: 'transparent', 
            color: '#1E88E5',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-3px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          ← Back to Main Page
        </button>
        <h2 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Episode {currentEpisode} — Opening Animation</h2>
        <div style={{ 
          maxWidth: 720, 
          textAlign: 'center', 
          animation: 'fadeIn 0.8s ease-out',
          padding: 20,
          background: 'rgba(255,255,255,0.5)',
          borderRadius: 16,
          backdropFilter: 'blur(10px)'
        }}>
          <div style={{ 
            width: '100%', 
            height: 300, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'white',
              animation: 'float 3s ease-in-out infinite'
            }} />
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)',
              animation: 'pulse 4s ease-in-out infinite'
            }} />
          </div>
          <p>(Playing a {genres.join(', ')}-style cinematic in English that shows why you came to this country... This animation is 2–3 minutes long.)</p>
        </div>
        <p style={{ marginTop: 12, animation: 'fadeIn 1s ease-out' }}>When it ends, you'll meet your learning buddy and start a short lesson.</p>
      </div>
    );
  }

  if (screen === 'lesson') {
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <button 
          onClick={() => setScreen('home')} 
          style={{ 
            position: 'absolute', 
            left: 20, 
            top: 20, 
            border: 'none', 
            background: 'transparent', 
            color: '#1E88E5',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-3px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          ← Back to Main Page
        </button>
        <h2 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Welcome to your lesson!</h2>
        <p style={{ animation: 'fadeIn 0.8s ease-out' }}>Your learning buddy is <strong>{buddyName}</strong> — they will teach you up to 5 new words and grammar.</p>
        <div style={{ marginTop: 12, width: '100%', maxWidth: 720 }}>
          {vocabPack.map((v, i) => (
            <div 
              key={v.word} 
              style={{ 
                padding: 12, 
                borderRadius: 12, 
                background: '#fff', 
                marginBottom: 10, 
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                animation: `fadeIn ${0.5 + i * 0.1}s ease-out`,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
              }}
            >
              <div style={{ fontWeight: 700 }}>{v.word} — <span style={{ fontWeight: 400, color: '#666' }}>{v.meaning}</span></div>
              <ul style={{ marginTop: 8, marginLeft: 18 }}>{v.examples.map((ex,j) => <li key={j}>{ex}</li>)}</ul>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, animation: 'fadeIn 1.2s ease-out' }}>
          <button 
            onClick={() => setScreen('quiz')} 
            style={{ 
              padding: '10px 16px', 
              borderRadius: 12, 
              background: '#0EA5A4', 
              color: '#fff', 
              border: 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 165, 164, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Continue to Quiz →
            <Sparkles count={2} />
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'quiz') {
    const firstTryPct = computeFirstTryScore();
    const passed = firstTryPct >= 80;
    return (
      <div style={styles.container}>
        <style>{globalStyles}</style>
        <button 
          onClick={() => setScreen('home')} 
          style={{ 
            position: 'absolute', 
            left: 20, 
            top: 20, 
            border: 'none', 
            background: 'transparent', 
            color: '#1E88E5',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-3px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          ← Back to Main Page
        </button>
        <h2 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Quiz — Practice</h2>
        <p style={{ animation: 'fadeIn 0.8s ease-out' }}>Your score on first try: <strong>{firstTryPct}%</strong></p>
        <div style={{ marginTop: 12, width: '100%', maxWidth: 720 }}>
          {quizItems.map((q, qi) => (
            <div 
              key={q.id} 
              style={{ 
                padding: 12, 
                borderRadius: 12, 
                background: '#fff', 
                marginBottom: 12, 
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                animation: `fadeIn ${0.5 + qi * 0.1}s ease-out`
              }}
            >
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
                    <button 
                      key={ci} 
                      onClick={() => submitAnswer(qi, ci)} 
                      style={{ 
                        background: bg, 
                        padding: 10, 
                        borderRadius: 8, 
                        border: 'none', 
                        textAlign: 'left',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#E7E7E8';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = '#F7F7F8';
                      }}
                    >
                      {c.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, animation: 'fadeIn 1.2s ease-out' }}>
          {!passed && (
            <div style={{ textAlign: 'right', maxWidth: 360 }}>
              <div style={{ marginBottom: 8, color: '#333' }}>You scored <strong>{firstTryPct}%</strong> on first try — try again to reach 80% or higher.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button 
                  onClick={retakeQuiz} 
                  style={{ 
                    padding: '10px 16px', 
                    borderRadius: 12, 
                    background: '#F97316', 
                    color: '#fff', 
                    border: 'none',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(249, 115, 22, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Retake Quiz
                </button>
              </div>
            </div>
          )}
          {passed && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => { 
                  setShowConfetti(true); 
                  tts.speak('Congratulations!'); 
                  setTimeout(() => setShowConfetti(false), 3000); 
                  setTimeout(() => setScreen('story'), 800); 
                }} 
                style={{ 
                  padding: '10px 16px', 
                  borderRadius: 12, 
                  background: '#10B981', 
                  color: '#fff', 
                  border: 'none',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Continue →
                <Sparkles count={3} />
              </button>
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
        <style>{globalStyles}</style>
        <button 
          onClick={() => setScreen('home')} 
          style={{ 
            position: 'absolute', 
            left: 20, 
            top: 20, 
            border: 'none', 
            background: 'transparent', 
            color: '#1E88E5',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(-3px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
        >
          ← Back to Main Page
        </button>
        <h2 style={{...styles.title, animation: 'fadeIn 0.6s ease-out'}}>Episode {currentEpisode} — Story</h2>
        <div style={{ 
          marginTop: 12, 
          padding: 16, 
          borderRadius: 12, 
          background: '#F8FAFC', 
          maxWidth: 720,
          animation: 'fadeIn 0.8s ease-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }}>
          {sceneText}
        </div>
        <div style={{ marginTop: 16, animation: 'fadeIn 1s ease-out' }}>
          <p><strong>Cliffhanger:</strong> The episode ends with an unexpected call — someone knows more about your past.</p>
          <div style={{ marginTop: 12 }}>
            <button 
              onClick={() => finishEpisode(currentEpisode)} 
              style={{ 
                padding: '10px 14px', 
                borderRadius: 10, 
                border: 'none', 
                background: '#10B981', 
                color: '#fff',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Finish Episode
              <Sparkles count={2} />
            </button>
          </div>
        </div>
        {showConfetti && <Confetti />}
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
    background: 'linear-gradient(to bottom right, #F0FBF6, #E6F7FF)', 
    minHeight: '100vh', 
    fontFamily: 'Inter, Arial, sans-serif', 
    color: '#0F172A' 
  },
  title: { 
    fontSize: 28, 
    fontWeight: 700, 
    marginBottom: 16, 
    color: '#052662' 
  },
  subTitle: { 
    fontSize: 18, 
    fontWeight: 600, 
    marginBottom: 8, 
    color: '#334155' 
  },
  input: { 
    padding: 12, 
    borderRadius: 12, 
    border: '1px solid #D1D5DB', 
    width: '60%', 
    marginBottom: 20, 
    textAlign: 'center', 
    boxShadow: '0 4px 12px rgba(2,6,23,0.06)',
    fontSize: 16
  },
  avatarLayout: { 
    display: 'flex', 
    width: '90%', 
    gap: 20, 
    background: '#FFFFFF', 
    borderRadius: 18, 
    padding: 20, 
    boxShadow: '0 6px 18px rgba(2,6,23,0.06)' 
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
    borderRadius: 12, 
    cursor: 'pointer', 
    fontSize: 15, 
    fontWeight: 600 
  },
  optionPanel: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    alignItems: 'center', 
    width: '74%', 
    gap: 12 
  },
  optionButton: { 
    border: 'none', 
    padding: '10px 14px', 
    borderRadius: 12, 
    cursor: 'pointer', 
    fontSize: 15, 
    fontWeight: 600 
  },
  traitLayout: { 
    display: 'flex', 
    width: '90%', 
    gap: 20, 
    marginBottom: 30, 
    background: '#FFFFFF', 
    borderRadius: 18, 
    padding: 16, 
    boxShadow: '0 6px 18px rgba(2,6,23,0.06)' 
  },
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
    boxShadow: '0 6px 16px rgba(30,144,255,0.18)' 
  },
  summaryText: { 
    fontSize: 16, 
    maxWidth: 760, 
    textAlign: 'center', 
    lineHeight: 1.5, 
    marginBottom: 20 
  },
};


