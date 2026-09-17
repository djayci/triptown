// Player-facing text for The Lift. Every string the player can read lives here so it can be
// translated per market and reviewed as a whole (GLI-19 §4.4.1, UK RTS 3/4, PT R7 language).
// Copy rules: no skill or urgency framing, no near-miss language (Spain RD 176/2023 art. 17.2),
// no "would have reached", and never call a return at or below the stake a win (UK RTS 14F).

export const EN = {
  'rules.withholding': 'Winnings may be subject to withholding tax applied by your operator. This game does not calculate or deduct any tax.',
  'result.withholding': 'Tax may apply',
  'rules.rtpBandMissing': 'Measured band unavailable for this configuration \u2014 this figure is incomplete.',
  'logo.the': 'THE',
  'logo.lift': 'LIFT',

  'stage.ready': 'READY?',
  'stage.readySub': 'Get out before the cable goes.',
  'button.bet': 'BET {amount}',
  'button.collect': 'GET OUT!',
  'button.cashOut': 'Take {amount}',
  'button.cashingOut': 'Taking {amount}\u2026',
  'button.playAgain': 'RIDE AGAIN',
  'button.playAgainSub': 'Same bet',
  'button.continue': 'CONTINUE',
  'button.continueSub': 'Back to betting',
  'button.wait': 'WAIT {seconds}s',
  'button.waitSub': 'Next round',

  'label.demo': 'DEMO',

  'label.balance': 'Balance',
  'label.floor': 'Floor',
  'label.session': 'Session',
  'label.net': 'Net',
  'label.stake': 'Stake',
  'label.auto': 'Auto',

  'run.winNow': 'GET OUT NOW {amount}',
  'result.cashedOut': 'GOT OUT',
  // Net, not the gross return: a gain is only shown when the player is actually up (RTS 14F).
  'result.net': '+{amount}',
  'result.returnedEven': 'Returned {amount}',
  'result.returnedBelow': 'Returned {amount} \u00b7 Net {net}',
  'result.crashed': 'THE CABLE WENT',
  'result.crashedSub': 'Stake not returned \u00b7 {amount}',
  'result.instant': 'The cable went at the ground floor.',

  'rules.title': 'How this game works',
  'rules.growth': 'The multiplier speeds up over the first {tRamp} seconds, then keeps that speed.',
  'rules.setbacks': 'A bad mole appears about every {every} seconds on average and halves the current value. There is no warning.',
  'rules.boosts': 'A good mole appears about every {every} seconds on average and raises the value by {percent}%. There is no warning.',
  'rules.instantBust': 'About {percent}% of rounds end immediately at x1.00.',
  'rules.maxMultiplier': 'The most a round can pay is x{multiplier}; the round ends there automatically.',
  'rules.tMax': 'A round ends automatically after {seconds} seconds.',
  'rules.minCashout': 'You can cash out from x{multiplier}.',
  'rules.minCashoutNone': 'You can cash out at any value, including below x1.00 after a bad mole.',
  'rules.autoCashout': 'Auto cash-out ends the round for you at a value between x{min} and x{max}. It affects nothing else.',
  'rules.rounding': 'Payouts are worked out exactly and rounded to the nearest whole {currency} once per round.',
  'rules.belowStakeReturns': 'Because a bad mole can halve the value, a cash-out can return less than your stake.',
  'rules.minCycle': 'There is a minimum of {seconds} seconds between rounds, and you must release and press again to start one.',
  'rules.disconnect.lose': 'If you disconnect during a round, the round continues and settles on the server.',
  'rules.disconnect.cashoutAtDisconnect': 'If you disconnect during a round, the round is cashed out for you at the moment the disconnection is detected.',
  'rules.voidRefund': 'If a system failure prevents a round from settling, the round is voided and your stake is returned.',
  'rules.provablyFair': 'Every round can be verified from its seeds after the seed is revealed. Open the fairness panel to check.',
  'rules.version': 'Version {version} · build {build} · game {config} · market {profile}',
  'rules.close': 'Close',
  'rules.reduceEffects': 'Reduce effects',
  'rules.responsible': 'Set your limits and take breaks. Gambling should stay entertainment.',

  'error.slowConnection': 'Slow connection \u2014 your collect is judged when the server receives it.',
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
