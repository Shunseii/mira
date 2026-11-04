import type { Store } from "tinybase";
import { carriedItemId } from "./ids";
import { compareMonthKeys, isMonthKey, type MonthKey } from "./month";
import { ensureList, liveItemsOf } from "./ops";
import { TABLES, readGroup } from "./schema";

/** Most recent month before `month` that has at least one live item. */
export const previousMonthWithItems = ({ store, month }: { store: Store; month: MonthKey }): MonthKey | undefined => {
  const earlier = store
    .getRowIds(TABLES.lists)
    .filter(isMonthKey)
    .filter((key) => compareMonthKeys(key, month) < 0)
    .sort(compareMonthKeys)
    .reverse();
  return earlier.find((key) => liveItemsOf({ store, month: key }).length > 0);
};

/**
 * Copies unchecked items from the latest earlier month into `month`.
 *
 * Idempotent and convergent: each copy's id is hash(source id + month), and a
 * copy is only written if no row with that id exists yet (soft-deleted copies
 * included, so a deleted carry-over never comes back). Two devices rolling over
 * offline write identical rows, which merge cleanly.
 *
 * Returns the number of items copied.
 */
export const rollover = ({ store, month, now }: { store: Store; month: MonthKey; now?: number }): number => {
  const source = previousMonthWithItems({ store, month });
  if (!source) return 0;
  const toCopy = liveItemsOf({ store, month: source }).filter(
    (item) =>
      item.checkedAt === undefined &&
      !store.hasRow(TABLES.items, carriedItemId({ sourceItemId: item.id, month })),
  );
  if (toCopy.length === 0) return 0;

  store.transaction(() => {
    ensureList({ store, month, now });
    for (const item of toCopy) {
      const group = item.groupId ? readGroup({ store, id: item.groupId }) : undefined;
      const keepGroup = group !== undefined && group.deletedAt === undefined;
      store.setRow(TABLES.items, carriedItemId({ sourceItemId: item.id, month }), {
        list_id: month,
        name: item.name,
        added_by: item.addedBy,
        added_at: item.addedAt,
        position: item.position,
        ...(keepGroup && item.groupId ? { group_id: item.groupId } : {}),
        ...(item.qty ? { qty: item.qty } : {}),
        ...(item.unit ? { unit: item.unit } : {}),
        ...(item.note ? { note: item.note } : {}),
      });
    }
  });
  return toCopy.length;
};
