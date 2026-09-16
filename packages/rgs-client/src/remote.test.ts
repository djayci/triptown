import { describe, expect, it } from 'vitest';
import { RemoteRoundService } from './remote';

const sse = (events: object[]) =>
  new Response(events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  });

describe('RemoteRoundService', () => {
  it('sends the client version on session creation and ends a stream on VOID', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/v1/sessions')) return Response.json({ token: 't' }, { status: 201 });
      return sse([
        { type: 'START', roundId: 'r1', startedAt: 1, serverNow: 1 },
        { type: 'VOID', roundId: 'r1', refundMinor: 100, balanceMinor: 1_000 },
      ]);
    }) as typeof fetch;
    const service = new RemoteRoundService({ baseUrl: 'https://api.test', fetch: fetchImpl, clientVersion: 'whack@2.0.0' });
    const handle = await service.watchRound('r1', () => {});
    expect(await handle.ended).toMatchObject({ type: 'VOID', refundMinor: 100 });
    expect(calls[0]).toEqual({ url: 'https://api.test/v1/sessions', body: { clientVersion: 'whack@2.0.0' } });
  });

  it('keeps server error details such as retryAfterMs', async () => {
    const fetchImpl = (async (url: string) =>
      url.endsWith('/v1/sessions')
        ? Response.json({ token: 't' }, { status: 201 })
        : Response.json({ error: { code: 'cycle_too_soon', message: 'wait', retryAfterMs: 1_200 } }, { status: 429 })) as typeof fetch;
    const service = new RemoteRoundService({ baseUrl: 'https://api.test', fetch: fetchImpl });
    await expect(service.startRound({ betMinor: 100 }, () => {})).rejects.toMatchObject({ code: 'cycle_too_soon', details: { retryAfterMs: 1_200 } });
  });
});
