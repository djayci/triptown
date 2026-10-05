// Player-facing text for Flock. Every string the player can read lives here, so it can be translated
// per market and reviewed as a whole (GLI-19 §4.4.1).
// Copy rules (flock-mvp spec):
// - no skill, speed or urgency framing;
// - no near-miss or "would have" wording;
// - never call a return at or below the stake a win;
// - no counting of rams, so nothing stands in for the multiplier;
// - the wolf is named only once the round has ended;
// - no word suggests a ram was caught or hurt.

export const EN = {
  'logo.flock': 'FLOCK',
  'logo.sub': '',

  'stage.readySub': 'Run with the flock. Cash out before the wolf comes.',
  'stage.readyTitle': 'READY?',
  'button.bet': 'BET {amount}',
  'button.collect': 'CASH OUT',
  'button.collectSub': 'Lock the value and stop the run',
  'button.cashOut': 'Cash out for {amount}',
  'button.cashingOut': 'Cashing out at {amount}…',
  'button.playAgain': 'PLAY AGAIN',
  'button.playAgainSub': 'Same bet',
  'button.continue': 'CONTINUE',
  'button.continueSub': 'Back to betting',
  'button.wait': 'WAIT {seconds}s',
  'button.waitSub': 'Next round',
  // Not used: Flock never defers the reveal. Present so the shared client always finds a string.
  'button.headingHome': 'CASHING OUT…',
  'button.headingHomeSub': '',

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

  // Present for the shared client; Flock shows no chance line because it never defers the reveal.
  'run.headingHome': 'LOCKED',
  'run.revealChance': '{chance}',
  'run.revealChanceLocked': '{chance}',

  'result.cashedOut': 'CASHED OUT',
  'result.net': '+{amount}',
  'result.returnedEven': 'Returned {amount} · Net 0.00',
  'result.returnedBelow': 'Returned {amount} · Net {net}',
  'result.crashed': 'WOLF',

  'error.slowConnection': 'Slow connection — CASH OUT is judged when the server receives it.',

  'rules.title': 'How this game works',
  'rules.intro':
    'The value rises from x1.00 while your ram runs. As it rises, more rams join the run. Press CASH OUT before the wolf comes and you keep the value at the moment the server receives your press. If the wolf comes first, the round ends and the stake is lost.',
  'rules.outcomeFixed':
    'The outcome of every round is fixed before the round starts, by the seeds shown in the fairness panel. The rams, the wolf and the field are decoration: the size of the flock only shows the value, and nothing you tap or see on screen changes or predicts when the wolf comes.',
  // Flock never defers the reveal; the shared panel only reads these under a deferred round.
  'rules.introDeferred':
    'The value rises from x1.00 while your ram runs. Press CASH OUT and you keep the value at the moment the server receives your press.',
  'rules.outcomeFixedDeferred':
    'The outcome of every round is fixed before the round starts, by the seeds shown in the fairness panel. The rams, the wolf and the field are decoration.',
  'rules.chance.title': 'Chance at each value',
  'rules.chance.intro':
    'The chance that a round reaches a value is the return to player, {rtp}%, divided by that value.',
  'rules.chance.value': 'Value',
  'rules.chance.chance': 'Chance',
  'rules.chance.return': 'Return on {stake}',
  'rules.chance.nominal': 'Chances are shown rounded down.',
  'rules.chance.yours': 'Your stake',
  'rules.chance.onScreen': 'The chance is shown on screen for as long as the round runs.',
  'rules.growth': 'The value speeds up over the first {tRamp} seconds, then keeps that speed.',
  'rules.setbacks':
    'A split appears about every {every} seconds on average: half the flock breaks away and the value halves. There is no warning.',
  'rules.boosts':
    'A boost appears about every {every} seconds on average and raises the value by {percent}%. There is no warning.',
  'rules.instantBust': 'About {percent}% of rounds end immediately at x1.00.',
  'rules.rtp':
    'Return to player is {rtp}% over a very large number of rounds, and is the same whenever you press CASH OUT.',
  'rules.rtpBand':
    'Payouts are rounded to whole {currency}, so at the smallest stake of {stake} the measured return ranges from {low}% to {high}%. Larger stakes sit closer to {rtp}%.',
  'rules.rtpBandMissing':
    'Measured band unavailable for this configuration — this figure is incomplete.',
  'rules.maxMultiplier':
    'The most a round can pay is x{multiplier}; the round ends there automatically.',
  'rules.tMax': 'A round ends automatically after {seconds} seconds.',
  'rules.minCashout': 'You can press CASH OUT from x{multiplier}.',
  'rules.minCashoutNone': 'You can press CASH OUT at any value.',
  'rules.autoCashout':
    'Auto cash-out ends the round for you at a value between x{min} and x{max}. It affects nothing else.',
  'rules.rounding':
    'Payouts are worked out exactly and rounded to the nearest whole {currency} once per round.',
  'rules.belowStakeReturns':
    'A split halves the value, so pressing CASH OUT can return less than your stake.',
  'rules.minCycle':
    'There is a minimum of {seconds} seconds between rounds, and you must release and press again to start one.',
  'rules.latency':
    'CASH OUT is judged at the time the server receives it, not the time you tapped. There is no allowance for connection delay.',
  'rules.disconnect.lose':
    'If you disconnect during a round, the round continues and settles on the server.',
  'rules.disconnect.cashoutAtDisconnect':
    'If you disconnect during a round, the round is ended for you at the moment the disconnection is detected.',
  'rules.voidRefund':
    'If a system failure prevents a round from settling, the round is voided and your stake is returned.',
  'rules.provablyFair':
    'Every round can be verified from its seeds after the seed is revealed. Open the fairness panel to check.',
  'rules.version': 'Version {version} · build {build} · game {config} · market {profile}',
  'rules.withholding':
    'Winnings may be subject to withholding tax applied by your operator. This game does not calculate or deduct any tax.',
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
