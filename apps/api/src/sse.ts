import type { RoundEvent } from '@triptown/core';

/** Serializes a round event as one SSE message. */
export function formatSse(event: RoundEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
