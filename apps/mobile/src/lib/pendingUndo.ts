import { useSyncExternalStore } from "react";

/** An undo offered by one screen and shown by the screen it returns to (Edit group → Groups). */
export type PendingUndo = { id: number; message: string; undo: () => void };

let pending: PendingUndo | undefined;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const offerUndo = ({ message, undo }: { message: string; undo: () => void }): void => {
  pending = { id: nextId++, message, undo };
  emit();
};

/** Clears the offer, unless a newer one has replaced it. */
export const clearUndo = (id: number): void => {
  if (pending?.id !== id) return;
  pending = undefined;
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePendingUndo = (): PendingUndo | undefined => useSyncExternalStore(subscribe, () => pending);
