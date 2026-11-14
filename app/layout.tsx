import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PortViewer — Puertos, Procesos y Proyectos Locales',
  applicationName: 'PortViewer',
  description:
    'Panel local para inspeccionar puertos ocupados en tu computadora, procesos propietarios, proyectos detectados, enlaces web y control rápido.',
  icons: {
    apple: [{ url: '/portviewer-apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'PortViewer',
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
