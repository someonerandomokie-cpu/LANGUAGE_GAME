/** 
 * src/contexts/AvatarContext.js
 *
 * Extended AvatarContext for three.js + Ready Player Me avatars.
 * - loadAvatarFromUrl(url): loads GLB into memory (uses three / GLTFLoader lazily)
 * - unloadAvatar(): disposes resources
 * - generateNPCs(): POSTs to /api/rpm/export-batch (server-side) to generate NPC GLBs
 * - playAnimation(name, { loop }) : attempt to play an animation clip by name on the current avatar
 * - stopAnimations(): stop currently playing actions
 *
 * NOTE: This file is an updated replacement for the AvatarContext you already have.
 * Keep API keys server-side (server handles RPM export). This client does not contain secrets.
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { glbToPng, preferImageUrl } from '../utils/avatarUtils.js';

const AvatarContext = createContext(null);

export function AvatarProvider({ children }) {
  // Three.js avatar payload (when loaded via loadAvatarFromUrl)
  const [avatar, setAvatar] = useState(null); // { url, scene, animations, metadata }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Unified URL state for player and buddy, plus NPC cache
  const [avatarUrl, setAvatarUrl] = useState('');
  const [buddyUrl, setBuddyUrlState] = useState('');
  const [avatarPngUrl, setAvatarPngUrl] = useState('');
  const [npcAvatars, setNpcAvatars] = useState({}); // { [idOrName]: url }

  // LocalStorage keys (standardized)
  const LS_KEYS = {
    avatarUrl: 'lg.avatarUrl',
    avatarPngUrl: 'lg.avatarPngUrl',
    buddyUrl: 'lg.buddyUrl',
    npc: 'lg.npcAvatars',
    // legacy keys to migrate from
    legacy: ['rpm_avatar_url', 'langvoyage_user_avatar_url', 'langvoyage_avatar']
  };

  // On mount, load and migrate any persisted values
  useEffect(() => {
    try {
      // Migrate legacy avatar keys
      const legacy = LS_KEYS.legacy.map(k => {
        try { return localStorage.getItem(k); } catch { return null; }
      }).find(Boolean);
      const storedAvatar = (localStorage.getItem(LS_KEYS.avatarUrl) || legacy || '').trim();
      if (storedAvatar) {
        setAvatarUrl(storedAvatar);
        if (legacy && !localStorage.getItem(LS_KEYS.avatarUrl)) {
          try { localStorage.setItem(LS_KEYS.avatarUrl, storedAvatar); } catch {}
        }
        const storedPng = (localStorage.getItem(LS_KEYS.avatarPngUrl) || '').trim();
        const derived = storedPng || glbToPng(storedAvatar) || '';
        if (derived) setAvatarPngUrl(derived);
      }
      const storedBuddy = (localStorage.getItem(LS_KEYS.buddyUrl) || '').trim();
      if (storedBuddy) setBuddyUrlState(storedBuddy);
      const storedNpc = localStorage.getItem(LS_KEYS.npc);
      if (storedNpc) {
        try {
          const raw = JSON.parse(storedNpc) || {};
          const normalized = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, preferImageUrl(v) || v]));
          setNpcAvatars(normalized);
          try { localStorage.setItem(LS_KEYS.npc, JSON.stringify(normalized)); } catch {}
        } catch { setNpcAvatars({}); }
      }
    } catch {}
  }, []);

  // internal refs for THREE, loader, mixer and lastScene
  const threeRefs = useRef({
    THREE: null,
    GLTFLoader: null,
    mixer: null,
    lastScene: null,
    actions: [], // active actions
  });

  // lazy-load three & loader
  const ensureThreeAndLoader = useCallback(async () => {
    if (threeRefs.current.THREE && threeRefs.current.GLTFLoader) return threeRefs.current;
    const [{ default: THREE }, { GLTFLoader }] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]);
    threeRefs.current.THREE = THREE;
    threeRefs.current.GLTFLoader = GLTFLoader;
    return threeRefs.current;
  }, []);

  const disposeThreeScene = (root) => {
    if (!root) return;
    try {
      root.traverse((obj) => {
        if (!obj) return;
        if (obj.geometry) {
          try { obj.geometry.dispose(); } catch (_) {}
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (!m) return;
            try {
              for (const k in m) {
                const v = m[k];
                if (v && v.isTexture) try { v.dispose(); } catch { }
              }
              if (typeof m.dispose === 'function') m.dispose();
            } catch (_) {}
          });
        }
        if (obj.parent) {
          try { obj.parent.remove(obj); } catch (_) {}
        }
      });
    } catch (_) {}
  };

  // load avatar from URL (GLB/GLTF)
  const loadAvatarFromUrl = useCallback(async (url, { autoPlayFirstAnimation = true, scale = 1.0 } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { THREE, GLTFLoader } = await ensureThreeAndLoader();

      // dispose previous
      if (threeRefs.current.lastScene) {
        disposeThreeScene(threeRefs.current.lastScene);
        threeRefs.current.lastScene = null;
      }
      if (threeRefs.current.mixer) {
        try {
          threeRefs.current.mixer.stopAllAction();
        } catch (_) {}
        threeRefs.current.mixer = null;
        threeRefs.current.actions = [];
      }

      const loader = new GLTFLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.load(url, (g) => resolve(g), undefined, (err) => reject(err));
      });

      const root = gltf.scene || gltf.scenes?.[0];
      if (!root) throw new Error('GLTF has no scene');

      // normalize
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(scale);

      // animations
      let mixer = null;
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(root);
        if (autoPlayFirstAnimation) {
          const action = mixer.clipAction(gltf.animations[0]);
          action.reset().play();
          threeRefs.current.actions = [action];
        }
      }

      threeRefs.current.mixer = mixer;
      threeRefs.current.lastScene = root;

      setAvatar({
        url,
        scene: root,
        animations: gltf.animations || [],
        metadata: gltf.userData || {},
      });
      // Also reflect URL in the simple string state for general UI usage
      try {
        setAvatarUrl(url);
        localStorage.setItem(LS_KEYS.avatarUrl, url);
        const imgUrl = preferImageUrl(url) || '';
        setAvatarPngUrl(imgUrl);
        if (imgUrl) localStorage.setItem(LS_KEYS.avatarPngUrl, imgUrl);
      } catch {}

      setLoading(false);
      return { scene: root, animations: gltf.animations || [], mixer };
    } catch (err) {
      console.error('loadAvatarFromUrl error', err);
      setError(err);
      setAvatar(null);
      setLoading(false);
      throw err;
    }
  }, [ensureThreeAndLoader]);

  const unloadAvatar = useCallback(() => {
    if (threeRefs.current.lastScene) {
      disposeThreeScene(threeRefs.current.lastScene);
      threeRefs.current.lastScene = null;
    }
    if (threeRefs.current.mixer) {
      try { threeRefs.current.mixer.stopAllAction(); } catch (_) {}
      threeRefs.current.mixer = null;
      threeRefs.current.actions = [];
    }
    setAvatar(null);
    setLoading(false);
    setError(null);
  }, []);

  // server-driven batch NPC generation (POST /api/rpm/export-batch)
  const generateNPCs = useCallback(async (characters = []) => {
    if (!Array.isArray(characters) || characters.length === 0) return [];
    const res = await fetch('/api/rpm/export-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characters }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('generateNPCs failed: ' + txt);
    }
    return res.json(); // expected [{ characterId, url, metadata }, ...]
  }, []);

  // PLAY animation by clip name (client-side). If clip not found, no-op.
  const playAnimation = useCallback((clipName, { loop = false, clampWhenFinished = false } = {}) => {
    try {
      const mixer = threeRefs.current.mixer;
      const root = threeRefs.current.lastScene;
      const anims = avatar?.animations || [];
      if (!mixer || !root || !anims.length) return null;

      // find clip by name (or fuzzy match)
      let clip = anims.find((c) => c.name === clipName);
      if (!clip) {
        // try case-insensitive or partial match
        clip = anims.find((c) => c.name.toLowerCase().includes((clipName || '').toLowerCase()));
      }
      if (!clip) return null;

      // stop existing actions optionally
      threeRefs.current.actions.forEach(a => {
        try { a.stop(); } catch (_) {}
      });
      threeRefs.current.actions = [];

      const action = mixer.clipAction(clip);
      action.reset();
      if (!loop) {
        action.setLoop(threeRefs.current.THREE?.LoopOnce ?? 2201, 0);
        if (clampWhenFinished) action.clampWhenFinished = true;
      } else {
        action.setLoop(threeRefs.current.THREE?.LoopRepeat ?? 2202, Infinity);
      }
      action.play();
      threeRefs.current.actions.push(action);
      return action;
    } catch (err) {
      console.warn('playAnimation error', err);
      return null;
    }
  }, [avatar]);

  const stopAnimations = useCallback(() => {
    try {
      threeRefs.current.actions.forEach(a => { try { a.stop(); } catch (_) {} });
      threeRefs.current.actions = [];
      if (threeRefs.current.mixer) {
        try { threeRefs.current.mixer.stopAllAction(); } catch (_) {}
      }
    } catch (_) {}
  }, []);

  const cloneAvatarScene = useCallback(() => {
    const root = threeRefs.current.lastScene;
    if (!root) return null;
    // shallow/normal clone; note skinning/bones can be tricky when cloning
    return root.clone(true);
  }, []);

  const value = {
    avatar,
    loading,
    error,
    // simple URL state for broader app usage
    avatarUrl,
    avatarPngUrl,
    buddyUrl,
    npcAvatars,
    // persistence helpers
    saveAvatar: (url, { userId } = {}) => {
      try {
        const safeUrl = url || '';
        const imgUrl = preferImageUrl(safeUrl) || '';

        setAvatarUrl(safeUrl);
        setAvatarPngUrl(imgUrl);
        try {
          localStorage.setItem(LS_KEYS.avatarUrl, safeUrl);
          localStorage.setItem(LS_KEYS.avatarPngUrl, imgUrl);
        } catch {}
        // Optionally persist to backend if userId provided
        if (userId) {
          fetch('/api/save-avatar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, avatarUrl: safeUrl })
          }).catch(() => {});
        }
      } catch {}
    },
    setBuddyUrl: (url, { persist = true, buddyId = 'buddy_001' } = {}) => {
      try {
        setBuddyUrlState(url || '');
        if (persist) {
          try { localStorage.setItem(LS_KEYS.buddyUrl, url || ''); } catch {}
          // save buddy on backend with fixed id
          fetch('/api/save-avatar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: buddyId, avatarUrl: url })
          }).catch(() => {});
        }
      } catch {}
    },
    setNpcAvatar: (key, url) => {
      try {
        const norm = (key || '').trim().toLowerCase();
        const preferred = preferImageUrl(url) || '';
        setNpcAvatars(prev => {
          const next = { ...(prev || {}) };
          // store both the original key and the normalized key for robust lookups
          if (key) next[key] = preferred;
          if (norm) next[norm] = preferred;
          try { localStorage.setItem(LS_KEYS.npc, JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {}
    },
    loadFromStorage: () => {
      try {
        const a = localStorage.getItem(LS_KEYS.avatarUrl);
        const b = localStorage.getItem(LS_KEYS.buddyUrl);
        const n = localStorage.getItem(LS_KEYS.npc);
        if (a) {
          setAvatarUrl(a);
          const ap = (localStorage.getItem(LS_KEYS.avatarPngUrl) || '').trim();
          const derived = ap || preferImageUrl(a) || '';
          if (derived) setAvatarPngUrl(derived);
        }
        if (b) setBuddyUrlState(b);
        if (n) {
          try {
            const raw = JSON.parse(n) || {};
            const normalized = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, preferImageUrl(v) || v]));
            setNpcAvatars(normalized);
            try { localStorage.setItem(LS_KEYS.npc, JSON.stringify(normalized)); } catch {}
          } catch {}
        }
      } catch {}
    },
    loadAvatarFromUrl,
    unloadAvatar,
    generateNPCs,
    playAnimation,
    stopAnimations,
    cloneAvatarScene,
  };

  return <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>;
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('useAvatar must be used inside AvatarProvider');
  return ctx;
}