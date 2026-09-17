import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [path] : [];
  });

describe('page copy', () => {
  it('lives in src/copy.ts or the catalogue, never as JSX text, so the copy check sees all of it', () => {
    const offenders: string[] = [];
    for (const file of tsxFiles(appDir)) {
      const source = readFileSync(file, 'utf8');
      // Text between a tag close and the next tag or expression, containing a letter.
      for (const match of source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
        const text = match[1]!.trim();
        // Skip TypeScript generics and arrow bodies that the regex can straddle.
        if (text && !/[=;()|]/.test(text)) offenders.push(`${file}: "${text}"`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
