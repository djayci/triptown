// The game-neutral crash client: everything a crash game needs that is not its art.
// A game supplies its own stage, scene and wordmark; the compliance behaviours live here so that
// a game implementing none of them still satisfies the presentation and timing rules.
export * from './i18n';
export * from './theme';
export * from './game/display';
export * from './game/view-contract';
export * from './game/view-base';
export * from './game/screen';
export * from './game/controller';
export * from './ui/primitives';
export * from './ui/hud';
export * from './dom/overlay';
export * from './dom/rules-panel';
export * from './dom/history-panel';
export * from './dom/fairness-panel';
