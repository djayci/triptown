// Player-facing text for The Cable Car. Every string the player can read lives here so it can be
// translated per market and reviewed as a whole (GLI-19 §4.4.1, UK RTS 3/4, PT R7 language).
// Copy rules: no skill or urgency framing, no near-miss language (Spain RD 176/2023 art. 17.2),
// no "would have reached", and never call a return at or below the stake a win (UK RTS 14F).
// Nothing here may be inherited from another game's theme: The Lift shipped telling players about
// "a bad mole" in a game that had no moles.

export const EN = {
  'rules.withholding': 'Winnings may be subject to withholding tax applied by your operator. This game does not calculate or deduct any tax.',
  'result.withholding': 'Tax may apply',
  'rules.rtpBandMissing': 'Measured band unavailable for this configuration — this figure is incomplete.',
  'logo.the': 'THE',
  'logo.lift': 'CABLE CAR',

  'stage.ready': 'READY?',
  'stage.readySub': 'Ask for the next stop before the car pulls in.',
  'button.bet': 'BET {amount}',
  'button.collect': 'NEXT STOP!',
  'button.cashOut': 'Take {amount}',
  'button.cashingOut': 'Taking {amount}…',
  'button.playAgain': 'RIDE AGAIN',
  'button.playAgainSub': 'Same bet',
  'button.continue': 'CONTINUE',
  'button.continueSub': 'Back to betting',
  'button.wait': 'WAIT {seconds}s',
  'button.waitSub': 'Next round',
  // Shown while the value is locked and the car is still moving. Deliberately not a verb the player
  // can act on: there is nothing to do but wait, and a live-looking control would imply otherwise.
  'button.headingHome': 'NEXT STOP…',

  'label.demo': 'DEMO',
  'label.balance': 'Balance',
  'label.session': 'Session',
  'label.net': 'Net',
  'label.stake': 'Stake',
  'label.auto': 'Auto',

  // The parts of the line the ride passes. Each is entered at a multiplier, so they are decoration
  // over the value and never a hint about where the ride ends. OPEN SKY is deliberately not a
  // destination: any name that sounds like the end of the line would be a progress bar to the crash.
  'stop.valley': 'VALLEY',
  'stop.pineHalt': 'PINE HALT',
  'stop.midway': 'MIDWAY',
  'stop.cloudDeck': 'CLOUD DECK',
  'stop.eaglePoint': 'EAGLE POINT',
  'stop.openSky': 'OPEN SKY',

  'run.winNow': 'NEXT STOP NOW {amount}',
  // While the value is locked: what the amount is worth IF the ride is still running, said as a
  // condition rather than as a sum the player holds.
  'run.headingHome': 'IF THE CAR REACHES THE STOP',
  // The live chance that the ride is still running at the value on screen. Present tense while the
  // player can still act.
  'run.revealChance': 'OPEN ON {chance} OF RIDES AT {multiplier}',
  // The same figure after the press, kept rather than hidden: it is the disclosure that justifies
  // showing a locked value at all, and the player is never more invested than during the wait.
  // Phrased about the VALUE, not about this round, so it stays true for the whole wait — present
  // tense would be false the moment the player has already gone in.
  'run.revealChanceLocked': 'OPEN ON {chance} OF RIDES IN AT {multiplier}',

  'result.cashedOut': 'GOT OFF',
  // Net, not the gross return: a gain is only shown when the player is actually up (RTS 14F).
  'result.net': '+{amount}',
  'result.returnedEven': 'Returned {amount}',
  'result.returnedBelow': 'Returned {amount} · Net {net}',
  'result.crashed': 'THE CAR PULLED IN',
  'result.crashedSub': 'Stake not returned · {amount}',
  'result.instant': 'The car pulled in at the valley station.',

  'rules.title': 'How this game works',
  'rules.growth': 'The multiplier speeds up over the first {tRamp} seconds, then keeps that speed.',
  'rules.setbacks': 'The car slips back about every {every} seconds on average, halving the current value. There is no warning.',
  'rules.boosts': 'The car gets a run of clear line about every {every} seconds on average, raising the value by {percent}%. There is no warning.',
  'rules.instantBust': 'About {percent}% of rounds end immediately at x1.00 — the car pulls in at the valley station.',
  'rules.maxMultiplier': 'The most a round can pay is x{multiplier}; the round ends there automatically.',
  'rules.tMax': 'A round ends automatically after {seconds} seconds.',
  'rules.minCashout': 'You can ask for the next stop from x{multiplier}.',
  'rules.minCashoutNone': 'You can ask for the next stop at any value, including below x1.00 after a slip.',
  'rules.autoCashout': 'Auto stop asks for the next stop for you at a value between x{min} and x{max}. It affects nothing else.',
  'rules.rounding': 'Payouts are worked out exactly and rounded to the nearest whole {currency} once per round.',
  'rules.belowStakeReturns': 'Because a slip can halve the value, asking for the next stop can return less than your stake.',
  'rules.minCycle': 'There is a minimum of {seconds} seconds between rounds, and you must release and press again to start one.',
  'rules.disconnect.lose': 'If you disconnect during a round, the round continues and settles on the server.',
  'rules.disconnect.cashoutAtDisconnect': 'If you disconnect during a round, the round is ended for you at the moment the disconnection is detected.',
  'rules.voidRefund': 'If a system failure prevents a round from settling, the round is voided and your stake is returned.',

  // The deferred reveal, stated plainly. A player who does not read this could reasonably think
  // asking for the next stop secures the amount on screen (GLI-19 §4.4.1).
  'rules.deferred.fixed': 'Where the car stops is decided when the round starts. Nothing you do changes it, and it cannot be predicted.',
  'rules.deferred.locks': 'Asking for the next stop locks the value shown. It does not end the round: the car keeps going, and you find out at the stop whether it was still running when you asked.',
  'rules.deferred.wait': 'The wait is the same length every time, whatever the outcome, and starts when you press. It is not the distance to anything on screen.',
  'rules.deferred.chance': 'The percentage on screen is the share of rides still running at that value, worked out from the game’s stated return to player, not from anything about your round.',
  'rules.deferred.noEdge': 'That percentage multiplied by the value equals the stated return to player at every value. No stopping point returns more than any other over time.',
  'rules.deferred.autoCashout': 'Auto stop does not guarantee a return. It asks for the next stop at your value, and the same wait and the same outcome follow.',
  // The shared rules panel renders a chance section on a deferred market; without these keys it
  // renders the raw key names. Worded as "chance", never "odds" — that word is on the horse game's
  // banned list and the catalogues are reviewed together.
  'rules.introDeferred': 'You are riding a cable car. The longer you stay on, the more your stake is worth — but the car stops somewhere on the line, and if it stops before you have asked to get off, the stake is not returned.',
  'rules.outcomeFixedDeferred': 'Where the car stops is decided when the round starts, from seeds you can check afterwards. Asking for the next stop does not change it, and nothing on screen predicts it.',
  'rules.chance.title': 'Your chance at each value',
  'rules.chance.intro': 'Every value has a chance of still being open when you ask for it. It is worked out from this game\u2019s stated return to player of {rtp}, not from anything about your round.',
  'rules.chance.value': 'Value',
  'rules.chance.chance': 'Still open',
  'rules.chance.return': 'Returns on {stake}',
  'rules.chance.nominal': 'These chances come from the stated return of {rtp}. The published band is measured and includes rounding, so the two figures differ slightly.',
  'rules.chance.onScreen': 'The chance stays on screen while a round runs because the value keeps climbing after the car has stopped. It tells you what the value on screen is still worth asking for.',
  'rules.decoration': 'The stops along the line and the height on the car are decoration over the multiplier, which is the value. Nothing you tap changes where the ride ends.',
  'rules.provablyFair': 'Every round can be verified from its seeds after the seed is revealed. Open the fairness panel to check.',
  'rules.version': 'Version {version} · build {build} · game {config} · market {profile}',
  'rules.close': 'Close',
  'rules.reduceEffects': 'Reduce effects',
  'rules.responsible': 'Set your limits and take breaks. Gambling should stay entertainment.',

  'error.slowConnection': 'Slow connection — your request is judged when the server receives it.',
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
