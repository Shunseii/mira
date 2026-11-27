import type { Store } from "tinybase";
import { carriedItemId } from "./ids";
import { TABLES, readAll, readItem, type Item } from "./schema";

/** Unchecked and not deleted: the only items that can carry a new-item highlight. */
const isOpen = (item: Item | undefined): item is Item => item !== undefined && item.deletedAt === undefined && item.checkedAt === undefined;

const CARRIED_ID_LENGTH = carriedItemId({ sourceItemId: "", month: "2000-01" }).length;

/** A copy rollover made of an item from an earlier month: it was already on the list, so it isn't new. */
export const isCarriedCopy = ({ store, item }: { store: Store; item: Item }): boolean => {
  if (!item.id.startsWith("c") || item.id.length !== CARRIED_ID_LENGTH) return false;
  return readAll({ store, table: TABLES.items, read: readItem }).some(
    (source) => source.listId !== item.listId && carriedItemId({ sourceItemId: source.id, month: item.listId }) === item.id,
  );
};

/**
 * Of the item rows a sync just added, the ones someone else put on the list: open, added by another
 * person, and not a rollover copy. Nothing counts until the device knows who its person is.
 */
export const arrivalsFromOthers = ({ store, rowIds, userId }: { store: Store; rowIds: readonly string[]; userId: string | undefined }): string[] => {
  if (!userId) return [];
  return rowIds.filter((id) => {
    const item = readItem({ store, id });
    return isOpen(item) && item.addedBy !== "" && item.addedBy !== userId && !isCarriedCopy({ store, item });
  });
};

/** Drops ids whose item was checked off, deleted or is gone: those can't be highlighted any more. */
export const stillUnseen = ({ store, ids }: { store: Store; ids: Iterable<string> }): string[] =>
  [...ids].filter((id) => isOpen(readItem({ store, id })));
