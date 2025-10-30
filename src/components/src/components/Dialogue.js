/**
 * Dialogue.js
 *
 * React dialogue component that:
 *  - uses AvatarContext (useAvatar) to load an avatar URL or request a server-side RPM export
 *  - displays a ThreeAvatarViewer for the avatar inside the dialogue UI
 *  - waits for the avatar to finish loading before showing the dialogue contents
 */

import React, { useEffect, useState } from 'react';
import ThreeAvatarViewer from './ThreeAvatarViewer';
import { useAvatar } from '../contexts/AvatarContext';

export default function Dialogue({ visible, character, lines = [], onClose }) {
  const { loadAvatarFromUrl, generateNPCs, avatar, unloadAvatar } = useAvatar();
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [error, setError] = useState(null);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const avatarUrl = character?.avatarUrl ?? null;

  useEffect(() => {
    if (!visible) {
      unloadAvatar();
      setCurrentLineIndex(0);
      return;
    }

    let cancelled = false;
    (async () => {
      setError(null);
      try {
        setLoadingAvatar(true);

        if (avatarUrl) {
          await loadAvatarFromUrl(avatarUrl, { autoPlayFirstAnimation: true, scale: 1.0 });
        } else if (character?.seed || character?.params) {
          const results = await generateNPCs([{ id: character.id, seed: character.seed, params: character.params }]);
          const match = results && results[0] && results[0].url;
          if (!match) throw new Error('Server did not return an avatar URL for character ' + character?.id);
          await loadAvatarFromUrl(match, { autoPlayFirstAnimation: true, scale: 1.0 });
        }

        if (!cancelled) setLoadingAvatar(false);
      } catch (err) {
        if (!cancelled) {
          console.error('Dialogue avatar load error', err);
          setError(err);
          setLoadingAvatar(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, character?.avatarUrl, character?.seed]);

  function advanceLine() {
    if (currentLineIndex + 1 < lines.length) {
      setCurrentLineIndex((i) => i + 1);
    } else {
      if (onClose) onClose();
    }
  }

  return (
    <div
      className="dialogue-container"
      style={{ display: visible ? 'flex' : 'none', gap: 12, alignItems: 'center', padding: 12, background: 'rgba(10,10,10,0.75)', color: '#fff', borderRadius: 8 }}
      role="dialog"
      aria-hidden={!visible}
    >
      <div style={{ width: 200, height: 200, flex: '0 0 200px', background: 'transparent' }}>
        <ThreeAvatarViewer avatarUrl={null} visible={visible} />
        {loadingAvatar && (
          <div style={{ position: 'absolute', marginTop: -80, width: 200, textAlign: 'center', color: '#fff' }}>
            Loading avatar...
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', marginTop: -80, width: 200, textAlign: 'center', color: '#f88' }}>
            Avatar failed
          </div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', marginBottom: 6 }}>{character?.name ?? 'Unknown'}</div>
        <div style={{ minHeight: 80, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 16 }}>{lines[currentLineIndex]?.text ?? ''}</div>
        </div>

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button onClick={advanceLine} style={{ padding: '6px 10px' }}>
            {currentLineIndex + 1 < lines.length ? 'Next' : 'Close'}
          </button>
          <button onClick={() => { setCurrentLineIndex(lines.length - 1); if (onClose) onClose(); }} style={{ padding: '6px 10px' }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}