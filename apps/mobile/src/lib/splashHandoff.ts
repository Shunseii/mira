import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

export type Rect = { x: number; y: number; width: number; height: number };

export type WordmarkVariant = "wordmark" | "wordmarkHero";

export type HandoffTarget = {
  variant: WordmarkVariant;
  /** The Text's box, in window coordinates. */
  box: Rect;
  /** Where the wordmark's ink sits, in window coordinates. */
  ink: Rect;
  textAlign: "left" | "right";
};

type HandoffState = {
  target?: HandoffTarget;
  /** The overlay has handed over; the real wordmark shows from here on. */
  done: boolean;
};

// Only native apps have a native splash to hand over from.
let state: HandoffState = { done: Platform.OS === "web" };
const listeners = new Set<() => void>();

const update = (patch: Partial<HandoffState>) => {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The launch handoff between SplashOverlay, which glides the splash wordmark into
 * place, and the on-screen wordmark it lands on (home header or login).
 */
export const splashHandoff = {
  get: () => state,
  subscribe,
  setTarget: (target: HandoffTarget) => {
    if (!state.done) update({ target });
  },
  finish: () => {
    if (!state.done) update({ done: true });
  },
};

export const useSplashHandoff = (): HandoffState => useSyncExternalStore(subscribe, splashHandoff.get, splashHandoff.get);
