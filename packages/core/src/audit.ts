import { pureCrypto, toHex, utf8, type CryptoProvider } from '@triptown/fairness';

// Append-only, hash-chained audit trail (GLI-19 App. B.6.5). Each entry commits to the previous
// entry's hash, so altering, removing or reordering entries breaks verification.

export type AuditEventType =
  | 'session_created'
  | 'seed_committed'
  | 'seed_revealed'
  | 'round_started'
  | 'cashout_received'
  | 'paper_thrown'
  | 'round_settled'
  | 'round_voided'
  | 'kill_switch_changed'
  | 'integrity_check'
  | 'time_drift';

export interface AuditEntry {
  seq: number;
  at: number;
  type: AuditEventType;
  data: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface AuditSink {
  append(type: AuditEventType, data: Record<string, unknown>): Promise<void>;
}

export const GENESIS_HASH = '0'.repeat(64);

/** Stable JSON (sorted keys) so hashes don't depend on property order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function entryHash(e: Omit<AuditEntry, 'hash'>, crypto: CryptoProvider = pureCrypto): string {
  const material = `${e.prevHash}|${e.seq}|${e.at}|${e.type}|${canonicalJson(e.data)}`;
  return toHex(crypto.sha256(utf8(material)));
}

export function buildEntry(
  prev: { seq: number; hash: string } | null,
  at: number,
  type: AuditEventType,
  data: Record<string, unknown>,
  crypto: CryptoProvider = pureCrypto,
): AuditEntry {
  const base = { seq: (prev?.seq ?? 0) + 1, at, type, data, prevHash: prev?.hash ?? GENESIS_HASH };
  return { ...base, hash: entryHash(base, crypto) };
}

export type ChainVerification = { ok: true; entries: number } | { ok: false; brokenAt: number; reason: string };

/** Verifies a chain ordered by seq, starting at seq 1. */
export function verifyAuditChain(entries: readonly AuditEntry[], crypto: CryptoProvider = pureCrypto): ChainVerification {
  let prev: AuditEntry | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    const expectedSeq = (prev?.seq ?? 0) + 1;
    if (e.seq !== expectedSeq) return { ok: false, brokenAt: expectedSeq, reason: `missing or reordered entry (found seq ${e.seq})` };
    if (e.prevHash !== (prev?.hash ?? GENESIS_HASH)) return { ok: false, brokenAt: e.seq, reason: 'previous hash mismatch' };
    const { hash: _hash, ...rest } = e;
    if (entryHash(rest, crypto) !== e.hash) return { ok: false, brokenAt: e.seq, reason: 'entry content altered' };
    prev = e;
  }
  return { ok: true, entries: entries.length };
}

/** In-memory chain for tests, local dev and the browser mock. */
export class MemoryAuditLog implements AuditSink {
  readonly entries: AuditEntry[] = [];
  constructor(private readonly now: () => number = () => Date.now()) {}

  async append(type: AuditEventType, data: Record<string, unknown>) {
    const last = this.entries.at(-1) ?? null;
    this.entries.push(buildEntry(last, this.now(), type, data));
  }
}

export const nullAuditSink: AuditSink = Object.freeze({ append: async () => {} });
