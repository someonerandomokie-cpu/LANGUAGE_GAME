/**
 * src/components/AvatarCreator.js
 *
 * Client-side component to open Ready Player Me Creator and capture exported avatar URL.
 * - Opens RPM Creator in a popup (or modal) and listens for postMessage from readyplayer.me
 * - When avatar exported, saves the URL to server via POST /api/user/save-avatar
 * - Loads the avatar into AvatarContext for immediate display
 *
 * Place: src/components/AvatarCreator.js
 *
 * Required server route: POST /api/user/save-avatar { userId, url } -> { ok: true, url }
 * (server/routes/saveAvatar.js provided in this bundle)
 *
 * NOTE: check your Ready Player Me docs for the exact postMessage event format. This code
 * listens for common patterns (data.eventName === 'avatarExported' or data.url)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAvatar } from '../contexts/AvatarContext';

export default function AvatarCreator({ userId, className = '' }) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef(null);
  const { loadAvatarFromUrl } = useAvatar();

  const openCreator = useCallback(() => {
    const url = 'https://creator.readyplayer.me/';
    const w = 1000, h = 800;
    const left = (window.screen.width / 2) - (w / 2);
    const top = (window.screen.height / 2) - (h / 2);
    popupRef.current = window.open(url, 'rpm_creator', `width=${w},height=${h},left=${left},top=${top}`);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onMessage(e) {
      try {
        const origin = e.origin || '';
        if (!origin.includes('readyplayer.me') && !origin.includes('readyplayer.me')) { return; }
        const data = e.data || {};
        const avatarUrl = data?.url || (data?.detail && data.detail?.url) || null;
        if (avatarUrl) {
          fetch('/api/user/save-avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, url: avatarUrl }),
          }).then(async (res) => {
            if (!res.ok) { console.error('Failed to save avatar on server', await res.text()); }
          }).catch(err => console.error('Save avatar request failed', err));

          loadAvatarFromUrl(avatarUrl, { autoPlayFirstAnimation: true }).catch(err => console.error(err));

          if (popupRef.current) { try { popupRef.current.close(); } catch (_) {} popupRef.current = null; }
          setOpen(false);
        }
      } catch (err) { console.warn('RPM message handling error', err); }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadAvatarFromUrl, userId]);

  return (
    <div className={className}>
      <button onClick={openCreator} style={{ padding: '8px 12px' }}>Create Avatar</button>
      {open && <div style={{ fontSize: 12, color: '#ccc' }}>Creator open in popup; finish to export avatar.</div>}
    </div>
  );
}