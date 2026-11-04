import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import type { MergeableStore } from "tinybase";
import { createExpoSqlitePersister, type ExpoSqlitePersister } from "tinybase/persisters/persister-expo-sqlite";
import { deviceStorage } from "@/lib/deviceStorage";

export type LocalPersister = { stop: () => Promise<void> };

const TABLE = "mira_household";
/** How long a save waits for someone else's lock on the file before giving up. */
const BUSY_TIMEOUT_MS = 2000;

type Connection = { file: string; db: SQLiteDatabase; persister: ExpoSqlitePersister };

/**
 * Native: one SQLite file per household server, holding the MergeableStore as
 * JSON (the only mode TinyBase supports for MergeableStore on expo-sqlite).
 *
 * A JS reload (an over-the-air update, or a dev reload) that lands mid-save can
 * leave the old runtime's connection open, still holding the file's write lock.
 * Every later save from the new runtime then fails, and the next launch loads a
 * stale copy. If saving fails, persistence moves to a fresh file (written from
 * the store straight away) and remembers it, so a stuck lock can only ever
 * strand a file, never the data. The stranded file is deleted on a later launch.
 */
export const startLocalPersistence = async ({ store, dbName }: { store: MergeableStore; dbName: string }): Promise<LocalPersister> => {
  const currentFileKey = `mira.dbFile.${dbName}`;
  const strandedFileKey = `mira.dbStranded.${dbName}`;

  const stranded = deviceStorage.get(strandedFileKey);
  if (stranded) {
    try {
      deleteDatabaseSync(`${stranded}.db`);
      deviceStorage.remove(strandedFileKey);
    } catch (error) {
      console.warn("[persister] couldn't delete stranded file yet", error);
    }
  }

  let loaded = false;
  let switching = false;
  let switched = false;

  const open = (file: string): Connection => {
    const db = openDatabaseSync(`${file}.db`);
    db.execSync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    const persister = createExpoSqlitePersister(store, db, TABLE, undefined, (error: unknown) => {
      console.warn("[persister] save or load failed", { file, error });
      if (loaded && !switching && !switched) void moveToFreshFile();
    });
    return { file, db, persister };
  };

  let current = open(deviceStorage.get(currentFileKey) ?? dbName);

  const moveToFreshFile = async () => {
    switching = true;
    const stuck = current;
    try {
      await stuck.persister.stopAutoSave();
      const fresh = open(`${dbName}-${Date.now().toString(36)}`);
      await fresh.persister.save();
      await fresh.persister.startAutoSave();
      current = fresh;
      switched = true;
      deviceStorage.set(currentFileKey, fresh.file);
      deviceStorage.set(strandedFileKey, stuck.file);
      console.warn(`[persister] saving to ${stuck.file} failed; now saving to ${fresh.file}`);
    } catch (error) {
      console.warn("[persister] couldn't move to a fresh file", error);
    } finally {
      switching = false;
    }
  };

  await current.persister.load();
  loaded = true;
  await current.persister.startAutoSave();

  return {
    stop: async () => {
      await current.persister.save();
      await current.persister.destroy();
      try {
        current.db.closeSync();
      } catch {
        // The native side may already be gone (app reload, dev refresh); nothing left to close.
      }
    },
  };
};
