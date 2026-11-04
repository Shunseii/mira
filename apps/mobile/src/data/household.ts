import { authProtocols, monthKeyOf, rollover, stableHash, touchUser } from "@mira/shared";
import { addNetworkStateListener } from "expo-network";
import { AppState, type NativeEventSubscription } from "react-native";
import { createMergeableStore, type MergeableStore } from "tinybase";
import { createWsSynchronizer, type WsSynchronizer } from "tinybase/synchronizers/synchronizer-ws-client";
import { deviceStorage } from "@/lib/deviceStorage";
import { createExternalStore } from "@/lib/externalStore";
import { startLocalPersistence, type LocalPersister } from "./persister";
import { checkPassword, syncSocketUrl } from "./server";

export type SyncStatus = "connecting" | "online" | "offline" | "unauthorized";

export type HouseholdState = {
  /** Local data loaded from disk; the UI can render. */
  ready: boolean;
  status: SyncStatus;
  /** "table/rowId" keys changed on this device since the last completed sync. */
  pending: string[];
  /** At least one full sync with the server has completed on this device. */
  hasSynced: boolean;
};

export type Household = {
  store: MergeableStore;
  state: ReturnType<typeof createExternalStore<HouseholdState>>;
  /** Every local change goes through here so offline edits can be tracked. */
  write: (change: (store: MergeableStore) => void) => void;
  /** Reconnect now if not online (pull-to-refresh, foreground, network back). */
  nudge: () => void;
  stop: () => Promise<void>;
};

const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];
const OPEN_TIMEOUT_MS = 8000;

const openSocket = ({ url, password }: { url: string; password: string }): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(url, authProtocols(password));
    const timer = setTimeout(() => fail(new Error("timeout")), OPEN_TIMEOUT_MS);
    const fail = (error: Error) => {
      clearTimeout(timer);
      socket.onopen = socket.onerror = socket.onclose = null;
      try {
        socket.close();
      } catch {
        // already closed
      }
      reject(error);
    };
    socket.onopen = () => {
      clearTimeout(timer);
      socket.onopen = socket.onerror = socket.onclose = null;
      resolve(socket);
    };
    socket.onerror = () => fail(new Error("socket error"));
    socket.onclose = () => fail(new Error("socket closed"));
  });

export const startHousehold = async ({
  serverUrl,
  password,
  getUserId,
}: {
  serverUrl: string;
  password: string;
  getUserId: () => string | undefined;
}): Promise<Household> => {
  const dbName = `mira-${stableHash(serverUrl)}`;
  const pendingKey = `mira.pending.${dbName}`;
  const syncedKey = `mira.synced.${dbName}`;
  const loadPending = (): string[] => {
    try {
      const parsed: unknown = JSON.parse(deviceStorage.get(pendingKey) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [];
    } catch {
      return [];
    }
  };

  const store = createMergeableStore();
  const state = createExternalStore<HouseholdState>({
    ready: false,
    status: "connecting",
    pending: loadPending(),
    hasSynced: deviceStorage.get(syncedKey) === "1",
  });
  const patch = (next: Partial<HouseholdState>) => state.set((previous) => ({ ...previous, ...next }));
  const setPending = (pending: string[]) => {
    deviceStorage.set(pendingKey, JSON.stringify(pending));
    patch({ pending });
  };

  let localWriteDepth = 0;
  store.addDidFinishTransactionListener(() => {
    if (localWriteDepth === 0 || state.get().status === "online") return;
    const [changedTables] = store.getTransactionChanges();
    const touched = Object.entries(changedTables).flatMap(([tableId, rows]) =>
      Object.keys(rows ?? {}).map((rowId) => `${tableId}/${rowId}`),
    );
    if (touched.length > 0) setPending([...new Set([...state.get().pending, ...touched])]);
  });

  const write: Household["write"] = (change) => {
    localWriteDepth++;
    try {
      store.transaction(() => change(store));
    } finally {
      localWriteDepth--;
    }
  };

  const housekeeping = () => {
    write((s) => {
      rollover({ store: s, month: monthKeyOf(new Date()) });
      const userId = getUserId();
      if (userId) touchUser({ store: s, userId });
    });
  };

  let persister: LocalPersister | undefined;
  let synchronizer: WsSynchronizer<WebSocket> | undefined;
  let socket: WebSocket | undefined;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connecting = false;
  let stopped = false;

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer || state.get().status === "unauthorized") return;
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)] ?? 30_000;
    attempt++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, delay);
  };

  const dropConnection = async () => {
    const old = synchronizer;
    synchronizer = undefined;
    socket = undefined;
    // A fresh synchronizer per connection sidesteps TinyBase 10.0's
    // reconnect-in-place bug (fixed in 10.1).
    await old?.destroy().catch(() => undefined);
  };

  const connect = async (): Promise<void> => {
    if (stopped || connecting || synchronizer) return;
    connecting = true;
    try {
      const opened = await openSocket({ url: syncSocketUrl(serverUrl), password });
      if (stopped) {
        opened.close();
        return;
      }
      socket = opened;
      const created = await createWsSynchronizer(store, opened, 2);
      synchronizer = created;
      opened.addEventListener("close", () => {
        if (synchronizer !== created) return;
        patch({ status: "offline" });
        void dropConnection().then(scheduleReconnect);
      });
      await created.startSync();
      attempt = 0;
      deviceStorage.set(syncedKey, "1");
      patch({ status: "online", hasSynced: true });
      setPending([]);
      housekeeping();
    } catch {
      await dropConnection();
      const check = await checkPassword({ serverUrl, password });
      patch({ status: check === "wrong" ? "unauthorized" : "offline" });
      scheduleReconnect();
    } finally {
      connecting = false;
    }
  };

  const nudge = () => {
    if (stopped || synchronizer || connecting || state.get().status === "unauthorized") return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    attempt = 0;
    void connect();
  };

  persister = await startLocalPersistence({ store, dbName });
  patch({ ready: true });
  housekeeping();
  void connect();

  const appState: NativeEventSubscription = AppState.addEventListener("change", (next) => {
    if (next !== "active") return;
    housekeeping();
    nudge();
  });
  const network = addNetworkStateListener((network) => {
    if (network.isConnected) nudge();
  });

  return {
    store,
    state,
    write,
    nudge,
    stop: async () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      appState.remove();
      network.remove();
      const openSocketRef = socket;
      await dropConnection();
      openSocketRef?.close();
      await persister?.stop();
      persister = undefined;
    },
  };
};
