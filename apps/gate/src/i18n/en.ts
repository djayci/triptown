// Player-facing text for Beat the Gate. Every string the player can read lives here so it can be
// translated per market and reviewed as a whole (GLI-19 §4.4.1, UK RTS 3/4).
// Copy rules (beat-the-gate-mvp spec): no skill, speed or urgency framing; no near-miss or "would have";
// never call a return at or below the stake a win (UK RTS 14F); no racing words — race, odds,
// starting gate, finish, bet slip — because a single horse going home is not a race.

export const EN = {
  'logo.beatThe': 'BEAT THE',
  'logo.gate': 'GATE',
  'logo.rush': 'RUSH',

  'stage.ready': 'READY?',
  'stage.readySub': 'Ride out. Get back in before the gate slams.',
  'stage.readySubRush': 'Go in when you like. Gate open chance = 97% ÷ value.',
  'button.bet': 'BET {amount}',
  'button.collect': 'IN!',
  'button.cashOut': 'In for {amount}',
  'button.cashingOut': 'Heading in {amount}…',
  'button.playAgain': 'RIDE AGAIN',
  'button.playAgainSub': 'Same bet',
  'button.continue': 'CONTINUE',
  'button.continueSub': 'Back to betting',
  'button.wait': 'WAIT {seconds}s',
  'button.waitSub': 'Next round',

  'label.demo': 'DEMO',

  'label.balance': 'Balance',
  'label.session': 'Session',
  'label.net': 'Net',
  'label.stake': 'Stake',
  'label.auto': 'Auto',

  'bet.loading': 'LOADING',
  'bet.gameClosed': 'GAME CLOSED',
  'bet.paused': 'PAUSED',
  'bet.stakeLimit': 'STAKE LIMIT',
  'bet.lossLimit': 'LOSS LIMIT',
  'bet.insufficient': 'INSUFFICIENT BALANCE',

  'run.winNow': 'IN NOW {amount}',
  'run.ifOpen': 'IF THE GATE IS OPEN',
  'run.revealChance': 'GATE OPEN IF YOU GO IN NOW · {chance}',
  'run.headingHome': 'LOCKED · HEADING HOME',
  'button.headingHome': 'RIDING IN…',
  'button.headingHomeSub': 'The result was fixed when the round started',
  'result.cashedOut': 'HOME SAFE',
  'result.gateOpen': 'GATE OPEN',
  // Net, not the gross return: a gain is only shown when the player is actually up (RTS 14F).
  'result.net': '+{amount}',
  'result.returnedEven': 'Returned {amount} · Net 0.00',
  'result.returnedBelow': 'Returned {amount} · Net {net}',
  'result.crashed': 'GATE SHUT',

  'error.slowConnection': 'Slow connection — IN! is judged when the server receives it.',

  'rules.title': 'How this game works',
  'rules.intro':
    'The value rises from x1.00 while the horse is out in the field. Press IN! before the gate slams and you keep the value at the moment the server receives your press.',
  'rules.outcomeFixed':
    'The outcome of every round is fixed before the round starts, by the seeds shown in the fairness panel. The horse, the gate and the crowd are decoration: nothing you tap, and nothing on screen, changes or predicts when the gate slams.',
  'rules.growth': 'The value speeds up over the first {tRamp} seconds, then keeps that speed.',
  'rules.setbacks': 'A setback appears about every {every} seconds on average and halves the current value. There is no warning.',
  'rules.boosts': 'A boost appears about every {every} seconds on average and raises the value by {percent}%. There is no warning.',
  'rules.instantBust': 'About {percent}% of rounds end immediately at x1.00.',
  'rules.rtp': 'Return to player is {rtp}% over a very large number of rounds, and is the same whenever you press IN!.',
  'rules.rtpBand':
    'Payouts are rounded to whole {currency}, so at the smallest stake of {stake} the measured return ranges from {low}% to {high}%. Larger stakes sit closer to {rtp}%.',
  'rules.rtpBandMissing': 'Measured band unavailable for this configuration — this figure is incomplete.',
  'rules.maxMultiplier': 'The most a round can pay is x{multiplier}; the round ends there automatically.',
  'rules.tMax': 'A round ends automatically after {seconds} seconds.',
  'rules.minCashout': 'You can press IN! from x{multiplier}.',
  'rules.minCashoutNone': 'You can press IN! at any value.',
  'rules.autoCashout': 'Auto IN! ends the round for you at a value between x{min} and x{max}. It affects nothing else.',
  'rules.rounding': 'Payouts are worked out exactly and rounded to the nearest whole {currency} once per round.',
  'rules.belowStakeReturns': 'A setback can halve the value, so pressing IN! can return less than your stake.',
  'rules.minCycle': 'There is a minimum of {seconds} seconds between rounds, and you must release and press again to start one.',
  'rules.latency':
    'IN! is judged at the time the server receives it, not the time you tapped. There is no allowance for connection delay.',
  'rules.disconnect.lose': 'If you disconnect during a round, the round continues and settles on the server.',
  'rules.disconnect.cashoutAtDisconnect': 'If you disconnect during a round, the round is ended for you at the moment the disconnection is detected.',
  'rules.voidRefund': 'If a system failure prevents a round from settling, the round is voided and your stake is returned.',
  'rules.provablyFair': 'Every round can be verified from its seeds after the seed is revealed. Open the fairness panel to check.',
  'rules.version': 'Version {version} · build {build} · game {config} · market {profile}',
  'rules.withholding': 'Winnings may be subject to withholding tax applied by your operator. This game does not calculate or deduct any tax.',
  'result.withholding': 'Tax may apply',
  'rules.close': 'Close',
  'rules.reduceEffects': 'Reduce effects',
  'rules.responsible': 'Set your limits and take breaks. Gambling should stay entertainment.',
} as const;

export type MessageKey = keyof typeof EN;

/** Falls back to the key so a missing string is visible in review rather than silently blank. */
export function t(key: MessageKey | string, params: Record<string, string | number> = {}): string {
  const raw = (EN as Record<string, string>)[key];
  if (raw === undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}
