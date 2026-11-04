import type { MonthKey } from "./month";

/**
 * cyrb53: a small synchronous 53-bit string hash. Pure JS on purpose: the
 * rollover id must be byte-identical on iOS, Android, web and the server, and
 * must be computable synchronously inside a store transaction.
 */
const cyrb53 = (input: string, seed: number): number => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/** Deterministic ~106-bit id: identical on every device for the same input. */
export const stableHash = (input: string): string =>
  cyrb53(input, 1).toString(36).padStart(11, "0") +
  cyrb53(input, 2).toString(36).padStart(11, "0");

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

export const randomId = (): string => {
  const source = (globalThis as { crypto?: CryptoLike }).crypto;
  if (source?.randomUUID) return source.randomUUID();
  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const normalizeName = (name: string): string =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

/** A carried-over copy of an item: same id no matter which device rolls over. */
export const carriedItemId = ({ sourceItemId, month }: { sourceItemId: string; month: MonthKey }): string =>
  `c${stableHash(`item:${sourceItemId}:${month}`)}`;
