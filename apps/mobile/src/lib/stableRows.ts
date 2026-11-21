/**
 * Store queries rebuild every row object on each change, so memoized rows would re-render anyway.
 * A stabilizer hands back the previous object for a key whenever its fields are unchanged.
 */
export type Stabilizer<T extends object> = (key: string, next: T) => T;

const shallowEqual = (a: object, b: object): boolean => {
  const aEntries = Object.entries(a);
  if (aEntries.length !== Object.keys(b).length) return false;
  return aEntries.every(([key, value]) => Object.is(value, (b as Record<string, unknown>)[key]));
};

/** Lists are small (a month of groceries), so remembering every key seen is fine. */
export const createStabilizer = <T extends object>(): Stabilizer<T> => {
  const seen = new Map<string, T>();
  return (key, next) => {
    const kept = seen.get(key);
    if (kept && shallowEqual(kept, next)) return kept;
    seen.set(key, next);
    return next;
  };
};
