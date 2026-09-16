// Stateless session tokens: "<sessionId>.<base64url HMAC-SHA256(secret, sessionId)>".
// Fake-wallet sessions only; real operator integrations will bring their own player auth.

const enc = new TextEncoder();

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Buffer.from(sig).toString('base64url');
}

export async function signSession(sessionId: string, secret: string): Promise<string> {
  return `${sessionId}.${await hmac(secret, sessionId)}`;
}

export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const expected = await hmac(secret, id);
  const given = token.slice(dot + 1);
  if (given.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? id : null;
}
