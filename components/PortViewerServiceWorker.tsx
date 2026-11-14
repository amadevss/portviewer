'use client';

import { useEffect } from 'react';

export default function PortViewerServiceWorker() {
  useEffect(() => {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/portviewer-sw.js', { updateViaCache: 'none' })
      .catch((error) => {
        console.warn('PortViewer no pudo registrar el service worker.', error);
      });
  }, []);

  return null;
}
