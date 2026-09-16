// Every player-facing string. `scripts/check-vocabulary.mjs` scans this file and the built bundle
// for racing, sportsbook, skill, luck and wealth words (client spec "Casino vocabulary only").

export const en = {
  title: 'Night Gallop',
  subtitle: 'Fence Run',
  demo: 'DEMO',
  live: 'LIVE',
  rules: 'Rules',
  footer: '18+ · RTP 97% · Every fence is decided when the round starts',
  session: 'SESSION',
  net: 'NET',
  stake: 'STAKE',
  difficulty: 'DIFFICULTY',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  bet: 'BET {stake}',
  jump: 'JUMP',
  jumpTo: 'to x{value}',
  collect: 'COLLECT',
  finish: 'FINISH',
  nextRoundIn: 'Next round in {seconds}s',
  roundLabel: 'ROUND {n}',
  fenceOf: 'FENCE {n} OF {total}',
  nextValue: 'NEXT x{value}',
  readyLabel: '{total} FENCES · {difficulty}',
  cleared: 'CLEARED',
  refused: 'REFUSED',
  refusedSub: 'Fence {fence} · Stake {stake} lost · Net {net}',
  win: 'WIN {amount}',
  winSub: 'Collected at fence {fence} · Net {net}',
  finishWin: 'FINISH · WIN {amount}',
  finishSub: 'Top prize x{value} · Net {net}',
  returned: 'RETURNED {amount}',
  returnedSub: 'Stake refunded · no fence was taken',
  close: 'Close',
  statusBetting: 'Place a bet to start a round.',
  statusWaiting: 'Fence {n} next, worth x{value}. Jump or collect.',
  statusJumping: 'Jumping fence {n}.',
  error: 'Something went wrong. Please try again.',
  bootFailed: 'Could not load the game. Please refresh.',
  rulesTitle: 'How Fence Run works',
  rulesPlay:
    'Place a bet and choose a difficulty. Press JUMP to take the next fence. If the horse clears it, the value steps up to the amount shown and you choose again: JUMP for the next fence, or COLLECT to take your stake times the current value. If the horse refuses a fence, the round ends and the stake is lost. Clearing the last fence reaches the finish line and collects the top prize automatically.',
  rulesFixed:
    'Every fence is decided by the server when the round starts, using certified random numbers you can verify after the seed is revealed. Pressing faster, slower or at any moment changes nothing. The horse, crowd and lights are decoration. This is a casino game with no race result.',
  rulesRtp:
    'Return to player is 97% for every way of playing: stopping after any fence returns the same 97% over the long run, so no strategy improves your return. The table shows each fence value and the chance of clearing it.',
  rulesAbandon:
    'If a round has no action for {time}, the server settles it: with at least one fence cleared it is collected at the current value; with none cleared the stake is refunded. You can close the game and come back to a running round before then.',
  rulesRounding: 'Payouts are the stake times the value, rounded once to the nearest minor unit. A new round can start at least {gap} seconds after the previous round started.',
  rulesTableFence: 'Fence',
  rulesTableValue: 'Value',
  rulesTableChance: 'Clear chance',
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  return en[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
