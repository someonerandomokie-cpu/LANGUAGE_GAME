import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import '../styles/scene.css';

// Map top genre to background class and idle motion profile
const GENRE_STYLES = {
  Romance: { className: 'bg-romance', motion: { bobAmp: 0.02, bobSpeed: 1.0, swayAmp: 0.02, swaySpeed: 0.5 } },
  Adventure: { className: 'bg-adventure', motion: { bobAmp: 0.03, bobSpeed: 1.2, swayAmp: 0.03, swaySpeed: 0.7 } },
  Mystery: { className: 'bg-mystery', motion: { bobAmp: 0.015, bobSpeed: 0.8, swayAmp: 0.015, swaySpeed: 0.3 } },
  Comedy: { className: 'bg-comedy', motion: { bobAmp: 0.025, bobSpeed: 1.3, swayAmp: 0.03, swaySpeed: 0.9 } },
  Drama: { className: 'bg-drama', motion: { bobAmp: 0.02, bobSpeed: 0.9, swayAmp: 0.02, swaySpeed: 0.5 } },
  'Sci-Fi': { className: 'bg-scifi', motion: { bobAmp: 0.02, bobSpeed: 1.1, swayAmp: 0.025, swaySpeed: 0.7 } }
};

function splitIntoCues(text, durationSec = 12) {
  if (!text) return [];
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[\.!?])\s+/)
    .filter(Boolean);
  const n = Math.max(1, sentences.length);
  const step = durationSec / n;
  return sentences.map((s, i) => ({ t: i * step, text: s }));
}

export default function CinematicScene({
  avatarUrl,
  genres = [],
  audioUrl = '',
  subtitles = null,
  fallbackSubtitleFromPlot = '',
  onEnded
}) {
  const mountRef = useRef(null);
  const mixerRef = useRef(null); // reserved for future RPM animations
  const modelRootRef = useRef(null);
  const modelGroupRef = useRef(null);
  const rafRef = useRef(0);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const analyserDataRef = useRef(null);
  const mouthTargetsRef = useRef({ mesh: null, dict: null, indices: [] });
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [currentSubtitle, setCurrentSubtitle] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);

  const topGenre = genres && genres.length ? genres[0] : 'Drama';
  const styleCfg = GENRE_STYLES[topGenre] || GENRE_STYLES['Drama'];
  const className = styleCfg.className;
  const motion = styleCfg.motion;

  const cues = useMemo(() => {
    if (subtitles && subtitles.length) return subtitles;
    return splitIntoCues(fallbackSubtitleFromPlot || '', Math.max(8, Math.min(24, Math.floor(audioDuration || 12))));
  }, [subtitles, fallbackSubtitleFromPlot, audioDuration]);

  // Init Three.js scene
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 2.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.8);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 3, 2);
    scene.add(dir);

    // Ground plane (subtle)
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    // Not adding ground into scene since alpha background is used; keep for future
    // scene.add(ground);

    const group = new THREE.Group();
    modelGroupRef.current = group;
    scene.add(group);

    // Load RPM avatar if present
    const loader = new GLTFLoader();
    let cancelled = false;
    if (avatarUrl) {
      loader.load(
        avatarUrl,
        (gltf) => {
          if (cancelled) return;
          const root = gltf.scene || gltf.scenes?.[0];
          if (root) {
            // Normalize scale and center
            root.traverse((o) => {
              if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = false;
              }
            });
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            box.getSize(size);
            const center = new THREE.Vector3();
            box.getCenter(center);
            root.position.sub(center);
            const targetHeight = 1.7;
            const scale = size.y > 0 ? targetHeight / size.y : 1;
            root.scale.setScalar(scale);
            group.add(root);
            modelRootRef.current = root;

            // If GLB has clips, play idle animation
            if (gltf.animations && gltf.animations.length) {
              const mixer = new THREE.AnimationMixer(root);
              mixerRef.current = mixer;
              const clip = gltf.animations[0];
              const action = mixer.clipAction(clip);
              action.loop = THREE.LoopRepeat;
              action.play();
            }

            // Try to find morph targets for mouth (common names)
            let mouthMesh = null;
            let dict = null;
            root.traverse((o) => {
              if (o.isMesh && o.morphTargetDictionary) {
                const keys = Object.keys(o.morphTargetDictionary);
                const candidate = keys.find(k => /mouth|jaw|vowel|aa|oh|ee|open/i.test(k));
                if (candidate) {
                  mouthMesh = o;
                  dict = o.morphTargetDictionary;
                }
              }
            });
            if (mouthMesh && dict) {
              const indices = Object.entries(dict)
                .filter(([k]) => /mouth|jaw|vowel|aa|oh|ee|open/i.test(k))
                .map(([, idx]) => idx);
              mouthTargetsRef.current = { mesh: mouthMesh, dict, indices };
            }
          }
        },
        undefined,
        (err) => {
          console.warn('GLB load error', err);
        }
      );
    }

    // Handle resize
    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener('resize', onResize);

    // Idle animation
    const clock = new THREE.Clock();
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const t = clock.elapsedTime;

      // Advance mixer (if any)
      if (mixerRef.current) {
        try { mixerRef.current.update(delta); } catch {}
      }
      // Subtle bob and sway on the whole group if loaded
      if (group) {
        group.position.y = Math.sin(t * motion.bobSpeed) * motion.bobAmp;
        group.rotation.y = Math.sin(t * motion.swaySpeed) * motion.swayAmp;
      }

      // Audio-reactive mouth movement
      if (analyserRef.current && mouthTargetsRef.current.mesh) {
        try {
          const analyser = analyserRef.current;
          const arr = analyserDataRef.current;
          analyser.getByteFrequencyData(arr);
          let avg = 0; for (let i = 0; i < arr.length; i++) avg += arr[i];
          avg /= arr.length || 1;
          const intensity = Math.min(1, Math.max(0, (avg - 30) / 120));
          const { mesh, indices } = mouthTargetsRef.current;
          indices.forEach((idx) => {
            if (!mesh.morphTargetInfluences) return;
            mesh.morphTargetInfluences[idx] = intensity * 0.7;
          });
        } catch {}
      } else if (modelRootRef.current) {
        // Fallback: subtle head nod when no analyser/morphs available
        try {
          modelRootRef.current.rotation.y = Math.sin(t * 0.2) * 0.1;
        } catch {}
      }
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      try { mount.removeChild(renderer.domElement); } catch {}
      renderer.dispose();
    };
  }, [avatarUrl, motion.bobAmp, motion.bobSpeed, motion.swayAmp, motion.swaySpeed]);

  // Audio setup, analyser, and subtitles sync
  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.preload = 'auto';
    audio.autoplay = true;
    audio.oncanplay = () => {
      setAudioReady(true);
      setAudioDuration(audio.duration || 0);
      // Try autoplay; fallback to user gesture if blocked
      audio.play().catch(() => {
        setAudioError('Tap to play');
      });

      // Create WebAudio analyser for mouth sync
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
        const src = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        src.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
        analyserDataRef.current = dataArray;
      } catch (e) {
        // ignore analyser errors (e.g., autoplay policies)
      }
    };
    audio.onerror = () => setAudioError('Audio failed to load');
    audio.onended = () => { try { onEnded?.(); } catch {} };

    let subIdx = 0;
    const subTimer = setInterval(() => {
      if (!audio || !cues || cues.length === 0) return;
      const ct = audio.currentTime || 0;
      while (subIdx + 1 < cues.length && ct >= cues[subIdx + 1].t) subIdx += 1;
      const active = cues[subIdx];
      if (active) setCurrentSubtitle(active.text);
    }, 100);

    return () => {
      clearInterval(subTimer);
      try { audio.pause(); } catch {}
      audioRef.current = null;
      try { audioContextRef.current?.close(); } catch {}
      audioContextRef.current = null;
      analyserRef.current = null;
      analyserDataRef.current = null;
    };
  }, [audioUrl, cues, onEnded]);

  return (
    <div className={`cinematic-root ${className}`}>
      <div className="cinematic-stage">
        <div className="three-mount" ref={mountRef} />
        {audioError && (
          <button className="audio-unmute" onClick={() => { try { audioRef.current?.play(); setAudioError(''); audioContextRef.current?.resume?.(); } catch {} }}>
            {audioError}
          </button>
        )}
        {currentSubtitle && (
          <div className="subtitles">
            <div className="subtitle-line">{currentSubtitle}</div>
          </div>
        )}
      </div>
    </div>
  );
}
