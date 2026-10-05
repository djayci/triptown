import { describe, expect, it } from 'vitest';
import { LOBBY_GAP_MS, lobbyDelay } from './flock-audio';

describe('lobbyDelay', () => {
  it('holds the lobby until the cue ends, offset by the gap', () => {
    expect(lobbyDelay(1000, 3600)).toBe(3600 + LOBBY_GAP_MS - 1000);
  });
  it('starts at once when no cue is playing', () => {
    expect(lobbyDelay(10_000, 3600)).toBe(0);
    expect(lobbyDelay(10_000, 0)).toBe(0);
  });
});
