/**
 * Web has no secure enclave; localStorage is scoped to the Mira server's own
 * origin, which is the same trust boundary as the household password itself.
 */
const safe = <T,>(run: () => T, fallback: T): T => {
  try {
    return run();
  } catch {
    return fallback;
  }
};

export const deviceStorage = {
  get: (key: string): string | null => safe(() => window.localStorage.getItem(key), null),
  set: (key: string, value: string): void => safe(() => window.localStorage.setItem(key, value), undefined),
  remove: (key: string): void => safe(() => window.localStorage.removeItem(key), undefined),
};
