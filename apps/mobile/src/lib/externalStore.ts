import { useSyncExternalStore } from "react";

/** Minimal observable value for app-level state that lives outside React. */
export const createExternalStore = <T,>(initial: T) => {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: (): T => value,
    set: (next: T | ((previous: T) => T)): void => {
      value = typeof next === "function" ? (next as (previous: T) => T)(value) : next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export type ExternalStore<T> = ReturnType<typeof createExternalStore<T>>;

export const useExternalStore = <T,>(store: ExternalStore<T>): T =>
  useSyncExternalStore(store.subscribe, store.get, store.get);
