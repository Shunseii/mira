import { authProtocols, monthKeyOf, rollover, stableHash, touchUser } from "@mira/shared";
import { addNetworkStateListener, getNetworkStateAsync } from "expo-network";
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
  /** When it last came back online after showing offline (for a brief "Synced"). */
  reconnectedAt?: number;
};

export type Household = {
  store: MergeableStore;
  state: ReturnType<typeof createExternalStore<HouseholdState>>;
  /** Every local change goes through here so offline edits can be tracked. */
  write: (change: (store: MergeableStore) => void) => void;
  /**
   * Reconnect now if not online. `asked`: the person asked (pull-to-refresh, the pill), so a failed
   * attempt shows offline at once instead of retrying quietly first.
   */
  nudge: (options?: { asked?: boolean }) => Promise<void>;
  stop: () => Promise<void>;
};

const BACKOFF_MS = [1000, 2000, 5000, 10_000, 30_000];
const OPEN_TIMEOUT_MS = 8000;
/** How long after the last offline change the waiting-to-sync list is saved to the device. */
const PENDING_PERSIST_MS = 500;

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
  let shownOffline = false;
  const setStatus = (status: SyncStatus) => {
    const reconnected = status === "online" && shownOffline;
    if (status === "offline") shownOffline = true;
    if (status === "online" || status === "unauthorized") shownOffline = false;
    patch({ status, ...(reconnected ? { reconnectedAt: Date.now() } : {}) });
  };
  // Saved a moment later and coalesced: a Keychain/Keystore write on every offline tap would hold up the tap itself.
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const setPending = (pending: string[]) => {
    patch({ pending });
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = undefined;
      deviceStorage.set(pendingKey, JSON.stringify(state.get().pending));
    }, PENDING_PERSIST_MS);
  };

  let localWriteDepth = 0;
  store.addDidFinishTransactionListener(() => {
    if (localWriteDepth === 0 || state.get().status === "online") return;
    const [changedTables] = store.getTransactionChanges();
    const touched = Object.entries(changedTables).flatMap(([tableId, rows]) =>
      Object.keys(rows ?? {}).map((rowId) => `${tableId}/${rowId}`),
    );
    const known = new Set(state.get().pending);
    const added = touched.filter((key) => !known.has(key));
    if (added.length > 0) setPending([...known, ...added]);
  });

  const write: Household["write"] = (change) => {
    localWriteDepth++;
    try {
      store.transaction(() => change(store));
    } finally {
      localWriteDepth--;
    }
  };

  // Bookkeeping the app does on its own (carrying items into a new month, "last seen"), so it skips
  // write(): it still syncs, but it isn't a change the person made and shouldn't count as waiting to sync.
  const housekeeping = () => {
    store.transaction(() => {
      rollover({ store, month: monthKeyOf(new Date()) });
      const userId = getUserId();
      if (userId) touchUser({ store, userId });
    });
  };

  let persister: LocalPersister | undefined;
  let synchronizer: WsSynchronizer<WebSocket> | undefined;
  let socket: WebSocket | undefined;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let connecting = false;
  let stopped = false;
  /** The OS says there's no network, so don't try (it would only hang until a timeout). */
  let networkDown = false;
  /** Someone asked for this attempt, so a failure shouldn't hide behind a quiet retry. */
  let asked = false;

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

  let inFlight: Promise<void> | undefined;
  /** One attempt at a time; callers during an attempt wait for that one. */
  const connect = (): Promise<void> => {
    if (stopped || synchronizer) return Promise.resolve();
    if (networkDown) {
      if (state.get().status !== "unauthorized") setStatus("offline");
      return Promise.resolve();
    }
    inFlight ??= attemptConnection().finally(() => {
      inFlight = undefined;
    });
    return inFlight;
  };

  const attemptConnection = async (): Promise<void> => {
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
        // The OS often drops the socket while the app is in the background, so this usually fires on
        // resume. Reconnect straight away and only call it offline if that attempt fails too.
        setStatus("connecting");
        void dropConnection().then(connect);
      });
      await created.startSync();
      attempt = 0;
      if (!state.get().hasSynced) {
        deviceStorage.set(syncedKey, "1");
        patch({ hasSynced: true });
      }
      setStatus("online");
      if (state.get().pending.length > 0) setPending([]);
      housekeeping();
    } catch (error) {
      await dropConnection();
      // A timeout means the server is unreachable; checking the password would only wait again.
      const timedOut = error instanceof Error && error.message === "timeout";
      const check = timedOut ? "unreachable" : await checkPassword({ serverUrl, password });
      // One failed attempt is often just the network waking up at launch or resume; the quick retry
      // usually lands, so stay "connecting" and only show offline once a retry has failed too.
      const quietRetry = attempt === 0 && !asked;
      setStatus(check === "wrong" ? "unauthorized" : quietRetry ? "connecting" : "offline");
      scheduleReconnect();
    } finally {
      connecting = false;
      asked = false;
    }
  };

  /** A first miss stays "connecting" while a quick retry runs; this waits for the outcome. */
  const settled = (): Promise<void> =>
    new Promise((resolve) => {
      if (state.get().status !== "connecting") return resolve();
      const unsubscribe = state.subscribe(() => {
        if (state.get().status === "connecting") return;
        unsubscribe();
        resolve();
      });
    });

  const nudge: Household["nudge"] = (options) => {
    if (stopped || synchronizer || state.get().status === "unauthorized") return Promise.resolve();
    if (options?.asked) asked = true;
    if (!inFlight) {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      attempt = 0;
    }
    return connect().then(settled);
  };

  const goneOffline = async () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    if (state.get().status !== "unauthorized") setStatus("offline");
    // The socket can sit "open" for minutes after the network goes, so let it go now.
    const openSocketRef = socket;
    await dropConnection();
    openSocketRef?.close();
  };

  const [network] = await Promise.all([
    getNetworkStateAsync().catch(() => undefined),
    startLocalPersistence({ store, dbName }).then((started) => {
      persister = started;
    }),
  ]);
  networkDown = network?.isConnected === false;
  patch({ ready: true });
  housekeeping();
  void connect();

  const appState: NativeEventSubscription = AppState.addEventListener("change", (next) => {
    if (next !== "active") return;
    housekeeping();
    void nudge();
  });
  const networkListener = addNetworkStateListener((change) => {
    networkDown = change.isConnected === false;
    if (networkDown) void goneOffline();
    else void nudge();
  });

  return {
    store,
    state,
    write,
    nudge,
    stop: async () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (persistTimer) {
        clearTimeout(persistTimer);
        deviceStorage.set(pendingKey, JSON.stringify(state.get().pending));
      }
      appState.remove();
      networkListener.remove();
      const openSocketRef = socket;
      await dropConnection();
      openSocketRef?.close();
      await persister?.stop();
      persister = undefined;
    },
  };
};
