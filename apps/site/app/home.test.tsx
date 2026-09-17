import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { catalogue } from '../src/catalogue';
import { copy, TRIPTYCH_URL } from '../src/copy';
import { Home, type GateState } from './home';

const noop = async () => {};
const render = (state: GateState, next: string | null = null) =>
  renderToStaticMarkup(<Home state={state} next={next} confirmAction={noop} declineAction={noop} />);

describe('Home', () => {
  it.each<GateState>(['ask', 'declined'])('shows the games greyed out and unlinked in the %s state', (state) => {
    // The return path is the visitor's own requested URL, carried in a hidden field, never a link.
    const html = render(state, '/play/gate/index.html').replace(
      '<input type="hidden" name="next" value="/play/gate/index.html"/>',
      '',
    );
    expect(html).not.toContain('/play/');
    expect(html).not.toContain(copy.games.play);
    for (const e of catalogue) expect(html).toContain(e.name);
    expect(html.match(/row-locked"[^>]*aria-disabled="true"/g)).toHaveLength(2);
    expect(html.match(new RegExp(copy.games.locked.replace('+', '\\+'), 'g'))).toHaveLength(2);
    expect(html).toContain(copy.games.comingSoon);
  });

  it('asks the question with both answers, and the B2B statement', () => {
    const html = render('ask');
    expect(html).toContain(copy.gate.question);
    expect(html).toContain(copy.gate.yes);
    expect(html).toContain(copy.gate.no);
    expect(html).toContain(copy.b2b);
  });

  it('carries the requested demo through the confirmation, only as a hidden field', () => {
    // The ask state never links to it: the value only returns the visitor after they tap YES.
    const html = renderToStaticMarkup(
      <Home state="ask" next="/x" confirmAction={noop} declineAction={noop} />,
    );
    expect(html).toContain('type="hidden" name="next" value="/x"');
  });

  it('shows the exit message when declined, and no answers', () => {
    const html = render('declined');
    expect(html).toContain(copy.gate.declined);
    expect(html).not.toContain(copy.gate.yes);
  });

  it('lists the games once confirmed, with play links only for live games', () => {
    const html = render('confirmed');
    expect(html).toContain(copy.games.playMoney);
    expect(html).toContain('href="/play/whack/index.html"');
    expect(html).toContain('href="/play/gate/index.html"');
    expect(html).toContain('aria-label="Play Whack Crash demo"');
    expect(html).toContain('The Cable Car');
    expect(html).not.toContain('/play/cable-car');
    expect(html).toContain(copy.games.comingSoon);
    expect(html).not.toContain('row-locked');
    expect(html).not.toContain('row-unlock');
    expect(html).not.toContain(copy.games.locked);
    // Rows in catalogue order, after the play-money statement.
    const positions = catalogue.map((e) => html.indexOf(e.name));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.indexOf(copy.games.playMoney)).toBeLessThan(positions[0]!);
  });

  it('powers the rows on only right after confirming', () => {
    const html = renderToStaticMarkup(
      <Home state="confirmed" next={null} justUnlocked confirmAction={noop} declineAction={noop} />,
    );
    expect(html.match(/row-live row-unlock/g)).toHaveLength(2);
    const locked = renderToStaticMarkup(
      <Home state="ask" next={null} justUnlocked confirmAction={noop} declineAction={noop} />,
    );
    expect(locked).not.toContain('row-unlock');
  });

  it.each<GateState>(['ask', 'declined', 'confirmed'])('credits Triptych in the %s state', (state) => {
    const html = render(state);
    expect(html).toContain(copy.poweredBy);
    expect(html).toContain(copy.footer.poweredBy);
    expect(html.split(`href="${TRIPTYCH_URL}"`).length - 1).toBeGreaterThanOrEqual(2);
  });

  it('hides the wordmark band copies from assistive tech', () => {
    const html = render('ask');
    expect(html.match(/<h1[^>]*>TRIPTOWN<\/h1>/g)).toHaveLength(1);
    expect(html.match(/class="word chrome band band-[ab]" aria-hidden="true"/g)).toHaveLength(2);
  });
});
