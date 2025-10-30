import { useCallback, useEffect, useRef, useState } from 'react';

/*
useChoiceManager
- Lightweight choice generator and manager for dialogue.
- API:
  const { activeChoice, maybeInsertChoice, forceInsertChoice, clearActiveChoice, recordLanguageCheckResult, stats } = useChoiceManager({ dialogue, genre, language, vocab, userName });
- maybeInsertChoice(lineIndex, dlg) -> boolean (true if a choice was generated)
- activeChoice: the currently active choice object or null
- clearActiveChoice() clears the active choice (call after handling)
- recordLanguageCheckResult(correct) will update local stats & persist to localStorage
- stats: aggregated stats (language checks correct/total)
*/

const STORAGE_KEY = 'langvoyage_choice_stats_v1';

function makeId(prefix = 'c') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { languageChecks: { correct: 0, total: 0 }, history: [] };
    return JSON.parse(raw);
  } catch {
    return { languageChecks: { correct: 0, total: 0 }, history: [] };
  }
}
function saveStats(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

export function useChoiceManager({ dialogue = [], genre = '', language = '', vocab = [], userName = '' } = {}) {
  const [activeChoice, setActiveChoice] = useState(null);
  const lastChoiceAtRef = useRef(-999);
  const statsRef = useRef(loadStats());
  const [stats, setStats] = useState(statsRef.current);

  useEffect(() => { saveStats(statsRef.current); setStats({ ...statsRef.current }); }, []);

  const isUserSpeaker = useCallback((speaker) => {
    if (!speaker) return false;
    const n = (speaker || '').trim().toLowerCase();
    const user = (userName || '').trim().toLowerCase() || 'you';
    return n === user || n === 'you' || n === 'player' || n === 'protagonist';
  }, [userName]);

  const clearActiveChoice = useCallback(() => {
    setActiveChoice(null);
  }, []);

  const recordLanguageCheckResult = useCallback((correct, meta = {}) => {
    try {
      const s = statsRef.current;
      s.languageChecks.total = (s.languageChecks.total || 0) + 1;
      if (correct) s.languageChecks.correct = (s.languageChecks.correct || 0) + 1;
      s.history = s.history || [];
      s.history.push({ time: Date.now(), correct: !!correct, meta });
      statsRef.current = s;
      saveStats(s);
      setStats({ ...s });
    } catch {}
  }, []);

  // Helpers to build choices
  function pickVocabRelevantToText(text) {
    if (!vocab || vocab.length === 0) return null;
    const t = (text || '').toLowerCase();
    // try to find a vocab word that appears in the text
    let found = vocab.find(v => v.word && t.indexOf((v.word || '').toLowerCase()) !== -1);
    if (found) return found;
    // fallback: random
    const i = Math.floor(Math.random() * vocab.length);
    return vocab[i];
  }

  function makeLightChoice(dlg, idx) {
    const prompt = dlg && dlg.speaker ? `${dlg.speaker} awaits your reply:` : 'How do you respond?';
    // Simple context-aware templates using punctuation
    const hasQ = dlg && typeof dlg.text === 'string' && dlg.text.includes('?');
    const options = hasQ ? [
      { text: 'Answer directly', nextDelta: 1 },
      { text: 'Ask for clarification', nextDelta: 1 },
      { text: 'Reply with a friendly joke', nextDelta: 1 }
    ] : [
      { text: 'Agree and continue', nextDelta: 1 },
      { text: 'Respond with curiosity', nextDelta: 1 },
      { text: 'Stay quiet and listen', nextDelta: 1 }
    ];
    return {
      id: makeId('light'),
      type: 'light',
      prompt,
      options
    };
  }

  function makeMajorChoice(dlg, idx) {
    // These options steer the plot. Provide nextDelta hints which App may interpret as page jumps.
    const prompt = dlg && dlg.speaker ? `${dlg.speaker} asks you to decide:` : 'Make a decisive choice:';
    const opts = [
      { text: 'Investigate further', effect: { tone: 'bold' }, nextDelta: 2 },
      { text: 'Avoid the risk and retreat', effect: { tone: 'cautious' }, nextDelta: 3 },
      { text: 'Seek help from a friend', effect: { tone: 'friendly' }, nextDelta: 2 }
    ];
    return {
      id: makeId('major'),
      type: 'major',
      prompt,
      options: opts
    };
  }

  function makeLanguageCheckChoice(dlg, idx) {
    // Pick a vocab word; present two short options in the target language (one correct, one distractor)
    const target = pickVocabRelevantToText(dlg?.text) || (vocab.length ? vocab[Math.floor(Math.random() * vocab.length)] : null);
    if (!target) {
      // fallback to a light choice if no vocab
      return makeLightChoice(dlg, idx);
    }
    // pick distractor (different word)
    const pool = vocab.filter(v => v.word !== target.word);
    const distractor = pool.length ? pool[Math.floor(Math.random() * pool.length)] : { word: `${target.word}_alt` };

    // We'll ask: "Which word matches: <meaning> ?" and show two target-language words
    const prompt = `Which of these matches "${target.meaning}"?`;
    const options = [
      { text: target.word, isCorrect: true, nextDelta: 1 },
      { text: distractor.word, isCorrect: false, nextDelta: 1 }
    ];
    // Randomize order
    if (Math.random() > 0.5) options.reverse();
    return {
      id: makeId('lang'),
      type: 'language_check',
      prompt,
      options,
      meta: { targetWord: target.word, meaning: target.meaning }
    };
  }

  const generateChoiceForLine = useCallback((dlg, idx) => {
    // Weighted probabilities and simple rules
    // Avoid language_check if vocab is empty
    const weights = [];
    // prefer light choices
    // weights: light 0.5, major 0.2, language_check 0.3 (only if vocab)
    if (vocab && vocab.length > 0) {
      weights.push({ type: 'light', w: 0.5 }, { type: 'major', w: 0.2 }, { type: 'language_check', w: 0.3 });
    } else {
      weights.push({ type: 'light', w: 0.7 }, { type: 'major', w: 0.3 });
    }
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;
    let picked = weights.find(w => {
      if (r < w.w) return true;
      r -= w.w; return false;
    })?.type || 'light';

    if (picked === 'light') return makeLightChoice(dlg, idx);
    if (picked === 'major') return makeMajorChoice(dlg, idx);
    return makeLanguageCheckChoice(dlg, idx);
  }, [vocab]);

  const maybeInsertChoice = useCallback((lineIndex, dlg) => {
    try {
      // Defensive checks
      if (!dlg) return false;
      if (activeChoice) return false;
      // Do not insert if the user is speaking
      if (isUserSpeaker(dlg.speaker)) return false;
      // Do not insert too often
      if (lineIndex - lastChoiceAtRef.current < 4) return false;
      // Basic randomness: ~20% chance
      if (Math.random() >= 0.2) return false;

      const c = generateChoiceForLine(dlg, lineIndex);
      // attach source info
      c.sourceIndex = lineIndex;
      c.sourceLine = dlg.text;
      setActiveChoice(c);
      lastChoiceAtRef.current = lineIndex;
      return true;
    } catch (e) {
      console.warn('maybeInsertChoice failed', e);
      return false;
    }
  }, [activeChoice, generateChoiceForLine, isUserSpeaker]);

  // For external callers that want to "force" inserting a choice at index
  const forceInsertChoice = useCallback((lineIndex, dlg, kind = null) => {
    try {
      if (!dlg) return false;
      if (activeChoice) return false;
      let c;
      if (kind === 'light') c = makeLightChoice(dlg, lineIndex);
      else if (kind === 'major') c = makeMajorChoice(dlg, lineIndex);
      else if (kind === 'language_check') c = makeLanguageCheckChoice(dlg, lineIndex);
      else c = generateChoiceForLine(dlg, lineIndex);
      c.sourceIndex = lineIndex;
      c.sourceLine = dlg.text;
      setActiveChoice(c);
      lastChoiceAtRef.current = lineIndex;
      return true;
    } catch (e) {
      return false;
    }
  }, [activeChoice, generateChoiceForLine]);

  // Expose a helper to report stats (useful for UI)
  const getStats = useCallback(() => statsRef.current, []);

  return {
    activeChoice,
    maybeInsertChoice,
    forceInsertChoice,
    clearActiveChoice,
    recordLanguageCheckResult,
    stats: statsRef.current,
    getStats
  };
}

export default useChoiceManager;