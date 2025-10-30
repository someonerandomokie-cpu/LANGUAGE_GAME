import React, { useState } from 'react';
import { AvatarProvider, useAvatar } from '../contexts/AvatarContext';
import AvatarCreator from './AvatarCreator';
import DialogueWithAnimation from './DialogueWithAnimation';

/*
  AvatarIntegration.jsx

  Purpose: small, self-contained UI you can mount anywhere in your existing App.jsx.
  - Does not replace any existing code.
  - Uses the AvatarContext you added earlier.
  - Provides the Create Avatar button and two demo flows:
      * start a dialogue using the current player avatar
      * request a server-generated NPC and start a dialogue
  - Import and add <AvatarIntegration /> into your App's header or a sidebar.
*/

function AvatarIntegrationContent() {
  const { avatar, generateNPCs } = useAvatar();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [character, setCharacter] = useState(null);
  const [lines, setLines] = useState([]);

  const startPlayerDialogue = () => {
    if (!avatar || !avatar.url) {
      // you can replace alert with your app's notification system
      alert('Please create and export your avatar first (use Create Avatar).');
      return;
    }
    setCharacter({
      id: 'player',
      name: 'Player',
      avatarUrl: avatar.url,
    });
    setLines([
      { speaker: 'Player', text: 'I have completed my training.', emotion: 'neutral' },
      { speaker: 'Player', text: 'Let us begin the journey!', emotion: 'happy' },
    ]);
    setDialogVisible(true);
  };

  const createNpcAndStartDialogue = async () => {
    try {
      // Use a reproducible seed if you want same NPC each time; here we use timestamp
      const seed = `npc-${Date.now()}`;
      const results = await generateNPCs([{ id: 'npc-1', seed }]);
      const url = results?.[0]?.url;
      if (!url) {
        alert('Failed to generate NPC avatar. Check server logs.');
        return;
      }
      setCharacter({
        id: 'npc-1',
        name: 'NPC',
        avatarUrl: url,
      });
      setLines([
        { speaker: 'NPC', text: 'Hello, traveler.', emotion: 'talk' },
        { speaker: 'NPC', text: 'Welcome to our town.', emotion: 'happy' },
      ]);
      setDialogVisible(true);
    } catch (err) {
      console.error('generateNPCs error', err);
      alert('Error generating NPC avatar. See console.');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <AvatarCreator userId="player1" />
      <button onClick={startPlayerDialogue} style={{ padding: '6px 10px' }}>
        Start Dialogue (player avatar)
      </button>
      <button onClick={createNpcAndStartDialogue} style={{ padding: '6px 10px' }}>
        Generate NPC & Dialogue
      </button>

      <DialogueWithAnimation
        visible={dialogVisible}
        character={character}
        lines={lines}
        onClose={() => setDialogVisible(false)}
      />
    </div>
  );
}

// Export a single component that wraps content with AvatarProvider so the rest of your app
// can remain unchanged if you prefer mounting just the content. If you already wrap your whole
// app with AvatarProvider elsewhere, import AvatarIntegrationContent directly instead.
export default function AvatarIntegration({ wrapProvider = false }) {
  if (wrapProvider) {
    // In case you want the integration to bring its own provider (useful for quick testing)
    return (
      <AvatarProvider>
        <AvatarIntegrationContent />
      </AvatarProvider>
    );
  }
  return <AvatarIntegrationContent />;
}