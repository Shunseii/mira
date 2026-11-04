import { useSyncExternalStore } from "react";

/** Where a screen that grows out of a button (the list's + into Add item) starts from, in window coordinates. */
export type ExpandOrigin = { x: number; y: number; width: number; height: number; radius: number };

let origin: ExpandOrigin | undefined;

/** Kept outside the route params so the frame never ends up in the URL. */
export const setExpandOrigin = (next: ExpandOrigin | undefined): void => {
  origin = next;
};

export const getExpandOrigin = (): ExpandOrigin | undefined => origin;

/** While the morph is on screen it stands in for the button, so the real one hides (or it shows twice). */
let originHidden = false;
const listeners = new Set<() => void>();

export const setOriginHidden = (hidden: boolean): void => {
  if (originHidden === hidden) return;
  originHidden = hidden;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useOriginHidden = (): boolean => useSyncExternalStore(subscribe, () => originHidden);
