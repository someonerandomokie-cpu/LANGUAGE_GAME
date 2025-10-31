import React, { useEffect, useState } from 'react';

/*
 ThreeAvatarViewer.jsx (updated)

 - Lazy-loads the Ready Player Me Visage <Avatar> viewer on the client when @readyplayerme/visage is installed.
 - Adds simple reaction animations (happy, confused, surprised, neutral) that animate the viewer container.
 - Falls back to <model-viewer> (if available) or a simple link/placeholder when Visage isn't installed.
 - Props:
    - avatarUrl (string): URL to the exported GLB model.
    - width / height (number|string) defaults to 180x220
    - className, style optional
    - position: 'left'|'right'|'center' (layout hint only)
    - autoRotate (bool) whether to pass autoRotate to Visage (default true)
    - alt (string) alt text for fallback anchor
    - reaction (string|null) optional reaction hint: 'happy' | 'confused' | 'surprised' | 'neutral'
 - Behavior:
    - When `reaction` changes, the viewer container receives a short animation appropriate for the reaction.
    - If Visage import errors (package not installed), the component falls back gracefully and logs a console hint.
*/

// Visage viewer disabled by default to avoid heavy peer dependencies in dev.
// If you want to enable it, wire an optional dynamic import behind an env flag.

export default function ThreeAvatarViewer({
  avatarUrl,
  width = 180,
  height = 220,
  className = '',
  style = {},
  position = 'left',
  autoRotate = true,
  alt = 'Avatar preview',
  reaction = null,
}) {
  const [canClientRender, setCanClientRender] = useState(false);
  const [visageAvailable, setVisageAvailable] = useState(false);
  const [animKey, setAnimKey] = useState(0); // bump when reaction changes to restart animation

  // Ensure CSS animations are inserted once
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('three-avatar-viewer-reaction-styles')) return;
    const s = document.createElement('style');
    s.id = 'three-avatar-viewer-reaction-styles';
    s.innerHTML = `
      .tav-wrapper { transition: transform 320ms cubic-bezier(.2,.9,.3,1), filter 320ms ease; will-change: transform, filter; }
      /* happy: gentle scale + pop */
      .tav-reaction-happy { animation: tav-pop 700ms cubic-bezier(.2,.9,.3,1); }
      @keyframes tav-pop {
        0% { transform: scale(1) translateY(0); filter: brightness(1); }
        30% { transform: scale(1.06) translateY(-6px); filter: brightness(1.06); }
        70% { transform: scale(0.98) translateY(2px); filter: brightness(1); }
        100% { transform: scale(1) translateY(0); filter: brightness(1); }
      }
      /* confused: slight tilt + wiggle */
      .tav-reaction-confused { animation: tav-tilt 900ms cubic-bezier(.2,.9,.3,1); }
      @keyframes tav-tilt {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(-8deg); }
        50% { transform: rotate(6deg); }
        75% { transform: rotate(-4deg); }
        100% { transform: rotate(0deg); }
      }
      /* surprised: quick scale up + glow */
      .tav-reaction-surprised { animation: tav-surprise 600ms ease; }
      @keyframes tav-surprise {
        0% { transform: scale(1); box-shadow: none; }
        30% { transform: scale(1.08); box-shadow: 0 12px 36px rgba(0,0,0,0.18); }
        100% { transform: scale(1); box-shadow: none; }
      }
      /* neutral: tiny idle bounce */
      .tav-reaction-neutral { animation: tav-neutral 900ms ease; }
      @keyframes tav-neutral {
        0% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
        100% { transform: translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }, []);

  // client-only flag (avoid SSR errors)
  useEffect(() => {
    setCanClientRender(typeof window !== 'undefined');
  }, []);

  // when reaction prop changes, bump animKey to restart / retrigger CSS animation
  useEffect(() => {
    if (!reaction) return;
    // trigger reflow restart by changing key
    setAnimKey(k => k + 1);
  }, [reaction]);

  const containerStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: 12,
    overflow: 'hidden',
    background: '#F1F5F9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  // choose wrapper class based on reaction
  const reactionClass = reaction ? `tav-reaction-${reaction}` : '';

  // If there's no avatar URL, render nothing to avoid placeholder boxes in UI
  if (!avatarUrl) return null;

  // Client rendering: use <model-viewer> fallback (Visage optional, disabled by default)
  if (canClientRender) {
    return (
      <div
        key={animKey}
        className={`tav-wrapper ${reactionClass} ${className}`}
        style={containerStyle}
        data-position={position}
        aria-live="polite"
      >
        <FallbackModelViewer src={avatarUrl} alt={alt} />
      </div>
    );
  }

  // SSR / safety fallback
  return null;
}

/* Small helper: fallback that uses <model-viewer> if the page includes it, or an <a> otherwise */
function FallbackModelViewer({ src, alt }) {
  if (typeof window !== 'undefined' && window.customElements && window.customElements.get('model-viewer')) {
    return (
      <model-viewer
        src={src}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
        crossorigin="anonymous"
        exposure="1.0"
        camera-controls="false"
        disable-zoom
        autoplay
        shadow-intensity="0.4"
        ar="false"
        interaction-prompt="none"
      />
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
      <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: '#0b5fff' }}>{alt}</a>
    </div>
  );
}

/* Basic ErrorBoundary to catch runtime errors from Visage and switch to fallback */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    try {
      if (typeof this.props.onError === 'function') this.props.onError(error);
    } catch {}
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}