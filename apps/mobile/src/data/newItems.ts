import { TABLES, arrivalsFromOthers, stillUnseen } from "@mira/shared";
import type { MergeableStore } from "tinybase";
import { deviceStorage } from "@/lib/deviceStorage";
import { createExternalStore, type ExternalStore } from "@/lib/externalStore";

export type UnseenItem = {
  /** When it arrived during this run of the app; undefined when it was already waiting at launch. */
  arrivedAt?: number;
  /** Set once seen: its tint fades out after this delay, then the entry goes. */
  fadeDelayMs?: number;
};

export type UnseenItems = ReadonlyMap<string, UnseenItem>;

export type NewItemsTracker = {
  /** Someone else's items this device hasn't shown long enough to count as seen. */
  unseen: ExternalStore<UnseenItems>;
  markSeen: (seen: readonly { itemId: string; delayMs: number }[]) => void;
  /** From now on, items a sync adds count as arrivals (not before the first full sync, which brings everything). */
  startCounting: () => void;
  stop: () => void;
};

/** How long after a change the unseen list is saved (coalesced, as Keychain/Keystore writes are slow). */
const PERSIST_MS = 500;
/** Some iOS versions reject Keychain values over about 2 KB; the newest ids win if more pile up unseen. */
const MAX_STORED = 40;
/** Comfortably past the longest stagger plus the seen fade, after which a seen entry is dropped. */
const FORGET_SEEN_AFTER_MS = 2000;

const loadIds = (key: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(deviceStorage.get(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Per device and never synced: which items someone else added that this device hasn't shown yet. An item
 * counts when a sync adds its row, so items already on the list when this first runs (or that a fresh
 * install pulls in on its first sync) never do. Entries drop out as their items are checked off or deleted.
 */
export const trackNewItems = ({
  store,
  storageKey,
  getUserId,
  isLocalChange,
}: {
  store: MergeableStore;
  storageKey: string;
  getUserId: () => string | undefined;
  /** This device made the change in progress (the person, or the app's own bookkeeping). */
  isLocalChange: () => boolean;
}): NewItemsTracker => {
  const unseen = createExternalStore<UnseenItems>(
    new Map(stillUnseen({ store, ids: loadIds(storageKey) }).map((id) => [id, {}])),
  );
  let counting = false;

  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    persistTimer = undefined;
    const ids = [...unseen.get()].filter(([, entry]) => entry.fadeDelayMs === undefined).map(([id]) => id);
    try {
      deviceStorage.set(storageKey, JSON.stringify(ids.slice(-MAX_STORED)));
    } catch (error) {
      console.warn("[newItems] couldn't save unseen items", error);
    }
  };
  const update = (next: UnseenItems) => {
    unseen.set(next);
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, PERSIST_MS);
  };

  const listener = store.addDidFinishTransactionListener(() => {
    const current = unseen.get();
    const kept = new Set(stillUnseen({ store, ids: current.keys() }));
    const added = Object.entries(store.getTransactionLog()[7][TABLES.items] ?? {})
      .filter(([, change]) => change === 1)
      .map(([id]) => id);
    const arrived =
      counting && !isLocalChange() && added.length > 0
        ? arrivalsFromOthers({ store, rowIds: added, userId: getUserId() }).filter((id) => !current.has(id))
        : [];
    if (kept.size === current.size && arrived.length === 0) return;
    const now = Date.now();
    update(
      new Map([
        ...[...current].filter(([id]) => kept.has(id)),
        ...arrived.map((id): [string, UnseenItem] => [id, { arrivedAt: now }]),
      ]),
    );
  });

  const forgetTimers = new Set<ReturnType<typeof setTimeout>>();
  const markSeen: NewItemsTracker["markSeen"] = (seen) => {
    const current = unseen.get();
    const fresh = seen.filter(({ itemId }) => current.get(itemId)?.fadeDelayMs === undefined && current.has(itemId));
    if (fresh.length === 0) return;
    const next = new Map(current);
    for (const { itemId, delayMs } of fresh) next.set(itemId, { ...current.get(itemId), fadeDelayMs: delayMs });
    update(next);
    const timer = setTimeout(() => {
      forgetTimers.delete(timer);
      const latest = new Map(unseen.get());
      for (const { itemId } of fresh) if (latest.get(itemId)?.fadeDelayMs !== undefined) latest.delete(itemId);
      update(latest);
    }, FORGET_SEEN_AFTER_MS);
    forgetTimers.add(timer);
  };

  return {
    unseen,
    markSeen,
    startCounting: () => {
      counting = true;
    },
    stop: () => {
      store.delListener(listener);
      for (const timer of forgetTimers) clearTimeout(timer);
      if (persistTimer) {
        clearTimeout(persistTimer);
        persist();
      }
    },
  };
};
