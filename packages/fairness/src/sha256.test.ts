import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fromHex, toHex, utf8 } from './bytes';
import { bytesToUnit, commitServerSeed, generateServerSeed, streamBytes, streamUniform } from './seeds';
import { hmacSha256, sha256 } from './sha256';

describe('sha256', () => {
  it('matches FIPS 180-2 vectors', () => {
    expect(toHex(sha256(utf8('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(toHex(sha256(utf8('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(toHex(sha256(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')))).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('matches node:crypto on random inputs of many lengths', () => {
    for (let len = 0; len < 300; len += 7) {
      const data = randomBytes(len);
      expect(toHex(sha256(data))).toBe(createHash('sha256').update(data).digest('hex'));
    }
  });
});

describe('hmacSha256', () => {
  it('matches RFC 4231 test case 2', () => {
    expect(toHex(hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  it('matches RFC 4231 test case 6 (key longer than block)', () => {
    const key = new Uint8Array(131).fill(0xaa);
    expect(
      toHex(hmacSha256(key, utf8('Test Using Larger Than Block-Size Key - Hash Key First'))),
    ).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
  });

  it('matches node:crypto', () => {
    for (let i = 0; i < 20; i++) {
      const key = randomBytes(32);
      const msg = randomBytes(i * 5);
      expect(toHex(hmacSha256(key, msg))).toBe(createHmac('sha256', key).update(msg).digest('hex'));
    }
  });
});

describe('seeds and streams', () => {
  const seeds = {
    serverSeed: '0f1e2d3c4b5a69788796a5b4c3d2e1f00112233445566778899aabbccddeeff0',
    clientSeed: 'player-seed',
    nonce: 7,
  };

  it('generates 32-byte hex server seeds', () => {
    const s = generateServerSeed();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(generateServerSeed()).not.toBe(s);
  });

  it('commits with SHA-256 over the raw seed bytes', () => {
    expect(commitServerSeed(seeds.serverSeed)).toBe(
      createHash('sha256').update(fromHex(seeds.serverSeed)).digest('hex'),
    );
  });

  it('derives stream bytes as HMAC(serverSeed, clientSeed:nonce:stream:index)', () => {
    const expected = createHmac('sha256', fromHex(seeds.serverSeed))
      .update('player-seed:7:crash:0')
      .digest('hex');
    expect(toHex(streamBytes(seeds, 'crash', 0))).toBe(expected);
    expect(toHex(streamBytes(seeds, 'setbacks', 0))).not.toBe(expected);
  });

  it('extracts the top 52 bits', () => {
    expect(bytesToUnit(fromHex('00000000000000' + '00'.repeat(25)))).toBe(0);
    expect(bytesToUnit(fromHex('fffffffffffff0' + '00'.repeat(25)))).toBe(1 - 2 ** -52);
    expect(bytesToUnit(fromHex('80000000000000' + '00'.repeat(25)))).toBe(0.5);
    // Low nibble of byte 6 is ignored.
    expect(bytesToUnit(fromHex('8000000000000f' + '00'.repeat(25)))).toBe(0.5);
  });

  it('produces fixed uniforms in (0, 1] for fixed seeds', () => {
    const u0 = streamUniform(seeds, 'crash', 0);
    const digest = createHmac('sha256', fromHex(seeds.serverSeed))
      .update('player-seed:7:crash:0')
      .digest();
    const top52 = Number(BigInt('0x' + digest.subarray(0, 7).toString('hex')) >> 4n);
    expect(u0).toBe(1 - top52 / 2 ** 52);
    expect(u0).toBeGreaterThan(0);
    expect(u0).toBeLessThanOrEqual(1);
  });
});

describe('utf8', () => {
  it('matches Buffer encoding including multi-byte characters', () => {
    const text = 'héllo ✓ 🔨 seed';
    expect(toHex(utf8(text))).toBe(Buffer.from(text, 'utf8').toString('hex'));
  });
});
