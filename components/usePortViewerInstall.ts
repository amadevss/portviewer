'use client';

import { useEffect, useState } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePortViewerInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');

    function updateDisplayMode() {
      const appleStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
      setInstalled(displayMode.matches || appleStandalone === true);
    }

    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
      setShowHelp(false);
    }

    updateDisplayMode();
    displayMode.addEventListener('change', updateDisplayMode);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      displayMode.removeEventListener('change', updateDisplayMode);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) {
      setShowHelp((visible) => !visible);
      return;
    }
    setPrompt(null);
    setShowHelp(false);
    try {
      const { outcome } = await prompt.prompt();
      if (outcome === 'accepted') setInstalled(true);
    } catch {
      setShowHelp(true);
    }
  }

  return { install, installed, showHelp, canPrompt: prompt !== null };
}
