import type { MergeableStore } from "tinybase";
import { createIndexedDbPersister } from "tinybase/persisters/persister-indexed-db";

export type LocalPersister = { stop: () => Promise<void> };

/** Web/PWA: IndexedDB (supports MergeableStore since TinyBase 9.6). No wasm SQLite needed. */
export const startLocalPersistence = async ({ store, dbName }: { store: MergeableStore; dbName: string }): Promise<LocalPersister> => {
  const persister = createIndexedDbPersister(store, dbName);
  await persister.load();
  await persister.startAutoSave();
  return {
    stop: async () => {
      await persister.save();
      await persister.destroy();
    },
  };
};
