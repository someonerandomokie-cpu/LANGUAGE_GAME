import React, { useEffect, useRef } from 'react';

// Minimal placeholder animation shown before story starts
// Props: onComplete?: () => void, durationMs?: number
export default function StoryIntroAnimation({ onComplete, durationMs = 1500 }) {
  const timerRef = useRef(null);
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      try { onComplete && onComplete(); } catch {}
    }, durationMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onComplete, durationMs]);

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#111827 0%, #0f172a 100%)', color: '#fff', zIndex: 9999 }}>
      <div style={{ textAlign: 'center', animation: 'fadeInUp 800ms ease both' }}>
        <h2 style={{ margin: 0, fontSize: 28, letterSpacing: 2 }}>LangVoyage</h2>
        <p style={{ marginTop: 8, opacity: 0.9 }}>Setting the scene…</p>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
