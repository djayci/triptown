import { describeRules, formatMinor, type RuleItem, type SessionInfo } from '@triptown/core';
import { Dialog, el } from './dialog';

// Rules and help, generated from the session's config and profile through core's describeRules, so every
// number shown is the one the server plays with. English copy lives here; other languages add a catalogue.

const pct = (x: number, digits = 2) => `${(x * 100).toFixed(digits)}%`;
const mult = (x: number) => `x${x.toFixed(2)}`;

export function ruleText(item: RuleItem, s: SessionInfo): string {
  const p = item.params;
  const money = (minor: unknown) => `${formatMinor(Number(minor), s.currency)} ${s.currency.code}`;
  switch (item.key) {
    case 'growth':
      return `The multiplier starts at x1.00 and grows over time. It speeds up during the first ${p.tRamp} seconds, then grows at a steady maximum rate.`;
    case 'setbacks':
      return `Setbacks happen at random, about ${Number(p.ratePerSecond).toFixed(2)} per second on average, with no warning. Each one multiplies the current value by ${p.factor} (shown as a puddle splash).`;
    case 'instantBust':
      return `${pct(Number(p.probability), 1)} of rounds end immediately at x1.00.`;
    case 'rtp':
      return `The return to player is ${pct(Number(p.rtp))}, the same whatever you do: throwing early, late, in parts or never.${
        p.bandMinRtp !== undefined ? ` Because payouts are rounded to the currency unit, the return at the smallest stake (${money(p.bandStakeMinor)}) can range from ${pct(Number(p.bandMinRtp))} to ${pct(Number(p.bandMaxRtp))}.` : ''
      }`;
    case 'maxMultiplier':
      return `The maximum multiplier is ${mult(Number(p.multiplier))}. When it is reached, everything still riding is settled at that value.`;
    case 'tMax':
      return `A round lasts at most ${p.seconds} seconds; anything still riding is then settled at the current value.`;
    case 'minCashout':
      return `Throws and cash-outs are accepted from ${mult(Number(p.multiplier))}.`;
    case 'papers':
      return `Your stake is split into ${p.count} equal papers. Each paper is part of the same round and the same stake.`;
    case 'throwTiming':
      return 'THROW settles one paper and ALL settles every remaining paper, at the multiplier when our server receives your request.';
    case 'minPaperValue':
      return `Each paper must be worth at least ${money(p.minor)}.`;
    case 'roundRounding':
      return 'Paper returns are added up exactly and the round total is rounded once, to the nearest currency unit (half up).';
    case 'wipeout':
      return 'If the round ends in a wipeout, papers you have not thrown are lost. Papers already thrown keep their return.';
    case 'disconnectRemainingPapers':
      return p.policy === 'cashout-at-disconnect'
        ? 'If you disconnect, papers not yet thrown are settled at the multiplier when we detect the disconnection, if the round has not ended.'
        : 'If you disconnect, papers not yet thrown keep riding until your auto target, a cap or the wipeout.';
    case 'landingIsDecoration':
      return 'Where a paper lands and what the courier does are decoration only. They never change the result.';
    case 'autoCashout':
      return `You can set an auto target from ${mult(Number(p.minimum))} to ${mult(Number(p.maximum))}.${p.settlesRemainingPapers ? ' When it is reached, all remaining papers are settled.' : ''}`;
    case 'rounding':
      return `Returns are rounded to the currency unit once per round. The minimum stake is ${money(p.minStakeMinor)}.`;
    case 'belowStakeReturns':
      return 'After a setback a return can be less than the stake it came from.';
    case 'minCycle':
      return `A new round can start ${(Number(p.ms) / 1000).toFixed(1)} seconds after the previous one started.`;
    case 'latency':
      return 'Actions are judged at the moment our server receives them. Network delay can make a throw land later than you tapped, or after the round has ended.';
    case 'disconnect':
      return p.policy === 'cashout-at-disconnect'
        ? 'If you lose connection, the round is settled when we detect it. Reconnecting shows the result.'
        : 'If you lose connection, the round keeps running on our server. Reconnecting shows the result.';
    case 'voidRefund':
      return 'If our system fails during a round, the round is voided and your stake is refunded.';
    case 'provablyFair':
      return 'Every round is decided by a server seed committed in advance, your client seed and a counter. After you change seeds, you can check every past round in the Fairness section.';
    case 'outcomeFixed':
      return 'The outcome is fixed before the round starts. Tapping, timing tricks or decorations cannot change it.';
    default:
      return item.key;
  }
}

export class RulesPanel {
  private readonly dialog = new Dialog('Rules and help', 'pr-rules');

  constructor(private readonly build: { version: string; hash: string }) {}

  open(session: SessionInfo, onFairness?: () => void): void {
    const items = describeRules(session.config, session.profile, session.currency);
    const body = this.dialog.body;
    body.replaceChildren();
    const list = el('ul');
    list.dataset.part = 'rules';
    for (const item of items) {
      const li = el('li', ruleText(item, session));
      li.dataset.rule = item.key;
      list.appendChild(li);
    }
    body.append(list);
    if (onFairness) {
      const b = el('button', 'Fairness and seeds');
      b.onclick = () => {
        this.dialog.close();
        onFairness();
      };
      body.append(el('h3', 'Verify'), b);
    }
    body.append(el('h3', 'About this game'));
    const about = el('p', `Paper Route ${this.build.version} (build ${this.build.hash}) · config ${session.config.id} · profile ${session.profile.name}`, 'muted');
    about.dataset.part = 'version';
    body.append(about);
    this.dialog.show();
  }
}
