/* global WebMMuxer, AudioEncoder, AudioData -- used inside page.evaluate (browser context) */
// Builds placeholder audio: synthesizes PCM, encodes MP3 (lamejs) and WebM/Opus (headless Chrome WebCodecs),
// and writes public/assets/audio/audio.json for the AudioManager.
import { Mp3Encoder } from '@breezystack/lamejs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import {
  LOOP_SECONDS,
  SR,
  TONE_SECONDS,
  doubled,
  lobbyLoop,
  sfxBet,
  sfxCollect,
  sfxFinish,
  sfxJump,
  sfxLand,
  sfxRefuse,
  sfxWin,
  stemBase,
  stemDrums,
  stemLead,
  toneLoop,
} from './synth.mjs';

const OUT = 'public/assets/audio';
const require = createRequire(import.meta.url);

function toInt16(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
  return out;
}

function mp3(f32, kbps) {
  const enc = new Mp3Encoder(1, SR, kbps);
  const pcm = toInt16(f32);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const chunk = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (chunk.length) parts.push(Buffer.from(chunk));
  }
  const end = enc.flush();
  if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

// --- sfx sprite ---
const GAP = 0.25;
const effects = { bet: sfxBet(), jump: sfxJump(), land: sfxLand(), refuse: sfxRefuse(), collect: sfxCollect(), win: sfxWin(), finish: sfxFinish() };
let total = Math.round(GAP * SR);
for (const b of Object.values(effects)) total += b.length + Math.round(GAP * SR);
const sprite = new Float32Array(total);
const spriteMap = {};
let cursor = Math.round(GAP * SR);
for (const [name, b] of Object.entries(effects)) {
  sprite.set(b, cursor);
  spriteMap[name] = [Math.round((cursor / SR) * 1000), Math.round((b.length / SR) * 1000)];
  cursor += b.length + Math.round(GAP * SR);
}

const loopRegion = (seconds) => [Math.round((seconds / 2) * 1000), Math.round(seconds * 1000)];
const files = {
  sfx: { pcm: sprite, kbps: 64 },
  'stem-base': { pcm: doubled(stemBase()), kbps: 48 },
  'stem-drums': { pcm: doubled(stemDrums()), kbps: 48 },
  'stem-lead': { pcm: doubled(stemLead()), kbps: 48 },
  lobby: { pcm: doubled(lobbyLoop()), kbps: 48 },
  tone: { pcm: doubled(toneLoop()), kbps: 48 },
};

mkdirSync(OUT, { recursive: true });
for (const [name, f] of Object.entries(files)) writeFileSync(`${OUT}/${name}.mp3`, mp3(f.pcm, f.kbps));

// --- WebM/Opus via WebCodecs in headless Chrome (needs a secure context, so serve a fake https page) ---
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.route('https://encoder.local/', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>enc</title>' }));
await page.goto('https://encoder.local/');
await page.addScriptTag({ path: join(dirname(require.resolve('webm-muxer')), 'webm-muxer.js') });
for (const [name, f] of Object.entries(files)) {
  const base64 = Buffer.from(toInt16(f.pcm).buffer).toString('base64');
  const outB64 = await page.evaluate(
    async ({ base64, sampleRate, bitrate }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const pcm = new Int16Array(bytes.buffer);
      const target = new WebMMuxer.ArrayBufferTarget();
      const muxer = new WebMMuxer.Muxer({ target, audio: { codec: 'A_OPUS', sampleRate, numberOfChannels: 1 } });
      const encoder = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: (e) => { throw e; } });
      encoder.configure({ codec: 'opus', sampleRate, numberOfChannels: 1, bitrate });
      const frame = 4800;
      for (let i = 0; i < pcm.length; i += frame) {
        const slice = pcm.slice(i, i + frame);
        encoder.encode(new AudioData({ format: 's16', sampleRate, numberOfFrames: slice.length, numberOfChannels: 1, timestamp: Math.round((i / sampleRate) * 1e6), data: slice }));
      }
      await encoder.flush();
      muxer.finalize();
      const out = new Uint8Array(target.buffer);
      let s = '';
      for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
      return btoa(s);
    },
    { base64, sampleRate: SR, bitrate: f.kbps * 1000 },
  );
  writeFileSync(`${OUT}/${name}.webm`, Buffer.from(outB64, 'base64'));
}
await browser.close();

const src = (name) => [`audio/${name}.webm`, `audio/${name}.mp3`];
const manifest = {
  sfx: { src: src('sfx'), sprite: spriteMap },
  stems: {
    base: { src: src('stem-base'), loop: loopRegion(LOOP_SECONDS) },
    drums: { src: src('stem-drums'), loop: loopRegion(LOOP_SECONDS) },
    lead: { src: src('stem-lead'), loop: loopRegion(LOOP_SECONDS) },
  },
  lobby: { src: src('lobby'), loop: loopRegion(LOOP_SECONDS) },
  tone: { src: src('tone'), loop: loopRegion(TONE_SECONDS) },
};
writeFileSync(`${OUT}/audio.json`, JSON.stringify(manifest, null, 2));
console.info('audio built', spriteMap);
