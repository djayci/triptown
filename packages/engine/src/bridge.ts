// Operator bridge (compliance-baseline 8.2, design D18): versioned postMessage protocol between a game and
// the operator page that embeds it. Messages go only to a parent origin listed in the profile's
// operatorOrigins, never to '*', and inbound commands are accepted only from that parent.
// No DOM rendering, no Pixi and no round knowledge: payloads are plain numbers and strings.

export const BRIDGE_PROTOCOL = 'triptown';
export const BRIDGE_VERSION = 1;

export type ResultKind = 'win' | 'even' | 'loss';

export type BridgeOutbound =
  | { type: 'gameReady'; payload: { version: string; configId: string; profile: string } }
  | { type: 'balance'; payload: { balanceMinor: number; currency: string } }
  | { type: 'roundStarted'; payload: { roundId: string; stakeMinor: number } }
  | { type: 'roundEnded'; payload: { roundId: string; stakeMinor: number; returnMinor: number; netMinor: number; kind: ResultKind } }
  | { type: 'error'; payload: { code: string; message?: string } };

export interface BridgeEnvelope<T extends { type: string; payload: unknown } = BridgeOutbound> {
  protocol: typeof BRIDGE_PROTOCOL;
  version: typeof BRIDGE_VERSION;
  type: T['type'];
  payload: T['payload'];
}

export interface BridgeHandlers {
  pause?(payload: { message?: string }): void;
  resume?(): void;
  closeGame?(): void;
  setLimits?(payload: { stakeLimitMinor?: number; lossLimitMinor?: number }): void;
  showMessage?(payload: { text: string }): void;
}

/** The slice of `window` the bridge uses, so tests can pass a fake. */
export interface BridgeWindow {
  parent: { postMessage(message: unknown, targetOrigin: string): void } | BridgeWindow;
  location: { ancestorOrigins?: ArrayLike<string> };
  document: { referrer: string };
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

function originOf(url: string): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}

/**
 * The embedding page's origin if it is one of `allowedOrigins`, otherwise null. Uses
 * `location.ancestorOrigins[0]` where the browser provides it, falling back to the referrer's origin.
 */
export function resolveParentOrigin(win: BridgeWindow, allowedOrigins: readonly string[]): string | null {
  if ((win.parent as unknown) === (win as unknown)) return null; // top-level: not embedded
  const candidate = win.location.ancestorOrigins?.[0] ?? originOf(win.document.referrer);
  return candidate && allowedOrigins.includes(candidate) ? candidate : null;
}

/** Only a return above the stake is a win (UKGC RTS 14F, AGCO 2.20); mirrors core's resultKind. */
export function bridgeResultKind(stakeMinor: number, returnMinor: number): ResultKind {
  if (returnMinor > stakeMinor) return 'win';
  return returnMinor === stakeMinor ? 'even' : 'loss';
}

const isLimit = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export class OperatorBridge {
  /** The pinned parent origin, or null when the game is standalone or the parent is not allowed. */
  readonly targetOrigin: string | null;
  private readonly listener = (event: MessageEvent) => this.onMessage(event);

  constructor(
    private readonly opts: { allowedOrigins: readonly string[]; handlers?: BridgeHandlers; win?: BridgeWindow },
  ) {
    const win = this.win;
    this.targetOrigin = win ? resolveParentOrigin(win, opts.allowedOrigins) : null;
    if (win && this.targetOrigin) win.addEventListener('message', this.listener);
  }

  private get win(): BridgeWindow | undefined {
    return this.opts.win ?? (typeof window === 'undefined' ? undefined : (window as unknown as BridgeWindow));
  }

  get active(): boolean {
    return this.targetOrigin !== null;
  }

  send(message: BridgeOutbound): void {
    const win = this.win;
    if (!win || !this.targetOrigin) return;
    const envelope: BridgeEnvelope = { protocol: BRIDGE_PROTOCOL, version: BRIDGE_VERSION, type: message.type, payload: message.payload };
    (win.parent as { postMessage(m: unknown, o: string): void }).postMessage(envelope, this.targetOrigin);
  }

  gameReady(version: string, configId: string, profile: string): void {
    this.send({ type: 'gameReady', payload: { version, configId, profile } });
  }

  balance(balanceMinor: number, currency: string): void {
    this.send({ type: 'balance', payload: { balanceMinor, currency } });
  }

  roundStarted(roundId: string, stakeMinor: number): void {
    this.send({ type: 'roundStarted', payload: { roundId, stakeMinor } });
  }

  roundEnded(roundId: string, stakeMinor: number, returnMinor: number): void {
    this.send({
      type: 'roundEnded',
      payload: { roundId, stakeMinor, returnMinor, netMinor: returnMinor - stakeMinor, kind: bridgeResultKind(stakeMinor, returnMinor) },
    });
  }

  error(code: string, message?: string): void {
    this.send({ type: 'error', payload: { code, ...(message !== undefined && { message }) } });
  }

  dispose(): void {
    this.win?.removeEventListener('message', this.listener);
  }

  private onMessage(event: MessageEvent): void {
    const win = this.win;
    if (!win || !this.targetOrigin) return;
    if ((event.source as unknown) !== (win.parent as unknown) || event.origin !== this.targetOrigin) return;
    const data = event.data as Partial<BridgeEnvelope<{ type: string; payload: unknown }>> | null;
    if (!data || data.protocol !== BRIDGE_PROTOCOL || data.version !== BRIDGE_VERSION) return;
    const payload = (data.payload ?? {}) as Record<string, unknown>;
    const h = this.opts.handlers ?? {};
    switch (data.type) {
      case 'pause':
        h.pause?.({ ...(typeof payload.message === 'string' && { message: payload.message.slice(0, 500) }) });
        break;
      case 'resume':
        h.resume?.();
        break;
      case 'closeGame':
        h.closeGame?.();
        break;
      case 'setLimits':
        h.setLimits?.({
          ...(isLimit(payload.stakeLimitMinor) && { stakeLimitMinor: payload.stakeLimitMinor }),
          ...(isLimit(payload.lossLimitMinor) && { lossLimitMinor: payload.lossLimitMinor }),
        });
        break;
      case 'showMessage':
        if (typeof payload.text === 'string') h.showMessage?.({ text: payload.text.slice(0, 500) });
        break;
    }
  }
}
