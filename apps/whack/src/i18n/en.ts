// Player-facing text. Every string the player can read lives here so it can be translated per market
// and reviewed as a whole (GLI-19 §4.4.1 rules content, UK RTS 3/4, PT R7 language).
// Copy rules: no skill or urgency framing, no near-miss language (Spain RD 176/2023 art. 17.2),
// no "would have reached", and never call a return at or below the stake a win (UK RTS 14F).

export const EN = {
  'rules.withholding': 'Winnings may be subject to withholding tax applied by your operator. This game does not calculate or deduct any tax.',
  'result.withholding': 'Tax may apply',
  'rules.rtpBandMissing': 'Measured band unavailable for this configuration \u2014 this figure is incomplete.',
  // Branding and stage
  'logo.whack': 'WHACK',
  'logo.crash': 'CRASH',

  // Stage and controls
  'stage.ready': 'READY?',
  'stage.readySub': 'Cash out before the mole dives.',
  'button.bet': 'BET {amount}',
  'button.whack': 'WHACK!',
  'button.cashOut': 'Cash out {amount}',
  'button.cashingOut': 'Cashing out {amount}…',
  'button.playAgain': 'PLAY AGAIN',
  'button.betAgain': 'BET AGAIN',
  'button.playAgainSub': 'Same bet',
  'button.practice': 'WATCH A ROUND',
  'button.practiceSub': 'No stake, no payout',
  'button.continue': 'CONTINUE',
  'button.continueSub': 'Back to betting',
  'button.wait': 'WAIT {seconds}s',
  'button.waitSub': 'Next round',
  'label.bet': 'Bet',
  // The stake box on the result screen is tappable; without saying so it reads as a readout.
  'label.betTapToChange': 'Bet · tap to change',
  'label.auto': 'Auto',
  'label.autoCashOut': 'AUTO CASH OUT',
  'label.off': 'OFF',
  'label.balance': 'BALANCE',
  'label.betLocked': 'BET LOCKED DURING ROUND',
  'label.winNow': 'WIN NOW {amount}',
  'label.returnNow': 'RETURN NOW {amount}',
  'label.demo': 'DEMO',
  'stage.instantBust': 'BUST!',
  'bet.loading': 'LOADING',
  'bet.gameClosed': 'GAME CLOSED',
  'bet.paused': 'PAUSED',
  'bet.stakeLimit': 'STAKE LIMIT',
  'bet.lossLimit': 'LOSS LIMIT',
  'bet.insufficient': 'INSUFFICIENT BALANCE',
  'result.bonk': 'BONK!',
  // The meter's fixed caption. The right-hand label is the live value (SLOW / MEDIUM / FAST), so a
  // fixed "SLOW" on the left read as "SLOW ... SLOW" and said nothing about what the bar measured.
  // Kept factual rather than urgent: it describes how fast the multiplier is climbing, and copy that
  // pushes the player to act would breach the no-urgency rule (Spain RD 176/2023 art. 17.2, AGCO 2.15).
  'meter.caption': 'PACE',
  'meter.slow': 'SLOW',
  'meter.fast': 'FAST',

  // Results. Only a return above the stake is a win.
  'result.cashedOut': 'CASHED OUT',
  'result.net': '+{amount}',
  'result.returnedEven': 'RETURNED {amount} · NET 0.00',
  'result.returnedBelow': 'RETURNED {amount} · NET -{net}',
  'result.escaped': 'MOLE ESCAPED',
  'result.instantBust': 'INSTANT BUST',
  'result.lost': '-{amount}',
  'result.boost': '+{percent}%',
  'result.setback': '-50%',

  // Session
  'hud.sessionTime': 'SESSION {time}',
  'hud.net': 'NET {amount}',

  // Errors and notices
  'error.insufficientFunds': 'Not enough balance',
  'error.betLimit': 'Bet outside limits',
  'error.roundInProgress': 'Round still running',
  'error.roundVoided': 'Round voided · stake refunded',
  'error.cycleTooSoon': 'Please wait a moment',
  'error.belowMinCashout': 'Cash out from x{min}',
  'error.gameDisabled': 'Game temporarily unavailable',
  'error.network': 'Connection problem',
  'error.startFailed': 'Could not start round',
  'error.reconnecting': 'Reconnecting…',
  'error.slowConnection': 'Slow connection · cash-outs may take longer',
  'error.lossLimit': 'Loss limit reached',

  // Rules panel
  'rules.title': 'How this game works',
  'rules.intro':
    'The multiplier rises from x1.00 until the mole dives. Cash out before it does and you keep the value at the moment the server receives your cash-out.',
  'rules.outcomeFixed':
    'The outcome of every round is fixed before the round starts, by the seeds shown in the fairness panel. Nothing you tap changes it, and the background moles are decoration.',
  'rules.growth': 'The multiplier speeds up over the first {tRamp} seconds, then keeps that speed.',
  'rules.setbacks': 'A bad mole appears about every {every} seconds on average and halves the current value. There is no warning.',
  'rules.boosts': 'A good mole appears about every {every} seconds on average and raises the value by {percent}%. There is no warning.',
  'rules.instantBust': 'About {percent}% of rounds end immediately at x1.00.',
  'rules.rtp': 'Return to player is {rtp}% over a very large number of rounds, and is the same whatever cash-out strategy you use.',
  'rules.rtpBand':
    'Payouts are rounded to whole {currency}, so at the smallest stake of {stake} the measured return ranges from {low}% to {high}%. Larger stakes sit closer to {rtp}%.',
  'rules.maxMultiplier': 'The most a round can pay is x{multiplier}; the round ends there automatically.',
  'rules.tMax': 'A round ends automatically after {seconds} seconds.',
  'rules.minCashout': 'You can cash out from x{multiplier}.',
  'rules.minCashoutNone': 'You can cash out at any value, including below x1.00 after a bad mole.',
  'rules.autoCashout': 'Auto cash-out ends the round for you at a value between x{min} and x{max}. It affects nothing else.',
  'rules.rounding': 'Payouts are worked out exactly and rounded to the nearest whole {currency} once per round.',
  'rules.belowStakeReturns': 'Because a bad mole can halve the value, a cash-out can return less than your stake.',
  'rules.minCycle': 'There is a minimum of {seconds} seconds between rounds, and you must release and press again to start one.',
  'rules.latency':
    'Your cash-out is judged at the time the server receives it, not the time you tapped. There is no allowance for connection delay.',
  'rules.disconnect.lose': 'If you disconnect during a round, the round continues and settles on the server.',
  'rules.disconnect.cashoutAtDisconnect': 'If you disconnect during a round, the round is cashed out for you at the moment the disconnection is detected.',
  'rules.voidRefund': 'If a system failure prevents a round from settling, the round is voided and your stake is returned.',
  'rules.provablyFair': 'Every round can be verified from its seeds after the seed is revealed. Open the fairness panel to check.',
  'rules.version': 'Version {version} · build {build} · game {config} · market {profile}',
  'rules.close': 'Close',
  'rules.reduceEffects': 'Reduce effects',
  'rules.responsible': 'Set your limits and take breaks. Gambling should stay entertainment.',
} as const;

export type MessageKey = keyof typeof EN;

const DEV = import.meta.env.DEV;

/** Looks up a message and fills `{placeholders}`. Missing keys warn in dev and show the key itself. */
export function t(key: MessageKey | string, params: Record<string, string | number> = {}): string {
  const template = (EN as Record<string, string>)[key];
  if (template === undefined) {
    if (DEV) console.warn(`[i18n] missing message key: ${key}`);
    return key;
  }
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}
