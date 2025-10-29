import React, { createContext, useContext, useState, useEffect } from 'react';

const AvatarContext = createContext();

export const AvatarProvider = ({ children }) => {
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try {
      return localStorage.getItem('avatarUrl') || '';
    } catch {
      return '';
    }
  });

  const saveAvatar = (url) => {
    setAvatarUrl(url);
    try {
      localStorage.setItem('avatarUrl', url);
    } catch {}
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem('avatarUrl');
      if (stored) setAvatarUrl(stored);
    } catch {}
  }, []);

  return (
    <AvatarContext.Provider value={{ avatarUrl, saveAvatar }}>
      {children}
    </AvatarContext.Provider>
  );
};

export const useAvatar = () => useContext(AvatarContext);
