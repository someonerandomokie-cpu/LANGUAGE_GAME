import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

/*
ChoiceManager component
- Renders a choice object (from useChoiceManager) and handles user selection UI/feedback.
- Props:
  - choice: the choice object (id, type, prompt, options[])
  - onSelect(option): callback invoked when the user picks an option. The parent controls navigation.
  - onClose(): optional — if you want to dismiss without selecting.
  - autoContinueDelay: for language_check feedback delay (ms)
*/

function OptionButton({ text, onClick, style = {}, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        border: 'none',
        background: '#F0F9FF',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        fontWeight: 600,
        ...style
      }}
    >
      {text}
    </button>
  );
}

export default function ChoiceManager({ choice, onSelect, onClose, autoContinueDelay = 900 }) {
  const [feedback, setFeedback] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // reset when new choice appears
    setFeedback(null);
    setLocked(false);
  }, [choice?.id]);

  const handlePick = useCallback(async (opt) => {
    if (!choice || locked) return;
    // Lock UI to avoid double-clicks
    setLocked(true);

    if (choice.type === 'language_check') {
      const correct = !!opt.isCorrect;
      if (correct) {
        setFeedback({ type: 'success', text: '✅ Good! That’s correct.' });
      } else {
        setFeedback({ type: 'error', text: 'That means something else — keep trying!' });
      }
      // Give a short delay so feedback is perceived, then notify parent
      setTimeout(() => {
        try {
          onSelect && onSelect(opt, { choice });
        } catch (e) {}
        setLocked(false);
      }, autoContinueDelay);
      return;
    }

    // For light/major, provide instant micro-feedback (minor animation placeholder)
    if (choice.type === 'light') {
      setFeedback({ type: 'neutral', text: 'You respond...' });
      try { onSelect && onSelect(opt, { choice }); } catch (e) {}
      setLocked(false);
      return;
    }

    if (choice.type === 'major') {
      setFeedback({ type: 'neutral', text: 'The choice will change the story...' });
      try { onSelect && onSelect(opt, { choice }); } catch (e) {}
      setLocked(false);
      return;
    }

    // default fallback
    try { onSelect && onSelect(opt, { choice }); } catch (e) {}
    setLocked(false);
  }, [choice, locked, onSelect, autoContinueDelay]);

  if (!choice) return null;

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{choice.prompt}</div>
      <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        {choice.options.map((opt, i) => (
          <OptionButton
            key={`opt_${i}`}
            text={opt.text}
            onClick={() => handlePick(opt)}
            disabled={locked}
            style={{ background: (feedback && opt.isCorrect && feedback.type === 'success') ? 'linear-gradient(135deg,#4caf50 0%,#34c759 100%)' : undefined }}
          />
        ))}
      </div>

      {feedback && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: feedback.type === 'success' ? '#ECFDF5' : feedback.type === 'error' ? '#FEF3F2' : '#F8FAFC', color: feedback.type === 'success' ? '#065f46' : feedback.type === 'error' ? '#7f1d1d' : '#0f172a' }}>
          {feedback.text}
        </div>
      )}

      {onClose && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => onClose()} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#64748B', cursor: 'pointer' }}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

ChoiceManager.propTypes = {
  choice: PropTypes.object,
  onSelect: PropTypes.func,
  onClose: PropTypes.func,
  autoContinueDelay: PropTypes.number
};