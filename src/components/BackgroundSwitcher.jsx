import React, { useEffect, useRef, useState } from 'react';

/**
 * BackgroundSwitcher
 * - images: Array<string | { url: string, key?: string }>
 * - activeIndex: number
 * - fadeDuration: milliseconds (default 600)
 *
 * Usage:
 * <BackgroundSwitcher images={backgroundImages} activeIndex={bgActiveIndex} fadeDuration={700} />
 *
 * This component renders fixed-position background layers behind the app and cross-fades between them.
 * It does not mutate document.body so it's safe to use with other code that manipulates body styles.
 */
export default function BackgroundSwitcher({ images = [], activeIndex = 0, fadeDuration = 600 }) {
  // Normalize images to objects: { url, key }
  const imgs = (images || []).map((i, idx) => (typeof i === 'string' ? { url: i, key: `img-${idx}` } : { url: i.url, key: i.key || `img-${idx}` }));

  const [current, setCurrent] = useState(activeIndex >= 0 && activeIndex < imgs.length ? activeIndex : 0);
  const [previous, setPrevious] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const normalized = Math.max(0, Math.min((imgs.length || 1) - 1, activeIndex || 0));
    if (normalized === current) return;

    // start transition
    setPrevious(current);
    setCurrent(normalized);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPrevious(null);
      timeoutRef.current = null;
    }, fadeDuration + 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, imgs.length]);

  // If images array changes, clamp current
  useEffect(() => {
    if (!imgs || imgs.length === 0) {
      setCurrent(0);
      setPrevious(null);
      return;
    }
    if (current >= imgs.length) {
      setCurrent(imgs.length - 1);
    }
  }, [imgs, current]);

  const containerStyle = {
    position: 'fixed',
    inset: 0,
    // Keep background behind content but within the app stacking context
    // A non-negative z-index prevents it from falling behind the document body
    zIndex: 0,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none'
  };

  const layerBase = {
    position: 'absolute',
    inset: 0,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    transition: `opacity ${fadeDuration}ms ease`,
    willChange: 'opacity',
    filter: 'saturate(0.98) contrast(0.95)',
    transform: 'scale(1.10)',
    transformOrigin: 'center center'
  };

  return (
    <>
      <div aria-hidden className="bg-switcher" style={containerStyle}>
        {/* Fallback gradient when there are no images yet */}
        {(!imgs || imgs.length === 0) && (
          <div
            style={{
              ...layerBase,
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              opacity: 1,
              zIndex: 0
            }}
          />
        )}
        {/* Previous layer (fading out) */}
        {previous != null && imgs[previous] && (
          <div
            key={`bg-prev-${imgs[previous].key || previous}`}
            style={{
              ...layerBase,
              backgroundImage: imgs[previous].url ? `url(${imgs[previous].url})` : 'none',
              opacity: 0,
              zIndex: 1
            }}
          />
        )}

        {/* Current layer (fading in) */}
        {imgs[current] && (
          <div
            key={`bg-cur-${imgs[current].key || current}`}
            style={{
              ...layerBase,
              backgroundImage: imgs[current].url ? `url(${imgs[current].url})` : 'none',
              opacity: 1,
              zIndex: 0
            }}
          />
        )}
      </div>
    </>
  );
}