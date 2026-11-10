import type { Store } from "tinybase";
import { normalizeName } from "./ids";
import { addMonths, compareMonthKeys, isMonthKey, type MonthKey } from "./month";
import { liveGroups, liveItemsOf } from "./ops";
import { TABLES, readAll, readItem, type Group, type Item } from "./schema";

export type Section = {
  /** "ungrouped" or the group id */
  key: string;
  group?: Group;
  /** Unchecked items, then checked ones, each in the list's manual order. */
  items: Item[];
  /** Unchecked items in this section. */
  remaining: number;
};

export type MonthView = {
  /** By group: one section per group. */
  sections: Section[];
  /** By priority: every visible item in the month's one shared order, unchecked first. */
  priority: Item[];
  /** With `checkedApart`: the month's checked items, in list order, for their own section; otherwise empty. */
  checked: Item[];
  leftCount: number;
  totalCount: number;
};

export const UNGROUPED_KEY = "ungrouped";

const matches = ({ item, query }: { item: Item; query: string }): boolean =>
  query === "" || normalizeName(item.name).includes(query) || (item.note !== undefined && normalizeName(item.note).includes(query));

// Ties (same position and time, e.g. items added together) fall back to the id: row order in the store differs
// between a local load and a sync, so without it tied items could swap places on reload.
const byPosition = (a: Item, b: Item): number => a.position - b.position || a.addedAt - b.addedAt || a.id.localeCompare(b.id);

/**
 * The list screen: ungrouped items first, then each household group that has
 * items this month (in household order). Checked items stay in their own
 * section, after the unchecked ones. A group that was deleted counts as
 * ungrouped.
 */
export const buildMonthView = ({
  store,
  month,
  search = "",
  checkedLast = true,
  checkedApart = false,
}: {
  store: Store;
  month: MonthKey;
  search?: string;
  /** Checked items sink below unchecked ones (default); false keeps everything in list order. */
  checkedLast?: boolean;
  /** Checked items leave their groups (and the priority list) for a separate `checked` list. */
  checkedApart?: boolean;
}): MonthView => {
  const query = normalizeName(search);
  const all = liveItemsOf({ store, month });
  const matching = all.filter((item) => matches({ item, query }));
  const checked = checkedApart ? matching.filter((item) => item.checkedAt !== undefined).sort(byPosition) : [];
  const visible = checkedApart ? matching.filter((item) => item.checkedAt === undefined) : matching;
  const groups = liveGroups({ store });
  const liveGroupIds = new Set(groups.map((group) => group.id));
  const sectionKeyOf = (item: Item): string => (item.groupId && liveGroupIds.has(item.groupId) ? item.groupId : UNGROUPED_KEY);

  // Checked items keep the list's manual order among themselves, so "check all" doesn't shuffle them.
  const inListOrder = (items: Item[]): Item[] =>
    checkedLast
      ? [
          ...items.filter((item) => item.checkedAt === undefined).sort(byPosition),
          ...items.filter((item) => item.checkedAt !== undefined).sort(byPosition),
        ]
      : [...items].sort(byPosition);

  const sectionOf = ({ key, group }: { key: string; group?: Group }): Section | undefined => {
    const members = visible.filter((item) => sectionKeyOf(item) === key);
    if (members.length === 0) return undefined;
    const open = members.filter((item) => item.checkedAt === undefined);
    return { key, group, items: inListOrder(members), remaining: open.length };
  };

  const sections = [sectionOf({ key: UNGROUPED_KEY }), ...groups.map((group) => sectionOf({ key: group.id, group }))].filter(
    (section): section is Section => section !== undefined,
  );

  const priority = inListOrder(visible);

  return {
    sections,
    priority,
    checked,
    leftCount: all.filter((item) => item.checkedAt === undefined).length,
    totalCount: all.length,
  };
};

export type MonthOption = {
  month: MonthKey;
  kind: "next" | "current" | "earlier";
  itemCount: number;
};

/** Months an item can be added to: next, current, and every earlier month that had groceries. */
export const addableMonths = ({ store, current }: { store: Store; current: MonthKey }): MonthOption[] => {
  const countOf = (month: MonthKey): number => liveItemsOf({ store, month }).length;
  const earlier = store
    .getRowIds(TABLES.lists)
    .filter(isMonthKey)
    .filter((month) => compareMonthKeys(month, current) < 0)
    .sort(compareMonthKeys)
    .reverse()
    .map((month) => ({ month, kind: "earlier" as const, itemCount: countOf(month) }))
    .filter((option) => option.itemCount > 0);
  const next = addMonths(current, 1);
  return [{ month: next, kind: "next", itemCount: countOf(next) }, { month: current, kind: "current", itemCount: countOf(current) }, ...earlier];
};

/** Months the list screen can page through: earliest with items .. next month. */
export const browsableRange = ({ store, current }: { store: Store; current: MonthKey }): { first: MonthKey; last: MonthKey } => {
  const earliest = addableMonths({ store, current }).at(-1)?.month ?? current;
  return { first: compareMonthKeys(earliest, current) < 0 ? earliest : current, last: addMonths(current, 1) };
};

export type Usual = {
  name: string;
  qty?: string;
  unit?: string;
  groupId?: string;
  months: number;
  lastAddedAt: number;
};

/**
 * Frequently bought items, derived from history: distinct months an item name
 * appeared in, most frequent first. Names already open in `month` are skipped, and so is
 * the name `query` already spells out in full: it's typed, so there's nothing to suggest.
 */
export const usuals = ({ store, month, query = "", limit = 12 }: { store: Store; month: MonthKey; query?: string; limit?: number }): Usual[] => {
  const needle = normalizeName(query);
  const openNow = new Set(
    liveItemsOf({ store, month })
      .filter((item) => item.checkedAt === undefined)
      .map((item) => normalizeName(item.name)),
  );
  const byName = new Map<string, Usual & { monthSet: Set<string> }>();
  for (const item of readAll({ store, table: TABLES.items, read: readItem })) {
    if (item.deletedAt !== undefined) continue;
    const key = normalizeName(item.name);
    if (!key || openNow.has(key) || (needle && !key.includes(needle)) || key === needle) continue;
    const entry = byName.get(key) ?? { name: item.name, months: 0, lastAddedAt: 0, monthSet: new Set<string>() };
    entry.monthSet.add(item.listId);
    if (item.addedAt >= entry.lastAddedAt) {
      Object.assign(entry, { name: item.name, qty: item.qty, unit: item.unit, groupId: item.groupId, lastAddedAt: item.addedAt });
    }
    entry.months = entry.monthSet.size;
    byName.set(key, entry);
  }
  const startsWith = (usual: Usual): number => (needle && normalizeName(usual.name).startsWith(needle) ? 0 : 1);
  return [...byName.values()]
    .map(({ monthSet: _monthSet, ...usual }) => usual)
    .sort((a, b) => startsWith(a) - startsWith(b) || b.months - a.months || b.lastAddedAt - a.lastAddedAt)
    .slice(0, limit);
};

export const UNIT_GROUPS = {
  weight: ["g", "kg"],
  volume: ["ml", "L"],
  count: ["pack", "bunch", "bottle", "can", "bag", "box", "dozen"],
} as const;

export const COMMON_UNITS: readonly string[] = [...UNIT_GROUPS.weight, ...UNIT_GROUPS.volume, ...UNIT_GROUPS.count];

/** Default suggestions when the household has no history yet. */
const DEFAULT_SUGGESTIONS = ["kg", "pack", "g"];

const unitsInUse = ({ store }: { store: Store }): Item[] =>
  readAll({ store, table: TABLES.items, read: readItem }).filter((item) => item.deletedAt === undefined && item.unit !== undefined);

/** Units the household typed itself (not in the common set), most used first. */
export const customUnits = ({ store }: { store: Store }): string[] => {
  const counts = new Map<string, number>();
  for (const item of unitsInUse({ store })) {
    const unit = item.unit as string;
    if (!COMMON_UNITS.includes(unit)) counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([unit]) => unit);
};

export type UnitSuggestions = {
  /** The unit last used for this exact item name, if any: preselect it. */
  remembered?: string;
  /** Up to `limit` chips: remembered first, then household favourites, then defaults. */
  suggestions: string[];
};

/**
 * Ranks units without a lookup table: the unit last used for the same item
 * name (case-insensitive), then the household's most-used units, then defaults.
 */
export const suggestUnits = ({ store, name, limit = 3 }: { store: Store; name: string; limit?: number }): UnitSuggestions => {
  const key = normalizeName(name);
  const items = unitsInUse({ store });
  const remembered = key ? items.filter((item) => normalizeName(item.name) === key).sort((a, b) => b.addedAt - a.addedAt)[0]?.unit : undefined;
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.unit as string, (counts.get(item.unit as string) ?? 0) + 1);
  const favourites = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([unit]) => unit);
  const suggestions = [...new Set([...(remembered ? [remembered] : []), ...favourites, ...DEFAULT_SUGGESTIONS])].slice(0, limit);
  return { remembered, suggestions };
};

/** Units written the same for any amount: metric abbreviations and "dozen". */
const INVARIABLE_UNITS = new Set(["g", "kg", "mg", "ml", "l", "L", "cl", "dl", "oz", "lb", "lbs", "dozen"]);

/**
 * "bunch" → "bunches" when there's more than one. Stored units stay singular;
 * abbreviations, already-plural words and short codes are left alone.
 */
export const pluralUnit = ({ unit, count }: { unit: string; count: number }): string => {
  if (count === 1 || INVARIABLE_UNITS.has(unit) || INVARIABLE_UNITS.has(unit.toLowerCase())) return unit;
  if (unit.length <= 2 || /[^a-z\s-]/i.test(unit) || unit !== unit.toLowerCase()) return unit;
  if (/s$/i.test(unit)) return unit;
  if (/(x|z|ch|sh)$/i.test(unit)) return `${unit}es`;
  if (/[^aeiou]y$/i.test(unit)) return `${unit.slice(0, -1)}ies`;
  return `${unit}s`;
};

export const formatQuantity = ({ qty, unit }: { qty?: string; unit?: string }): string | undefined => {
  if (!qty && !unit) return undefined;
  if (!unit) return qty;
  const amount = qty ?? "1";
  const count = Number(amount);
  return `${amount} ${Number.isFinite(count) ? pluralUnit({ unit, count }) : unit}`;
};

/** Most recent item with this name (case-insensitive), for prefilling group/unit. */
export const lastItemNamed = ({ store, name }: { store: Store; name: string }): Item | undefined => {
  const key = normalizeName(name);
  if (!key) return undefined;
  return readAll({ store, table: TABLES.items, read: readItem })
    .filter((item) => item.deletedAt === undefined && normalizeName(item.name) === key)
    .sort((a, b) => b.addedAt - a.addedAt)[0];
};

/**
 * Months the list can page through, oldest first: every earlier month that had
 * groceries, the current month, and next month (the same set as the picker).
 */
export const browsableMonths = ({ store, current }: { store: Store; current: MonthKey }): MonthKey[] =>
  addableMonths({ store, current })
    .map((option) => option.month)
    .sort(compareMonthKeys);
