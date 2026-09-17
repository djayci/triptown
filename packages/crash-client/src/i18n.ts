// The shared client must not import any one game's message catalogue: a package that knows a game's
// words is not shared. Each app installs its own translator at boot and the client calls through it.
export type Translate = (key: string, params?: Record<string, string | number>) => string;

// Falling back to the key keeps a missing translator visible in the UI rather than crashing a round.
let translate: Translate = (key) => key;

export function setTranslator(fn: Translate): void {
  translate = fn;
}

export function t(key: string, params: Record<string, string | number> = {}): string {
  return translate(key, params);
}
