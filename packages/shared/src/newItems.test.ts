import { createMergeableStore } from "tinybase";
import { describe, expect, it } from "vitest";
import {
  addItem,
  arrivalsFromOthers,
  carriedItemId,
  deleteItem,
  isCarriedCopy,
  monthStart,
  readItem,
  rollover,
  setChecked,
  stillUnseen,
  type MonthKey,
} from "./index";

const OCT: MonthKey = "2026-10";
const NOV: MonthKey = "2026-11";
const midOct = monthStart(OCT) + 10 * 86_400_000;
const midNov = monthStart(NOV) + 10 * 86_400_000;

describe("arrivalsFromOthers", () => {
  it("keeps open items someone else added and skips the device's own", () => {
    const store = createMergeableStore();
    const mine = addItem({ store, month: NOV, userId: "me", item: { name: "Milk" }, now: midNov });
    const theirs = addItem({ store, month: NOV, userId: "sara", item: { name: "Halloumi" }, now: midNov });
    expect(arrivalsFromOthers({ store, rowIds: [mine, theirs], userId: "me" })).toEqual([theirs]);
  });

  it("skips items that arrive already checked or deleted, and ids that aren't items", () => {
    const store = createMergeableStore();
    const checked = addItem({ store, month: NOV, userId: "sara", item: { name: "Eggs" }, now: midNov });
    setChecked({ store, itemId: checked, userId: "sara", checked: true, now: midNov });
    const deleted = addItem({ store, month: NOV, userId: "sara", item: { name: "Bread" }, now: midNov });
    deleteItem({ store, itemId: deleted, now: midNov });
    expect(arrivalsFromOthers({ store, rowIds: [checked, deleted, "missing"], userId: "me" })).toEqual([]);
  });

  it("counts nothing before the device knows who its person is", () => {
    const store = createMergeableStore();
    const theirs = addItem({ store, month: NOV, userId: "sara", item: { name: "Halloumi" }, now: midNov });
    expect(arrivalsFromOthers({ store, rowIds: [theirs], userId: undefined })).toEqual([]);
  });

  it("skips rollover copies, which were already on last month's list", () => {
    const store = createMergeableStore();
    const source = addItem({ store, month: OCT, userId: "sara", item: { name: "Rice" }, now: midOct });
    rollover({ store, month: NOV, now: midNov });
    const copyId = carriedItemId({ sourceItemId: source, month: NOV });
    const copy = readItem({ store, id: copyId });
    expect(copy && isCarriedCopy({ store, item: copy })).toBe(true);
    expect(arrivalsFromOthers({ store, rowIds: [copyId], userId: "me" })).toEqual([]);
  });
});

describe("stillUnseen", () => {
  it("drops items that were checked off, deleted, or are gone", () => {
    const store = createMergeableStore();
    const open = addItem({ store, month: NOV, userId: "sara", item: { name: "Halloumi" }, now: midNov });
    const checked = addItem({ store, month: NOV, userId: "sara", item: { name: "Eggs" }, now: midNov });
    const deleted = addItem({ store, month: NOV, userId: "sara", item: { name: "Bread" }, now: midNov });
    setChecked({ store, itemId: checked, userId: "me", checked: true, now: midNov });
    deleteItem({ store, itemId: deleted, now: midNov });
    expect(stillUnseen({ store, ids: [open, checked, deleted, "gone"] })).toEqual([open]);
  });
});
