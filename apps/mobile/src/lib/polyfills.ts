import * as ExpoCrypto from "expo-crypto";

type CryptoShape = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
};

/** Hermes lacks Web Crypto; shared code expects crypto.randomUUID / getRandomValues. */
const globalWithCrypto = globalThis as { crypto?: CryptoShape };
globalWithCrypto.crypto ??= {};
globalWithCrypto.crypto.randomUUID ??= () => ExpoCrypto.randomUUID();
globalWithCrypto.crypto.getRandomValues ??= <T extends ArrayBufferView | null>(array: T): T => {
  if (array instanceof Uint8Array) ExpoCrypto.getRandomValues(array);
  return array;
};
