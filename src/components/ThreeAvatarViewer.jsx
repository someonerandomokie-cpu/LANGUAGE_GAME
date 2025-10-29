import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const CAMERA_POSITIONS = {
  center: { x: 0, y: 1.5, z: 2.5 },
  left:   { x: -1.2, y: 1.5, z: 2.5 },
  right:  { x: 1.2, y: 1.5, z: 2.5 }
};

export default function ThreeAvatarViewer({ avatarUrl, position = 'center', style = {} }) {
  const mountRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const cameraRef = useRef();
  const avatarRef = useRef();
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    if (!avatarUrl) return;
    // Init scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Camera
    const camPos = CAMERA_POSITIONS[position] || CAMERA_POSITIONS.center;
    const camera = new THREE.PerspectiveCamera(45, 0.75, 0.1, 100);
    camera.position.set(camPos.x, camPos.y, camPos.z);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(300, 400);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.1);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(0, 10, 10);
    scene.add(dirLight);

    // Load avatar
    const loader = new GLTFLoader();
    loader.load(
      avatarUrl,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child.isMesh) {
            child.material.transparent = true;
            child.material.opacity = 1;
          }
        });
        model.position.set(0, 0, 0);
        model.scale.set(1.2, 1.2, 1.2);
        avatarRef.current = model;
        scene.add(model);
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error('Avatar load error', err);
      }
    );

    // Idle animation
    let frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const t = clockRef.current.getElapsedTime();
      if (avatarRef.current) {
        // Subtle breathing motion
        avatarRef.current.position.y = 0.05 * Math.sin(t * 1.2);
        avatarRef.current.rotation.y = position === 'center' ? 0.1 * Math.sin(t * 0.7) : (position === 'left' ? Math.PI/8 : -Math.PI/8);
      }
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement && mountRef.current)
          mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (sceneRef.current && avatarRef.current) {
        sceneRef.current.remove(avatarRef.current);
      }
    };
  }, [avatarUrl, position]);

  // Inline style for layout
  const baseStyle = {
    width: 300,
    height: 400,
    margin: 'auto',
    display: 'block',
    position: position === 'center' ? 'relative' : 'absolute',
    right: position === 'right' ? '10%' : undefined,
    left: position === 'left' ? '10%' : undefined,
    bottom: position !== 'center' ? 0 : undefined,
    zIndex: position !== 'center' ? 1 : undefined,
    pointerEvents: 'none',
    ...style
  };

  return <div ref={mountRef} style={baseStyle} />;
}
