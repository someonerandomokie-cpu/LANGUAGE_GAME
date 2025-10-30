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

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const AvatarContext = createContext(null);

export function AvatarProvider({ children }) {
  const [avatar, setAvatar] = useState(null); // { url, scene, animations, metadata }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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