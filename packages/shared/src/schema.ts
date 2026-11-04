import type { Store, TablesSchema } from "tinybase";
import { normalizeGroupColor } from "./groupColor";
import type { MonthKey } from "./month";

export const TABLES = {
  users: "users",
  lists: "lists",
  groups: "groups",
  items: "items",
} as const;

export type TableId = (typeof TABLES)[keyof typeof TABLES];

/**
 * Documents the synced shape. Deliberately not applied to the stores: a schema
 * would make an older app drop cells a newer one writes, and the two replicas
 * would never converge. Reads are validated by the read* functions below.
 */
export const tablesSchema = {
  users: {
    name: { type: "string", default: "" },
    created_at: { type: "number", default: 0 },
    last_seen_at: { type: "number" },
  },
  lists: {
    created_at: { type: "number", default: 0 },
  },
  groups: {
    name: { type: "string", default: "" },
    icon: { type: "string" },
    color: { type: "string" },
    color2: { type: "string" },
    position: { type: "number", default: 0 },
    deleted_at: { type: "number" },
  },
  items: {
    list_id: { type: "string", default: "" },
    group_id: { type: "string" },
    name: { type: "string", default: "" },
    qty: { type: "string" },
    unit: { type: "string" },
    note: { type: "string" },
    added_by: { type: "string", default: "" },
    added_at: { type: "number", default: 0 },
    checked_at: { type: "number" },
    checked_by: { type: "string" },
    position: { type: "number", default: 0 },
    deleted_at: { type: "number" },
  },
} as const satisfies TablesSchema;

export type User = {
  id: string;
  name: string;
  createdAt: number;
  lastSeenAt?: number;
};

export type Group = {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  /** Second gradient stop; only meaningful when `color` is set. */
  color2?: string;
  position: number;
  deletedAt?: number;
};

export type Item = {
  id: string;
  listId: MonthKey;
  groupId?: string;
  name: string;
  qty?: string;
  unit?: string;
  note?: string;
  addedBy: string;
  addedAt: number;
  checkedAt?: number;
  checkedBy?: string;
  position: number;
  deletedAt?: number;
};

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;
const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

type ReadArgs = { store: Store; id: string };

export const readUser = ({ store, id }: ReadArgs): User | undefined => {
  if (!store.hasRow(TABLES.users, id)) return undefined;
  const row = store.getRow(TABLES.users, id);
  return {
    id,
    name: str(row.name) ?? "",
    createdAt: num(row.created_at) ?? 0,
    lastSeenAt: num(row.last_seen_at),
  };
};

export const readGroup = ({ store, id }: ReadArgs): Group | undefined => {
  if (!store.hasRow(TABLES.groups, id)) return undefined;
  const row = store.getRow(TABLES.groups, id);
  return {
    id,
    name: str(row.name) ?? "",
    icon: str(row.icon),
    color: normalizeGroupColor(str(row.color)),
    color2: normalizeGroupColor(str(row.color)) ? normalizeGroupColor(str(row.color2)) : undefined,
    position: num(row.position) ?? 0,
    deletedAt: num(row.deleted_at),
  };
};

export const readItem = ({ store, id }: ReadArgs): Item | undefined => {
  if (!store.hasRow(TABLES.items, id)) return undefined;
  const row = store.getRow(TABLES.items, id);
  return {
    id,
    listId: (str(row.list_id) ?? "") as MonthKey,
    groupId: str(row.group_id),
    name: str(row.name) ?? "",
    qty: str(row.qty),
    unit: str(row.unit),
    note: str(row.note),
    addedBy: str(row.added_by) ?? "",
    addedAt: num(row.added_at) ?? 0,
    checkedAt: num(row.checked_at),
    checkedBy: str(row.checked_by),
    position: num(row.position) ?? 0,
    deletedAt: num(row.deleted_at),
  };
};

export const readAll = <T>({
  store,
  table,
  read,
}: {
  store: Store;
  table: TableId;
  read: (args: ReadArgs) => T | undefined;
}): T[] =>
  store
    .getRowIds(table)
    .map((id) => read({ store, id }))
    .filter((row): row is T => row !== undefined);
