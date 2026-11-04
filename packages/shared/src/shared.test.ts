import { createMergeableStore, type MergeableStore } from "tinybase";
import { describe, expect, it } from "vitest";
import {
  addItem,
  addableMonths,
  addMonths,
  authProtocols,
  buildMonthView,
  carriedItemId,
  createGroup,
  deleteGroup,
  deleteItem,
  fromBase64Url,
  liveItemsOf,
  monthKeyOf,
  monthStart,
  moveItem,
  moveItemInPriority,
  passwordFromProtocols,
  rollover,
  setChecked,
  setCheckedMany,
  deleteItems,
  restoreItems,
  restoreGroup,
  liveGroups,
  stableHash,
  toBase64Url,
  suggestUnits,
  customUnits,
  GROUP_COLOR_PRESETS,
  GROUP_ICONS,
  formatQuantity,
  searchGroupIcons,
  isGroupIcon,
  GROUP_GRADIENT_PRESETS,
  updateGroup,
  contrastRatio,
  groupTone,
  hexFromHue,
  hueOf,
  normalizeGroupColor,
  usuals,
  type MonthKey,
} from "./index";

const OCT: MonthKey = "2026-10";
const NOV: MonthKey = "2026-11";
const DEC: MonthKey = "2026-12";
const midOct = monthStart(OCT) + 10 * 86_400_000;
const midNov = monthStart(NOV) + 10 * 86_400_000;

const newStore = (): MergeableStore => createMergeableStore();

const merge = (a: MergeableStore, b: MergeableStore): void => {
  a.merge(b);
};

describe("months", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthKeyOf(new Date(2026, 10, 3))).toBe(NOV);
  });
});

describe("ids", () => {
  it("derives the same carried id everywhere and different ids per month", () => {
    expect(carriedItemId({ sourceItemId: "abc", month: NOV })).toBe(carriedItemId({ sourceItemId: "abc", month: NOV }));
    expect(carriedItemId({ sourceItemId: "abc", month: NOV })).not.toBe(carriedItemId({ sourceItemId: "abc", month: DEC }));
    expect(stableHash("x")).toHaveLength(22);
  });
});

describe("rollover", () => {
  it("copies only unchecked, undeleted items and keeps added_at and group", () => {
    const store = newStore();
    const produce = createGroup({ store, group: { name: "Produce", icon: "carrot", color: "olive" } });
    const tomatoes = addItem({ store, month: OCT, userId: "u1", item: { name: "Tomatoes", qty: "1", unit: "kg", groupId: produce }, now: midOct });
    const milk = addItem({ store, month: OCT, userId: "u1", item: { name: "Milk" }, now: midOct });
    const gone = addItem({ store, month: OCT, userId: "u1", item: { name: "Gone" }, now: midOct });
    setChecked({ store, itemId: milk, userId: "u1", checked: true, now: midOct });
    deleteItem({ store, itemId: gone, now: midOct });

    expect(rollover({ store, month: NOV, now: midNov })).toBe(1);
    const [copy] = liveItemsOf({ store, month: NOV });
    expect(copy).toMatchObject({
      id: carriedItemId({ sourceItemId: tomatoes, month: NOV }),
      name: "Tomatoes",
      qty: "1",
      unit: "kg",
      groupId: produce,
      addedAt: midOct,
    });
  });

  it("is idempotent and never resurrects a deleted carry-over", () => {
    const store = newStore();
    const eggs = addItem({ store, month: OCT, userId: "u1", item: { name: "Eggs" }, now: midOct });
    rollover({ store, month: NOV, now: midNov });
    expect(rollover({ store, month: NOV, now: midNov })).toBe(0);
    deleteItem({ store, itemId: carriedItemId({ sourceItemId: eggs, month: NOV }), now: midNov });
    expect(rollover({ store, month: NOV, now: midNov })).toBe(0);
    expect(liveItemsOf({ store, month: NOV })).toHaveLength(0);
  });

  it("skips empty months and rolls from the latest month that had groceries", () => {
    const store = newStore();
    addItem({ store, month: OCT, userId: "u1", item: { name: "Rice" }, now: midOct });
    expect(rollover({ store, month: DEC })).toBe(1);
  });

  it("two devices rolling over offline converge to one copy per item", () => {
    const phoneA = newStore();
    addItem({ store: phoneA, month: OCT, userId: "u1", item: { name: "Lemons", qty: "6" }, now: midOct });
    const phoneB = newStore();
    merge(phoneB, phoneA);

    rollover({ store: phoneA, month: NOV, now: midNov });
    rollover({ store: phoneB, month: NOV, now: midNov + 5_000 });
    merge(phoneA, phoneB);
    merge(phoneB, phoneA);

    expect(liveItemsOf({ store: phoneA, month: NOV })).toHaveLength(1);
    expect(phoneA.getTables()).toEqual(phoneB.getTables());
  });
});

describe("month view", () => {
  it("puts ungrouped first, groups in household order, and keeps checked items in their group", () => {
    const store = newStore();
    const dairy = createGroup({ store, group: { name: "Dairy" } });
    const produce = createGroup({ store, group: { name: "Produce" } });
    createGroup({ store, group: { name: "Empty" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Candles" } });
    const milk = addItem({ store, month: NOV, userId: "u1", item: { name: "Milk", groupId: dairy } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Labneh", groupId: dairy } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Coriander", groupId: produce } });
    setChecked({ store, itemId: milk, userId: "u1", checked: true });

    const view = buildMonthView({ store, month: NOV });
    expect(view.sections.map((section) => section.group?.name ?? "ungrouped")).toEqual(["ungrouped", "Dairy", "Produce"]);
    const dairySection = view.sections[1];
    expect(dairySection?.items.map((item) => item.name)).toEqual(["Labneh", "Milk"]);
    expect(dairySection?.remaining).toBe(1);
    expect(view.leftCount).toBe(3);

    expect(buildMonthView({ store, month: NOV, search: "cori" }).sections).toHaveLength(1);
  });

  it("keeps checked items in manual order after checking a whole group at once", () => {
    const store = newStore();
    const produce = createGroup({ store, group: { name: "Produce" } });
    const ids = ["Apples", "Bananas", "Cherries", "Dates"].map((name) =>
      addItem({ store, month: NOV, userId: "u1", item: { name, groupId: produce } }),
    );
    setCheckedMany({ store, itemIds: [...ids].reverse(), userId: "u1", checked: true, now: 1000 });
    expect(buildMonthView({ store, month: NOV }).sections[0]?.items.map((item) => item.name)).toEqual(["Apples", "Bananas", "Cherries", "Dates"]);
  });

  it("checks, unchecks, deletes and restores items in bulk", () => {
    const store = newStore();
    const ids = ["A", "B", "C"].map((name) => addItem({ store, month: NOV, userId: "u1", item: { name } }));
    setCheckedMany({ store, itemIds: ids.slice(0, 2), userId: "u2", checked: true });
    expect(buildMonthView({ store, month: NOV }).leftCount).toBe(1);
    setCheckedMany({ store, itemIds: ids, userId: "u2", checked: false });
    expect(buildMonthView({ store, month: NOV }).leftCount).toBe(3);
    deleteItems({ store, itemIds: ids.slice(1) });
    expect(liveItemsOf({ store, month: NOV })).toHaveLength(1);
    restoreItems({ store, itemIds: ids.slice(1) });
    expect(liveItemsOf({ store, month: NOV })).toHaveLength(3);
  });

  it("deleting a group leaves its items ungrouped", () => {
    const store = newStore();
    const pantry = createGroup({ store, group: { name: "Pantry" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Rice", groupId: pantry } });
    deleteGroup({ store, groupId: pantry });
    expect(buildMonthView({ store, month: NOV }).sections[0]?.key).toBe("ungrouped");
  });

  it("restores a deleted group with its items", () => {
    const store = newStore();
    const pantry = createGroup({ store, group: { name: "Pantry" } });
    const dairy = createGroup({ store, group: { name: "Dairy" } });
    const rice = addItem({ store, month: NOV, userId: "u1", item: { name: "Rice", groupId: pantry } });
    const oil = addItem({ store, month: NOV, userId: "u1", item: { name: "Oil", groupId: pantry } });
    const milk = addItem({ store, month: NOV, userId: "u1", item: { name: "Milk", groupId: dairy } });

    const ungrouped = deleteGroup({ store, groupId: pantry });
    expect(ungrouped.sort()).toEqual([rice, oil].sort());
    expect(liveGroups({ store }).map((group) => group.name)).toEqual(["Dairy"]);

    restoreGroup({ store, groupId: pantry, itemIds: ungrouped });
    expect(liveGroups({ store }).map((group) => group.name)).toEqual(["Pantry", "Dairy"]);
    const sections = buildMonthView({ store, month: NOV }).sections;
    expect(sections.map((section) => section.key)).toEqual([pantry, dairy]);
    expect(sections[0]?.items.map((item) => item.name).sort()).toEqual(["Oil", "Rice"]);
    expect(sections[1]?.items.map((item) => item.id)).toEqual([milk]);
  });

  it("doesn't regroup an item that was given another group before undo", () => {
    const store = newStore();
    const pantry = createGroup({ store, group: { name: "Pantry" } });
    const dairy = createGroup({ store, group: { name: "Dairy" } });
    const rice = addItem({ store, month: NOV, userId: "u1", item: { name: "Rice", groupId: pantry } });
    const ungrouped = deleteGroup({ store, groupId: pantry });
    store.setCell("items", rice, "group_id", dairy);
    restoreGroup({ store, groupId: pantry, itemIds: ungrouped });
    expect(store.getCell("items", rice, "group_id")).toBe(dairy);
  });

  it("finds items by their note in search", () => {
    const store = newStore();
    addItem({ store, month: NOV, userId: "u1", item: { name: "Milk", note: "The blue carton, 2%" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Bread" } });
    const names = (search: string) =>
      buildMonthView({ store, month: NOV, search }).sections.flatMap((section) => section.items.map((item) => item.name));
    expect(names("blue carton")).toEqual(["Milk"]);
    expect(names("BREAD")).toEqual(["Bread"]);
  });

  it("moves checked items into their own list when asked", () => {
    const store = newStore();
    const dairy = createGroup({ store, group: { name: "Dairy" } });
    const milk = addItem({ store, month: NOV, userId: "u1", item: { name: "Milk", groupId: dairy } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Eggs", groupId: dairy } });
    const rice = addItem({ store, month: NOV, userId: "u1", item: { name: "Rice" } });
    setCheckedMany({ store, itemIds: [milk, rice], userId: "u1", checked: true });

    const apart = buildMonthView({ store, month: NOV, checkedApart: true });
    expect(apart.checked.map((item) => item.name)).toEqual(["Milk", "Rice"]);
    expect(apart.sections.map((section) => section.key)).toEqual([dairy]);
    expect(apart.sections[0]?.items.map((item) => item.name)).toEqual(["Eggs"]);
    expect(apart.sections[0]?.remaining).toBe(1);
    expect(apart.priority.map((item) => item.name)).toEqual(["Eggs"]);

    const inline = buildMonthView({ store, month: NOV });
    expect(inline.checked).toEqual([]);
    expect(inline.priority.map((item) => item.name)).toEqual(["Eggs", "Milk", "Rice"]);
  });

  it("reorders with midpoint positions", () => {
    const store = newStore();
    const a = addItem({ store, month: NOV, userId: "u1", item: { name: "A" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "B" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "C" } });
    moveItem({ store, itemId: a, toGroupId: undefined, toIndex: 1 });
    expect(buildMonthView({ store, month: NOV }).sections[0]?.items.map((item) => item.name)).toEqual(["B", "A", "C"]);
  });

  it("keeps checked items in place when they don't sink to the end", () => {
    const store = newStore();
    const a = addItem({ store, month: NOV, userId: "u1", item: { name: "A" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "B" } });
    setChecked({ store, itemId: a, userId: "u1", checked: true });
    const names = (checkedLast: boolean) => buildMonthView({ store, month: NOV, checkedLast }).priority.map((item) => item.name);
    expect(names(true)).toEqual(["B", "A"]);
    expect(names(false)).toEqual(["A", "B"]);
  });

  it("drops between items that share a position", () => {
    const store = newStore();
    const ids = ["A", "B", "C"].map((name) => addItem({ store, month: NOV, userId: "u1", item: { name }, now: 1 }));
    for (const id of ids) store.setCell("items", id, "position", 1);
    const order = () => buildMonthView({ store, month: NOV }).priority.map((item) => item.id);
    const [first, second, third] = order();
    moveItemInPriority({ store, itemId: third!, toIndex: 1 });
    expect(order()).toEqual([first, third, second]);
  });

  it("shares one order between By group and By priority", () => {
    const store = newStore();
    const produce = createGroup({ store, group: { name: "Produce" } });
    const dairy = createGroup({ store, group: { name: "Dairy" } });
    const add = ({ name, groupId }: { name: string; groupId: string }) => addItem({ store, month: NOV, userId: "u1", item: { name, groupId } });
    const tomatoes = add({ name: "Tomatoes", groupId: produce });
    add({ name: "Eggs", groupId: dairy });
    add({ name: "Lemons", groupId: produce });
    const labneh = add({ name: "Labneh", groupId: dairy });
    const names = (items: { name: string }[]) => items.map((item) => item.name);
    const view = () => buildMonthView({ store, month: NOV });

    expect(names(view().priority)).toEqual(["Tomatoes", "Eggs", "Lemons", "Labneh"]);

    moveItemInPriority({ store, itemId: labneh, toIndex: 0 });
    expect(names(view().priority)).toEqual(["Labneh", "Tomatoes", "Eggs", "Lemons"]);
    // Switching to By group keeps the priority order inside each group.
    expect(view().sections.map((section) => names(section.items))).toEqual([
      ["Tomatoes", "Lemons"],
      ["Labneh", "Eggs"],
    ]);

    // Dragging inside a section only changes order relative to that group.
    moveItem({ store, itemId: tomatoes, toGroupId: produce, toIndex: 1 });
    expect(view().sections.map((section) => names(section.items))).toEqual([
      ["Lemons", "Tomatoes"],
      ["Labneh", "Eggs"],
    ]);
    expect(names(view().priority)).toEqual(["Labneh", "Eggs", "Lemons", "Tomatoes"]);
  });
});

describe("add flow helpers", () => {
  it("lists next, current and earlier months that had groceries", () => {
    const store = newStore();
    addItem({ store, month: "2026-08", userId: "u1", item: { name: "Rice" } });
    store.setRow("lists", "2026-09", { created_at: 1 });
    expect(addableMonths({ store, current: NOV }).map((option) => option.month)).toEqual([DEC, NOV, "2026-08"]);
  });

  it("ranks usuals by months seen and skips items already open", () => {
    const store = newStore();
    for (const month of [OCT, "2026-09", "2026-08"] as MonthKey[]) {
      addItem({ store, month, userId: "u1", item: { name: "Tomatoes", qty: "1", unit: "kg" } });
    }
    addItem({ store, month: OCT, userId: "u1", item: { name: "Tomato paste" } });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Cherry tomatoes" } });
    expect(usuals({ store, month: NOV, query: "tom" }).map((usual) => usual.name)).toEqual(["Tomatoes", "Tomato paste"]);
  });

  it("suggests the unit last used for the same name, then household favourites, then defaults", () => {
    const store = newStore();
    expect(suggestUnits({ store, name: "Tomatoes" })).toEqual({ remembered: undefined, suggestions: ["kg", "pack", "g"] });
    addItem({ store, month: OCT, userId: "u1", item: { name: "Milk", qty: "2", unit: "bottle" }, now: midOct });
    addItem({ store, month: OCT, userId: "u1", item: { name: "Juice", unit: "bottle" }, now: midOct });
    addItem({ store, month: OCT, userId: "u1", item: { name: "tomatoes", unit: "punnet" }, now: midOct });
    addItem({ store, month: NOV, userId: "u1", item: { name: "Tomatoes", unit: "kg" }, now: midNov });
    expect(suggestUnits({ store, name: "TOMATOES " })).toEqual({ remembered: "kg", suggestions: ["kg", "bottle", "punnet"] });
    expect(customUnits({ store })).toEqual(["punnet"]);
  });
});

describe("auth protocol", () => {
  it("round-trips unicode passwords through base64url subprotocols", () => {
    const password = "ميرة pass/word+=!";
    expect(fromBase64Url(toBase64Url(password))).toBe(password);
    expect(passwordFromProtocols(authProtocols(password))).toBe(password);
    expect(toBase64Url(password)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("group colours", () => {
  const LIGHT_BG = "#F5F1E8";
  const DARK_BG = "#1E1A16";
  const sweep = [
    ...GROUP_COLOR_PRESETS.map((preset) => preset.hex),
    ...Array.from({ length: 24 }, (_, i) => hexFromHue({ hue: i * 15, intensity: 1 })),
    "#FFFF00",
    "#000000",
    "#FFFFFF",
    "#808080",
  ];

  const assertReadable = ({ hex, hex2 }: { hex: string; hex2?: string }) => {
    for (const [scheme, pageBackground] of [
      ["light", LIGHT_BG],
      ["dark", DARK_BG],
    ] as const) {
      const tone = groupTone({ hex, hex2, scheme, pageBackground });
      const label = `${hex}${hex2 ? `→${hex2}` : ""} ${scheme}`;
      expect(tone.tintStops).toHaveLength(hex2 ? 2 : 1);
      for (const stop of tone.tintStops) {
        expect(contrastRatio(tone.text, stop), `${label} text/tint`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tone.icon, stop), `${label} icon/tint`).toBeGreaterThanOrEqual(3);
      }
      expect(contrastRatio(tone.text, pageBackground), `${label} text/page`).toBeGreaterThanOrEqual(4.5);
      for (const stop of tone.badgeStops) {
        expect(contrastRatio(tone.onBadge, stop), `${label} onBadge/badge`).toBeGreaterThanOrEqual(3);
      }
    }
  };

  it("keeps solid group text >= 4.5:1 and icons >= 3:1 in both themes, for presets and any custom colour", () => {
    for (const hex of sweep) assertReadable({ hex });
  });

  it("keeps gradient text readable against both stops, for presets and arbitrary pairs", () => {
    for (const preset of GROUP_GRADIENT_PRESETS) assertReadable({ hex: preset.hex, hex2: preset.hex2 });
    for (let i = 0; i < sweep.length; i++) assertReadable({ hex: sweep[i] as string, hex2: sweep[(i * 7 + 5) % sweep.length] as string });
  });

  it("gives dark mode dark tints with light text", () => {
    const tone = groupTone({ hex: "#6B7A2E", scheme: "dark", pageBackground: DARK_BG });
    expect(contrastRatio(tone.tintStops[0] as string, "#000000")).toBeLessThan(contrastRatio(tone.text, "#000000"));
  });

  it("switches between solid and gradient without leaving a stale stop", () => {
    const store = newStore();
    const id = createGroup({ store, group: { name: "Snacks", color: "#8E3B6B", color2: "#B04A5A" } });
    expect(store.getRow("groups", id)).toMatchObject({ color: "#8E3B6B", color2: "#B04A5A" });
    updateGroup({ store, groupId: id, patch: { appearance: { color: "#2D6E68" } } });
    expect(store.getCell("groups", id, "color2")).toBeUndefined();
    updateGroup({ store, groupId: id, patch: { appearance: {} } });
    expect(store.getCell("groups", id, "color")).toBeUndefined();
    expect(
      createGroup({ store, group: { name: "Odd", color2: "#2D6E68" } }) &&
        store.getCell("groups", store.getRowIds("groups").at(-1) as string, "color2"),
    ).toBeUndefined();
  });

  it("stores a canonical hex and reads legacy token names", () => {
    const store = newStore();
    const id = createGroup({ store, group: { name: "Produce", color: "#6b7a2e" } });
    expect(store.getCell("groups", id, "color")).toBe("#6B7A2E");
    expect(normalizeGroupColor("olive")).toBe("#6B7A2E");
    expect(normalizeGroupColor("nope")).toBeUndefined();
  });

  it("round-trips the custom picker's hue", () => {
    const { hue } = hueOf(hexFromHue({ hue: 200, intensity: 0.8 }));
    expect(Math.abs(hue - 200)).toBeLessThan(3);
  });
});

describe("group icons", () => {
  it("has unique, kebab-case keys and a curated size", () => {
    expect(new Set(GROUP_ICONS).size).toBe(GROUP_ICONS.length);
    expect(GROUP_ICONS.length).toBeGreaterThanOrEqual(60);
    expect(GROUP_ICONS.length).toBeLessThanOrEqual(100);
    for (const key of GROUP_ICONS) expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("keeps an unknown (newer) icon key instead of dropping it on save", () => {
    const store = newStore();
    const id = createGroup({ store, group: { name: "Seafood", icon: "lobster-from-the-future" } });
    expect(isGroupIcon(store.getCell("groups", id, "icon") as string)).toBe(false);
    updateGroup({ store, groupId: id, patch: { name: "Sea food" } });
    expect(store.getCell("groups", id, "icon")).toBe("lobster-from-the-future");
  });
});

describe("icon search", () => {
  it("finds icons by keyword, as in the design's bread example", () => {
    expect(searchGroupIcons("bread").slice(0, 3).sort()).toEqual(["croissant", "sandwich", "wheat"]);
  });
  it("ranks name matches above keyword matches and requires every word", () => {
    expect(searchGroupIcons("ice cream")[0]).toBe("ice-cream-cone");
    expect(searchGroupIcons("milk")[0]).toBe("milk");
    expect(searchGroupIcons("zzz")).toEqual([]);
    expect(searchGroupIcons("")).toHaveLength(GROUP_ICONS.length);
  });
  it("keeps every previously shipped key", () => {
    for (const key of ["carrot", "spray-can", "thermometer-snowflake", "heart", "sparkles"]) expect(isGroupIcon(key)).toBe(true);
  });
});

describe("quantity formatting", () => {
  it("pluralises count units but not metric ones", () => {
    expect(formatQuantity({ qty: "2", unit: "bunch" })).toBe("2 bunches");
    expect(formatQuantity({ qty: "1", unit: "bunch" })).toBe("1 bunch");
    expect(formatQuantity({ qty: "3", unit: "bottle" })).toBe("3 bottles");
    expect(formatQuantity({ qty: "2", unit: "box" })).toBe("2 boxes");
    expect(formatQuantity({ qty: "2", unit: "kg" })).toBe("2 kg");
    expect(formatQuantity({ qty: "2", unit: "L" })).toBe("2 L");
    expect(formatQuantity({ qty: "2", unit: "dozen" })).toBe("2 dozen");
    expect(formatQuantity({ qty: "4", unit: "punnet" })).toBe("4 punnets");
    expect(formatQuantity({ qty: "2", unit: "berry" })).toBe("2 berries");
    expect(formatQuantity({ qty: "2", unit: "packs" })).toBe("2 packs");
    expect(formatQuantity({ unit: "pack" })).toBe("1 pack");
    expect(formatQuantity({ qty: "6" })).toBe("6");
  });
});
