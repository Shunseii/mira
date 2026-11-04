import type { Store } from "tinybase";
import { normalizeGroupColor } from "./groupColor";
import { randomId } from "./ids";
import type { MonthKey } from "./month";
import { TABLES, readAll, readGroup, readItem, readUser, type Group, type Item, type User } from "./schema";

type Clock = { now?: number };

const timestamp = ({ now }: Clock): number => now ?? Date.now();

const clean = (value: string): string => value.trim().replace(/\s+/g, " ");

const nextPosition = (positions: number[]): number => (positions.length === 0 ? 1 : Math.max(...positions) + 1);

/* ---------- users ---------- */

export const liveUsers = ({ store }: { store: Store }): User[] =>
  readAll({ store, table: TABLES.users, read: readUser }).sort((a, b) => a.createdAt - b.createdAt);

export const createUser = ({ store, name, now }: { store: Store; name: string } & Clock): string => {
  const id = randomId();
  const at = timestamp({ now });
  store.setRow(TABLES.users, id, { name: clean(name), created_at: at, last_seen_at: at });
  return id;
};

export const touchUser = ({ store, userId, now }: { store: Store; userId: string } & Clock): void => {
  if (store.hasRow(TABLES.users, userId)) {
    store.setCell(TABLES.users, userId, "last_seen_at", timestamp({ now }));
  }
};

/* ---------- lists ---------- */

export const ensureList = ({ store, month, now }: { store: Store; month: MonthKey } & Clock): void => {
  if (!store.hasRow(TABLES.lists, month)) {
    store.setRow(TABLES.lists, month, { created_at: timestamp({ now }) });
  }
};

/* ---------- groups (household-wide) ---------- */

export const liveGroups = ({ store }: { store: Store }): Group[] =>
  readAll({ store, table: TABLES.groups, read: readGroup })
    .filter((group) => group.deletedAt === undefined)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

/** `color2` makes the group a two-stop gradient; it is ignored without `color`. */
export type GroupFields = { name: string; icon?: string; color?: string; color2?: string };

/** Canonical colour cells: hex only, and never a second stop without a first. */
const colorCells = ({ color, color2 }: { color?: string; color2?: string }): { color?: string; color2?: string } => {
  const first = normalizeGroupColor(color);
  const second = first ? normalizeGroupColor(color2) : undefined;
  return { ...(first ? { color: first } : {}), ...(second ? { color2: second } : {}) };
};

export const createGroup = ({ store, group }: { store: Store; group: GroupFields }): string => {
  const id = randomId();
  store.setRow(TABLES.groups, id, {
    name: clean(group.name),
    position: nextPosition(liveGroups({ store }).map((other) => other.position)),
    ...(group.icon ? { icon: group.icon } : {}),
    ...colorCells(group),
  });
  return id;
};

/**
 * `icon`/`appearance`: undefined leaves it alone. `appearance` replaces both
 * colour stops at once (solid ↔ gradient switches can't leave a stale stop).
 */
export const updateGroup = ({
  store,
  groupId,
  patch,
}: {
  store: Store;
  groupId: string;
  patch: { name?: string; icon?: string | null; appearance?: { color?: string; color2?: string } };
}): void => {
  store.transaction(() => {
    if (patch.name && clean(patch.name)) store.setCell(TABLES.groups, groupId, "name", clean(patch.name));
    if (patch.icon !== undefined) {
      if (patch.icon) store.setCell(TABLES.groups, groupId, "icon", patch.icon);
      else store.delCell(TABLES.groups, groupId, "icon");
    }
    if (patch.appearance !== undefined) {
      const cells = colorCells(patch.appearance);
      for (const cell of ["color", "color2"] as const) {
        const value = cells[cell];
        if (value) store.setCell(TABLES.groups, groupId, cell, value);
        else store.delCell(TABLES.groups, groupId, cell);
      }
    }
  });
};

/** Deleting a group leaves its items ungrouped, in every month. */
/** Deletes the group and ungroups its items; returns those items' ids so restoreGroup can put them back. */
export const deleteGroup = ({ store, groupId, now }: { store: Store; groupId: string } & Clock): string[] => {
  const itemIds = store.getRowIds(TABLES.items).filter((itemId) => store.getCell(TABLES.items, itemId, "group_id") === groupId);
  store.transaction(() => {
    for (const itemId of itemIds) store.delCell(TABLES.items, itemId, "group_id");
    store.setCell(TABLES.groups, groupId, "deleted_at", timestamp({ now }));
  });
  return itemIds;
};

/** Undoes deleteGroup: brings the group back and regroups the items it had, unless one has been given another group since. */
export const restoreGroup = ({ store, groupId, itemIds }: { store: Store; groupId: string; itemIds: readonly string[] }): void => {
  store.transaction(() => {
    store.delCell(TABLES.groups, groupId, "deleted_at");
    for (const itemId of itemIds) {
      if (store.hasRow(TABLES.items, itemId) && !store.hasCell(TABLES.items, itemId, "group_id")) {
        store.setCell(TABLES.items, itemId, "group_id", groupId);
      }
    }
  });
};

export const moveGroup = ({ store, groupId, toIndex }: { store: Store; groupId: string; toIndex: number }): void => {
  const others = liveGroups({ store }).filter((group) => group.id !== groupId);
  store.setCell(TABLES.groups, groupId, "position", positionAt({ positions: others.map((g) => g.position), index: toIndex }));
};

/* ---------- items ---------- */

export const liveItemsOf = ({ store, month }: { store: Store; month: MonthKey }): Item[] =>
  readAll({ store, table: TABLES.items, read: readItem }).filter((item) => item.listId === month && item.deletedAt === undefined);

export type ItemFields = {
  name: string;
  qty?: string;
  unit?: string;
  note?: string;
  groupId?: string;
};

const optionalCells = (fields: Omit<ItemFields, "name">) => {
  const cells: Record<string, string> = {};
  if (fields.groupId) cells.group_id = fields.groupId;
  for (const key of ["qty", "unit", "note"] as const) {
    const value = fields[key]?.trim();
    if (value) cells[key] = value;
  }
  return cells;
};

export const addItem = ({ store, month, userId, item, now }: { store: Store; month: MonthKey; userId: string; item: ItemFields } & Clock): string => {
  const id = randomId();
  const at = timestamp({ now });
  const monthItems = liveItemsOf({ store, month });
  store.transaction(() => {
    ensureList({ store, month, now: at });
    store.setRow(TABLES.items, id, {
      list_id: month,
      name: clean(item.name),
      added_by: userId,
      added_at: at,
      position: nextPosition(monthItems.map((other) => other.position)),
      ...optionalCells(item),
    });
  });
  return id;
};

export type ItemPatch = {
  name?: string;
  qty?: string | null;
  unit?: string | null;
  note?: string | null;
  groupId?: string | null;
};

export const updateItem = ({ store, itemId, patch }: { store: Store; itemId: string; patch: ItemPatch }): void => {
  const cells = { qty: patch.qty, unit: patch.unit, note: patch.note, group_id: patch.groupId };
  store.transaction(() => {
    if (patch.name && clean(patch.name)) store.setCell(TABLES.items, itemId, "name", clean(patch.name));
    for (const [cell, value] of Object.entries(cells)) {
      if (value === undefined) continue;
      const trimmed = value?.trim();
      if (trimmed) store.setCell(TABLES.items, itemId, cell, trimmed);
      else store.delCell(TABLES.items, itemId, cell);
    }
  });
};

export const setChecked = ({
  store,
  itemId,
  userId,
  checked,
  now,
}: { store: Store; itemId: string; userId: string; checked: boolean } & Clock): void => {
  store.transaction(() => {
    if (checked) {
      store.setCell(TABLES.items, itemId, "checked_at", timestamp({ now }));
      store.setCell(TABLES.items, itemId, "checked_by", userId);
    } else {
      store.delCell(TABLES.items, itemId, "checked_at");
      store.delCell(TABLES.items, itemId, "checked_by");
    }
  });
};

/** Check or uncheck several items at once (multi-select, "check all" on a group). */
export const setCheckedMany = ({
  store,
  itemIds,
  userId,
  checked,
  now,
}: { store: Store; itemIds: readonly string[]; userId: string; checked: boolean } & Clock): void => {
  const at = timestamp({ now });
  store.transaction(() => {
    for (const itemId of itemIds) {
      const alreadyChecked = store.getCell(TABLES.items, itemId, "checked_at") !== undefined;
      if (alreadyChecked !== checked) setChecked({ store, itemId, userId, checked, now: at });
    }
  });
};

export const deleteItems = ({ store, itemIds, now }: { store: Store; itemIds: readonly string[] } & Clock): void => {
  const at = timestamp({ now });
  store.transaction(() => {
    for (const itemId of itemIds) store.setCell(TABLES.items, itemId, "deleted_at", at);
  });
};

export const restoreItems = ({ store, itemIds }: { store: Store; itemIds: readonly string[] }): void => {
  store.transaction(() => {
    for (const itemId of itemIds) store.delCell(TABLES.items, itemId, "deleted_at");
  });
};

export const deleteItem = ({ store, itemId, now }: { store: Store; itemId: string } & Clock): void => {
  store.setCell(TABLES.items, itemId, "deleted_at", timestamp({ now }));
};

export const restoreItem = ({ store, itemId }: { store: Store; itemId: string }): void => {
  store.delCell(TABLES.items, itemId, "deleted_at");
};

const byOrder = (a: Item, b: Item): number => a.position - b.position || a.addedAt - b.addedAt || a.id.localeCompare(b.id);

/** Position strictly between `before` and `after`, either of which may be missing. */
const between = ({ before, after }: { before?: number; after?: number }): number => {
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after as number) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
};

/** Position that slots in at `index` of an already-sorted list of positions. */
export const positionAt = ({ positions, index }: { positions: number[]; index: number }): number => {
  const sorted = [...positions].sort((a, b) => a - b);
  const at = Math.max(0, Math.min(index, sorted.length));
  return between({ before: sorted[at - 1], after: sorted[at] });
};

/**
 * The month's unchecked items (except `exceptId`) in list order. Items that
 * share a position (left over from older per-group numbering) are first spread
 * out to 1, 2, 3…, so a drop can always land strictly between two neighbours.
 */
const openItemsInOrder = ({ store, month, exceptId }: { store: Store; month: MonthKey; exceptId: string }): Item[] => {
  const items = liveItemsOf({ store, month })
    .filter((other) => other.id !== exceptId && other.checkedAt === undefined)
    .sort(byOrder);
  const tied = items.some((other, index) => index > 0 && other.position === items[index - 1]?.position);
  if (!tied) return items;
  return items.map((other, index) => {
    const position = index + 1;
    if (other.position !== position) store.setCell(TABLES.items, other.id, "position", position);
    return { ...other, position };
  });
};

/**
 * By group: moves an unchecked item to `toIndex` among the target section's
 * unchecked items (undefined group = ungrouped). The month has one shared
 * order, so the item lands right after the section item it now follows (or
 * right before the one it now leads): its priority relative to other groups
 * moves as little as possible. Normally only the moved row changes, so
 * concurrent reorders on other devices don't clobber each other.
 */
export const moveItem = ({
  store,
  itemId,
  toGroupId,
  toIndex,
}: {
  store: Store;
  itemId: string;
  toGroupId: string | undefined;
  toIndex: number;
}): void => {
  const item = readItem({ store, id: itemId });
  if (!item) return;
  store.transaction(() => {
    const others = openItemsInOrder({ store, month: item.listId, exceptId: itemId });
    const siblings = others.filter((other) => other.groupId === toGroupId);
    const at = Math.max(0, Math.min(toIndex, siblings.length));
    const previous = siblings[at - 1];
    const next = siblings[at];
    const position = (() => {
      if (previous) {
        const following = others[others.indexOf(previous) + 1];
        return between({ before: previous.position, after: following?.position });
      }
      if (next) {
        const preceding = others[others.indexOf(next) - 1];
        return between({ before: preceding?.position, after: next.position });
      }
      return item.position;
    })();
    store.setCell(TABLES.items, itemId, "position", position);
    if (toGroupId) store.setCell(TABLES.items, itemId, "group_id", toGroupId);
    else store.delCell(TABLES.items, itemId, "group_id");
  });
};

/** By priority: moves an unchecked item to `toIndex` among all the month's unchecked items. Its group is untouched. */
export const moveItemInPriority = ({ store, itemId, toIndex }: { store: Store; itemId: string; toIndex: number }): void => {
  const item = readItem({ store, id: itemId });
  if (!item) return;
  store.transaction(() => {
    const others = openItemsInOrder({ store, month: item.listId, exceptId: itemId });
    const at = Math.max(0, Math.min(toIndex, others.length));
    store.setCell(TABLES.items, itemId, "position", between({ before: others[at - 1]?.position, after: others[at]?.position }));
  });
};

export const moveItemToMonth = ({ store, itemId, month, now }: { store: Store; itemId: string; month: MonthKey } & Clock): void => {
  const item = readItem({ store, id: itemId });
  if (!item || item.listId === month) return;
  const monthItems = liveItemsOf({ store, month });
  store.transaction(() => {
    ensureList({ store, month, now });
    store.setCell(TABLES.items, itemId, "list_id", month);
    store.setCell(TABLES.items, itemId, "position", nextPosition(monthItems.map((other) => other.position)));
  });
};
