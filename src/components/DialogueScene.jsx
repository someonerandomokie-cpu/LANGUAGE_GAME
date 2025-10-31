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
  mode = "all", // 'all' = show all NPCs seen so far; 'pair' = cinematic two-character (NPC left + player right)
  buddyName = "",
  choicesContent = null,
  practiceContent = null
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
    const getUrl = (n) => {
      const raw = String(n || '');
      const low = raw.trim().toLowerCase();
      return npcAvatars[raw] || npcAvatars[low] || null;
    };
    dialogues.slice(0, index + 1).forEach(d => {
      const name = d.speaker;
      if (!name || /^(you|player|protagonist)$/i.test(name)) return;
      if (/^narrator$/i.test(String(name))) return;
      if (!npcs[name]) {
        npcs[name] = getUrl(name);
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
      .filter(s => !!s && !/^(you|player|protagonist|narrator)$/i.test(s))
      .filter(s => {
        // Exclude the actual playerName to avoid showing the user's avatar on the left slot
        if (!playerName) return true;
        return String(s).trim().toLowerCase() !== String(playerName).trim().toLowerCase();
      });
  }, [dialogues, index, playerName]);
  if (mode === 'pair') {
    let candidate = recentNonPlayers.length ? recentNonPlayers[recentNonPlayers.length - 1] : null;
    if (!candidate && isPlayerSpeaking && buddyName) {
      // When player speaks first, prefer showing the buddy as the other character
      candidate = buddyName;
    }
    if (candidate && candidate !== leftRef.current.name) {
      leftRef.current.name = candidate;
    }
    if (!candidate && !recentNonPlayers.length && index === 0) {
      leftRef.current.name = null;
    }
  }

  const leftNpcUrl = (() => {
    if (mode !== 'pair') return null;
    const n = leftRef.current.name;
    if (!n) return null;
    const low = String(n).trim().toLowerCase();
    return npcAvatars[n] || npcAvatars[low] || null;
  })();
  const leftIsSpeaking = mode === 'pair' ? (currentNpcName && leftRef.current.name && currentNpcName === leftRef.current.name) : false;

  // Styles for highlighting the current speaker
  const speakerGlow = '0 0 0 3px rgba(255,255,255,0.7), 0 0 18px rgba(99,102,241,0.8)';

  // Render
  if (mode === 'pair') {
    return (
      <div
        className="dialogue-scene"
        style={{
          position: 'relative',
          width: '100%',
          height: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '0 24px'
        }}
      >
        {/* === LEFT NPC AVATAR (column) === */}
        <div
          className="avatar-left"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: 240, maxWidth: '24vw', marginRight: 40,
            opacity: leftIsSpeaking ? 1 : 0.5, transition: 'opacity 0.3s ease'
          }}
        >
          <ThreeAvatarViewer avatarUrl={leftNpcUrl} width={220} height={280} position="left" />
          <div style={{ marginTop: 8, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {leftRef.current.name || 'NPC'}
          </div>
        </div>

        {/* === CENTER COLUMN (choices above + dialogue box) === */}
        <div style={{ flex: '0 1 52%', maxWidth: 920, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {choicesContent && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {choicesContent}
            </div>
          )}
          <div
            className="dialogue-box"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 16,
              padding: '20px 28px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              textAlign: 'center'
            }}
          >
            {current && (
              <>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, color: '#111' }}>{currentSpeaker}</div>
                <div style={{ fontSize: 16, color: '#111' }}>{current.text}</div>
              </>
            )}
          </div>
          {practiceContent && (
            <div style={{ width: '100%', marginTop: 10 }}>
              {practiceContent}
            </div>
          )}
        </div>

        {/* === RIGHT PLAYER AVATAR (column) === */}
        <div
          className="avatar-right"
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: 240, maxWidth: '24vw', marginLeft: 40,
            opacity: isPlayerSpeaking ? 1 : 0.5, transition: 'opacity 0.3s ease'
          }}
        >
          <ThreeAvatarViewer avatarUrl={userAvatarUrl} width={220} height={280} position="right" />
          <div style={{ marginTop: 8, fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {playerName || 'You'}
          </div>
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
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "80vh",
    position: "relative",
  },
  npcZone: {
    position: "absolute",
    left: "6%",
    top: "50%",
    transform: "translateY(-50%)",
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
    right: "6%",
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  textBox: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "64%",
    maxWidth: "900px",
    background: "rgba(255,255,255,0.85)",
    borderRadius: "16px",
    padding: "18px 26px",
    fontSize: "18px",
    color: "#111",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    backdropFilter: "blur(4px)",
  },
  name: {
    marginTop: 8,
    color: "#fff",
    fontWeight: "bold",
    textShadow: "0 0 4px rgba(0,0,0,0.5)",
  },
};
