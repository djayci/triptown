import type { CSSProperties } from 'react';
import { catalogue, playUrl, type Entry } from '../src/catalogue';
import { copy, TRIPTYCH_URL } from '../src/copy';

export type GateState = 'ask' | 'declined' | 'confirmed';

type Props = {
  state: GateState;
  next: string | null;
  /** The visitor has just tapped YES: the rows fade into colour once instead of simply appearing unlocked. */
  justUnlocked?: boolean;
  entries?: readonly Entry[];
  confirmAction: (formData: FormData) => void | Promise<void>;
  declineAction: () => void | Promise<void>;
};

/**
 * The whole page, as a pure function of the gate state. Before the visitor confirms, the games are shown
 * greyed out with no links: nothing on the page leads to /play/ (spec: No play without the 18+
 * confirmation), and the server refuses /play/ anyway.
 */
export function Home({ state, next, justUnlocked = false, entries = catalogue, confirmAction, declineAction }: Props) {
  return (
    <div className="page">
      <div className="scanlines" aria-hidden="true" />
      <header className="top">
        <span className="top-chip">{copy.nav.chip}</span>
        <nav aria-label={copy.nav.label} className="nav">
          <a href="#games">{copy.nav.games}</a>
          <a href={TRIPTYCH_URL}>{copy.nav.triptych}</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <Wordmark />
          <div className="rule" aria-hidden="true" />
          <p className="tagline reveal" style={delay(0.15)}>
            {copy.tagline}
          </p>
          <p className="powered reveal" style={delay(0.3)}>
            {copy.poweredBy} <a href={TRIPTYCH_URL}>{copy.triptych}</a>.
          </p>
        </section>

        {state === 'ask' && (
          <section className="bar reveal" style={delay(0.45)} aria-labelledby="gate-question">
            <div className="bar-text">
              <p id="gate-question">{copy.gate.question}</p>
              <p className="muted">{copy.b2b}</p>
            </div>
            <div className="bar-actions">
              <form action={confirmAction}>
                {next && <input type="hidden" name="next" value={next} />}
                <button type="submit" className="btn btn-solid">
                  {copy.gate.yes}
                </button>
              </form>
              <form action={declineAction}>
                <button type="submit" className="btn btn-ghost">
                  {copy.gate.no}
                </button>
              </form>
            </div>
          </section>
        )}

        {state === 'declined' && (
          <section className="bar reveal" style={delay(0.2)} role="status">
            <p>{copy.gate.declined}</p>
          </section>
        )}

        <section
          id="games"
          className={state === 'confirmed' ? 'games' : 'games games-locked'}
          aria-labelledby="games-heading"
        >
          <div className="games-head reveal" style={delay(0.55)}>
            <h2 id="games-heading">
              {copy.games.heading}
              <span className="games-swipe" aria-hidden="true">
                {copy.games.swipe}
              </span>
            </h2>
            <p>{copy.games.playMoney}</p>
          </div>
          <div className="games-track">
            {entries.map((entry, i) => (
              <GameRow
                key={entry.slug}
                entry={entry}
                index={i}
                locked={state !== 'confirmed'}
                unlocking={state === 'confirmed' && justUnlocked}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="foot">
        <span>{copy.footer.left}</span>
        <span>
          {copy.footer.poweredBy} <a href={TRIPTYCH_URL}>{copy.footer.triptych}</a>
        </span>
      </footer>
    </div>
  );
}

/** Entrance stagger, in seconds. */
const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

/**
 * Chrome wordmark. The two band copies carry the VHS wobble: invisible except for a moment in each cycle,
 * so the word itself never moves (spec: The wordmark barely moves).
 */
function Wordmark() {
  return (
    <div className="wordmark">
      <h1 className="word chrome">{copy.wordmark}</h1>
      <div className="word chrome band band-a" aria-hidden="true">
        {copy.wordmark}
      </div>
      <div className="word chrome band band-b" aria-hidden="true">
        {copy.wordmark}
      </div>
    </div>
  );
}

type RowProps = { entry: Entry; index: number; locked: boolean; unlocking: boolean };

function GameRow({ entry, index, locked, unlocking }: RowProps) {
  // Locked rows carry no href at all, so there is nothing to click, tab to or copy.
  const href = locked ? null : playUrl(entry);
  const soon = entry.status !== 'live';
  const state = soon ? 'row-soon' : locked ? 'row-locked' : unlocking ? 'row-live row-unlock' : 'row-live';
  const style = {
    '--accent': entry.accent,
    animationDelay: `${0.65 + index * 0.1}s`,
    '--unlock-delay': `${0.25 + index * 0.18}s`,
  } as CSSProperties;
  return (
    <article className={`row reveal ${state}`} style={style} aria-disabled={locked && !soon ? true : undefined}>
      <div className="spine" aria-hidden="true" />
      {entry.tile ? (
        <LogoTile entry={entry} theme={entry.tile} />
      ) : (
        <div className="preview preview-empty" aria-hidden="true">
          {copy.games.noSignal}
        </div>
      )}
      <div className="row-body">
        <h3>{entry.name}</h3>
        <p>{entry.pitch}</p>
      </div>
      {soon ? (
        <span className="row-play row-play-soon">{copy.games.comingSoon}</span>
      ) : href ? (
        <a className="row-play" href={href} aria-label={copy.games.playLabel(entry.name)}>
          <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true">
            <path d="M0 0 L14 8 L0 16 Z" fill="currentColor" />
          </svg>
          {copy.games.play}
        </a>
      ) : (
        <span className="row-play row-play-locked">{copy.games.locked}</span>
      )}
    </article>
  );
}

/**
 * The game's logo sticker on its own backdrop, in the game's colours and lettering: a tilted pink
 * sticker with a thick ink outline, as the game draws it in its HUD. No characters, no multiplier.
 */
function LogoTile({ entry, theme }: { entry: Entry; theme: NonNullable<Entry['tile']> }) {
  return (
    <div className={`preview tile tile-${theme}`} role="img" aria-label={copy.games.logoLabel(entry.name)}>
      <div className="tile-ground" aria-hidden="true" />
      <div className="sticker" aria-hidden="true">
        <span className="sticker-a">{entry.logo[0]}</span>
        <span className="sticker-b">{entry.logo[1]}</span>
      </div>
    </div>
  );
}
