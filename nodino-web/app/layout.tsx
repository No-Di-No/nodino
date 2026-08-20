import type { Metadata } from 'next';
import { Fraunces, Sora, Space_Mono } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600'],
});

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600'],
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Nodino — Ultimate Tic Tac Toe',
  description: 'Sciogli il nodo: una partita a Ultimate Tic Tac Toe su Nodino.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${sora.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
