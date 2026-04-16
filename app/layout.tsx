import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ServiceWorkerRegister } from './service-worker-register';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'mabune Core',
  description: 'RE:SET Chart System',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'mabune Core',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}