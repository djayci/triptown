import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Anton, Bricolage_Grotesque, Chivo_Mono, Lilita_One, Michroma } from 'next/font/google';
import { copy } from '../src/copy';
import './globals.css';

const michroma = Michroma({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const chivo = Chivo_Mono({ weight: ['300', '500'], subsets: ['latin'], variable: '--font-text' });
// The games' own display face, used only inside their logo tiles.
const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-game' });
// Gate Rush's Dirt Track wordmark: the heavy grotesque the game draws it in.
const bricolage = Bricolage_Grotesque({
  weight: '800',
  subsets: ['latin'],
  variable: '--font-game-grotesque',
});
// Flock's wordmark face (apps/flock/src/main.ts DUSK_LOOK.display).
const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-game-anton' });

export const metadata: Metadata = {
  title: copy.meta.title,
  description: copy.meta.description,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${michroma.variable} ${chivo.variable} ${lilita.variable} ${bricolage.variable} ${anton.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
