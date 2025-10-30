/**
 * src/components/DialogueWithAnimation.js
 *
 * Example dialogue UI that:
 * - waits for avatar to be loaded
 * - plays a scene-appropriate animation per line using AvatarContext.playAnimation()
 */

import React, { useEffect, useState } from 'react';
import ThreeAvatarViewer from './ThreeAvatarViewer';
import { useAvatar } from '../contexts/AvatarContext';

// simple mapping from emotion/scene => animation clip name
const animationMap = {
  neutral: ['Idle', 'idle'],
  happy: ['Wave', 'Smile', 'happy'],
  sad: ['Sorrow', 'sad'],
  angry: ['Attack', 'Angry'],
  talk: ['Talk', 'Speaking', 'speech'],
  nod: ['Nod', 'HeadNod'],
};

export default function DialogueWithAnimation({ visible, character, lines = [], onClose }) {
  const { loadAvatarFromUrl, generateNPCs, avatar, unloadAvatar, playAnimation, stopAnimations } = useAvatar();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  useEffect(() => {
    if (!visible) {
      unloadAvatar();
      setCurrentIndex(0);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingAvatar(true);
      try {
        if (character?.avatarUrl) {
          await loadAvatarFromUrl(character.avatarUrl, { autoPlayFirstAnimation: true });
        } else if (character?.seed || character?.params) {
          const results = await generateNPCs([{ id: character.id, seed: character.seed, params: character.params }]);
          const url = results?.[0]?.url;
          if (!url) throw new Error('No avatar URL returned from server for character ' + character.id);
          await loadAvatarFromUrl(url, { autoPlayFirstAnimation: true });
        }
        if (!cancelled) setLoadingAvatar(false);
      } catch (err) {
        console.error('Dialogue avatar load failed', err);
        if (!cancelled) setLoadingAvatar(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, character?.avatarUrl, character?.seed]);

  useEffect(() => {
    if (!visible) return;
    const line = lines[currentIndex] || {};
    const emotion = (line.emotion || 'neutral').toLowerCase();

    const candidates = animationMap[emotion] || animationMap['neutral'];
    let played = false;
    for (const name of candidates) {
      const action = playAnimation(name, { loop: false, clampWhenFinished: true });
      if (action) { played = true; break; }
    }
    if (!played) {
      if ((line.text || '').split(/\s+/).length > 3) {
        playAnimation('Talk', { loop: false, clampWhenFinished: true });
      }
    }

    return () => { stopAnimations(); };
  }, [currentIndex, visible]);

  function advance() {
    if (currentIndex + 1 < lines.length) setCurrentIndex(i => i + 1);
    else { if (onClose) onClose(); }
  }

  return (
    <div style={{ display: visible ? 'flex' : 'none', gap: 12, alignItems: 'center', padding: 12, background: 'rgba(10,10,10,0.85)', color: '#fff', borderRadius: 8 }}>
      <div style={{ width: 220, height: 220, position: 'relative' }}>
        <ThreeAvatarViewer avatarUrl={null} visible={visible} />
        {loadingAvatar && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Avatar...</div>}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{character?.name ?? 'NPC'}</div>
        <div style={{ minHeight: 90, display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 18 }}>{lines[currentIndex]?.text ?? ''}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={advance} style={{ padding: '8px 12px', marginRight: 8 }}>{currentIndex + 1 < lines.length ? 'Next' : 'Close'}</button>
          <button onClick={() => { setCurrentIndex(lines.length - 1); if (onClose) onClose(); }} style={{ padding: '8px 12px' }}>Skip</button>
        </div>
      </div>
    </div>
  );
}