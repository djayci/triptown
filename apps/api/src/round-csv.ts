import type { RoundSummary } from '@triptown/core';

const COLUMNS: [string, (r: RoundSummary) => unknown][] = [
  ['round_id', (r) => r.roundId],
  ['session_id', (r) => r.sessionId],
  ['player_id', (r) => r.playerId],
  ['game_id', (r) => r.gameId],
  ['config_id', (r) => r.configId],
  ['profile', (r) => r.profile],
  ['client_version', (r) => r.clientVersion],
  ['started_at', (r) => iso(r.startedAt)],
  ['settled_at', (r) => iso(r.settledAt)],
  ['currency', (r) => r.currency],
  ['stake_minor', (r) => r.betMinor],
  ['balance_before_minor', (r) => r.balanceBeforeMinor],
  ['balance_after_minor', (r) => r.balanceAfterMinor],
  ['auto_cashout', (r) => r.autoCashout],
  ['status', (r) => r.status],
  ['reason', (r) => r.settlement?.reason],
  // Records written before partial cash-out have no paper fields: they are single-paper rounds.
  ['papers', (r) => r.stakeParts ?? 1],
  ['parts_settled', (r) => (r.settledParts ?? []).reduce((n, t) => n + t.parts, 0)],
  ['cashouts', (r) => r.cashouts.map((c) => `${c.time.toFixed(3)}s@x${c.multiplier.toFixed(4)}:${c.creditedMinor}`).join(';')],
  ['return_minor', (r) => r.returnMinor],
  ['net_minor', (r) => r.netMinor],
  ['result', (r) => r.resultKind],
  ['crash_time', (r) => (r.settlement && r.settlement.crashTime >= 0 ? r.settlement.crashTime : null)],
  ['crash_multiplier', (r) => r.crashMultiplier],
  ['setbacks', (r) => (r.setbacks ?? []).join(';')],
  ['boosts', (r) => (r.boosts ?? []).join(';')],
  ['seed_commit', (r) => r.commit],
  ['client_seed', (r) => r.clientSeed],
  ['nonce', (r) => r.nonce],
  ['void', (r) => r.status === 'void'],
];

function iso(ms: number | null): string {
  return typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

/** RFC 4180 cell; text that a spreadsheet would run as a formula is prefixed with a quote. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function roundsCsv(rounds: RoundSummary[]): string {
  const lines = [COLUMNS.map(([name]) => name).join(',')];
  for (const r of rounds) lines.push(COLUMNS.map(([, get]) => cell(get(r))).join(','));
  return lines.join('\r\n') + '\r\n';
}
