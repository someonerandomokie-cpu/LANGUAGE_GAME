import React, { useMemo, useRef } from "react";
import ThreeAvatarViewer from "./ThreeAvatarViewer.jsx";

/**
 * DialogueScene
 * --------------
 * Displays current dialogue line and manages which 3D avatars appear.
 *
 * Props:
 *  - dialogues: array of { speaker, text, ... }
 *  - index: current dialogue index
 *  - userAvatarUrl: URL of user's Ready Player Me model
 *  - npcAvatars: object mapping NPC name → model URL
 *
 * Behavior:
 *  - The user avatar is always shown on the right side.
 *  - The current NPC (and possibly others that appeared) are on the left.
 *  - When a new NPC name appears for the first time, a new avatar slot is created for them.
 */
export default function DialogueScene({
  dialogues = [],
  index = 0,
  userAvatarUrl = "",
  npcAvatars = {},
  playerName = "",
  mode = "all" // 'all' = show all NPCs seen so far; 'pair' = cinematic two-character (NPC left + player right)
}) {
  const current = dialogues[index] || {};
  const currentSpeaker = current.speaker || "";

  // Determine which NPC is currently speaking
  const currentNpcName = useMemo(() => {
    if (!currentSpeaker) return null;
    // "you" or variants = player
    if (/^(you|player|protagonist)$/i.test(currentSpeaker)) return null;
    return currentSpeaker;
  }, [currentSpeaker]);

  // Prepare visible NPCs (the ones that appeared so far)
  const visibleNpcs = useMemo(() => {
    const npcs = {};
    dialogues.slice(0, index + 1).forEach(d => {
      const name = d.speaker;
      if (!name || /^(you|player|protagonist)$/i.test(name)) return;
      if (/^narrator$/i.test(String(name))) return;
      if (!npcs[name]) {
        npcs[name] = npcAvatars[name] || null;
      }
    });
    return npcs;
  }, [dialogues, index, npcAvatars]);

  // Detect whether player is speaking (by name or generic pronouns)
  const isPlayerSpeaking = useMemo(() => {
    if (!currentSpeaker) return false;
    if (/^(you|player|protagonist)$/i.test(currentSpeaker)) return true;
    if (playerName && String(currentSpeaker).toLowerCase().trim() === String(playerName).toLowerCase().trim()) return true;
    return false;
  }, [currentSpeaker, playerName]);

  // In 'pair' mode, keep a stable left NPC based on recent non-player speakers
  const leftRef = useRef({ name: null });
  const recentNonPlayers = useMemo(() => {
    const windowSize = 6;
    const recent = dialogues.slice(Math.max(0, index - windowSize), index + 1);
    return recent
      .map(d => d.speaker)
      .filter(s => !!s && !/^(you|player|protagonist|narrator)$/i.test(s));
  }, [dialogues, index]);
  if (mode === 'pair') {
    const candidate = recentNonPlayers.length ? recentNonPlayers[recentNonPlayers.length - 1] : null;
    if (candidate && candidate !== leftRef.current.name) {
      leftRef.current.name = candidate;
    }
    if (!candidate && !recentNonPlayers.length && index === 0) {
      leftRef.current.name = null;
    }
  }

  const leftNpcUrl = mode === 'pair' && leftRef.current.name ? (npcAvatars[leftRef.current.name] || null) : null;
  const leftIsSpeaking = mode === 'pair' ? (currentNpcName && leftRef.current.name && currentNpcName === leftRef.current.name) : false;

  // Styles for highlighting the current speaker
  const speakerGlow = '0 0 0 3px rgba(255,255,255,0.7), 0 0 18px rgba(99,102,241,0.8)';

  // Render
  if (mode === 'pair') {
    return (
      <div className="dialogue-scene" style={styles.scene}>
        {/* Left: one NPC (stable within recent window) */}
        <div className="npc-zone" style={styles.npcZone}>
          {leftRef.current.name && (
            <div
              key={leftRef.current.name}
              style={{
                ...styles.npcSlot,
                boxShadow: leftIsSpeaking ? speakerGlow : 'none',
                borderRadius: 14,
                padding: leftIsSpeaking ? 6 : 0,
                transform: leftIsSpeaking ? 'scale(1.04)' : 'none',
                transition: 'transform 180ms ease, box-shadow 180ms ease'
              }}
            >
              <ThreeAvatarViewer avatarUrl={leftNpcUrl} position="left" />
              <div style={styles.name}>{leftRef.current.name}</div>
            </div>
          )}
        </div>

        {/* Dialogue text */}
        <div className="dialogue-text" style={styles.textBox}>
          <p><strong>{currentSpeaker}:</strong> {current.text}</p>
        </div>

        {/* Right: Player */}
        <div className="user-zone" style={{
          ...styles.userZone,
          boxShadow: isPlayerSpeaking ? speakerGlow : 'none',
          borderRadius: 14,
          padding: isPlayerSpeaking ? 6 : 0,
          transform: isPlayerSpeaking ? 'scale(1.04)' : 'none',
          transition: 'transform 180ms ease, box-shadow 180ms ease'
        }}>
          <ThreeAvatarViewer avatarUrl={userAvatarUrl} position="right" />
          <div style={styles.name}>{playerName || 'You'}</div>
        </div>
      </div>
    );
  }

  // Default: show all visible NPCs
  return (
    <div className="dialogue-scene" style={styles.scene}>
      <div className="npc-zone" style={styles.npcZone}>
        {Object.entries(visibleNpcs).map(([name, url]) => (
          <div
            key={name}
            style={{
              ...styles.npcSlot,
              boxShadow: currentNpcName === name ? speakerGlow : 'none',
              borderRadius: 14,
              padding: currentNpcName === name ? 6 : 0,
              transform: currentNpcName === name ? 'scale(1.04)' : 'none',
              transition: 'transform 180ms ease, box-shadow 180ms ease'
            }}
          >
            <ThreeAvatarViewer avatarUrl={url} position="left" />
            <div style={styles.name}>{name}</div>
          </div>
        ))}
      </div>

      <div className="dialogue-text" style={styles.textBox}>
        <p><strong>{currentSpeaker}:</strong> {current.text}</p>
      </div>

      <div className="user-zone" style={{
        ...styles.userZone,
        boxShadow: isPlayerSpeaking ? speakerGlow : 'none',
        borderRadius: 14,
        padding: isPlayerSpeaking ? 6 : 0,
        transform: isPlayerSpeaking ? 'scale(1.04)' : 'none',
        transition: 'transform 180ms ease, box-shadow 180ms ease'
      }}>
        <ThreeAvatarViewer avatarUrl={userAvatarUrl} position="right" />
        <div style={styles.name}>{playerName || 'You'}</div>
      </div>
    </div>
  );
}

const styles = {
  scene: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    width: "100%",
    height: "80vh",
    position: "relative",
  },
  npcZone: {
    position: "absolute",
    left: "2%",
    bottom: 0,
    display: "flex",
    gap: "20px",
  },
  npcSlot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  userZone: {
    position: "absolute",
    right: "2%",
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  textBox: {
    position: "absolute",
    bottom: "10%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "60%",
    background: "rgba(255,255,255,0.9)",
    borderRadius: "16px",
    padding: "16px 24px",
    fontSize: "18px",
    color: "#111",
    boxShadow: "0 4px 30px rgba(0,0,0,0.2)",
  },
  name: {
    marginTop: 8,
    color: "#fff",
    fontWeight: "bold",
    textShadow: "0 0 4px rgba(0,0,0,0.5)",
  },
};
