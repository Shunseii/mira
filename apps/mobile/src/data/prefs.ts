import { deviceStorage } from "@/lib/deviceStorage";
import { createExternalStore, useExternalStore } from "@/lib/externalStore";
import { isAccentName, type AccentName, type ThemeMode } from "@/theme/tokens";

/** Per-device, per-person look. Never synced: "others keep their own". */
export type ListView = "group" | "priority";
/** Where checked items go: stay where they are, sink to the end of their group/list, or move to a collapsible Checked section. */
export type CheckedItems = "stay" | "end" | "section";
/** By priority: each item's group as its full name under the item, or as a small icon tile after the name. */
export type GroupLabel = "name" | "icon";

type Prefs = {
  themeMode: ThemeMode;
  accent: AccentName;
  listView: ListView;
  /** Off hides units everywhere on this device; stored units are kept and come back when it's on again. */
  showUnits: boolean;
  checkedItems: CheckedItems;
  /** The Checked section's last open/closed state on this device. */
  checkedCollapsed: boolean;
  groupLabel: GroupLabel;
  /** Add item's button adds and clears the form for the next item, instead of going back to the list. */
  keepAdding: boolean;
};

const KEY = "mira.prefs";

const isCheckedItems = (value: unknown): value is CheckedItems => value === "stay" || value === "end" || value === "section";

const load = (): Prefs => {
  const fallback: Prefs = { themeMode: "system", accent: "terracotta", listView: "group", showUnits: true, checkedItems: "end", checkedCollapsed: true, groupLabel: "name", keepAdding: false };
  try {
    const parsed = JSON.parse(deviceStorage.get(KEY) ?? "{}") as Partial<Record<keyof Prefs | "checkedToEnd", unknown>>;
    const themeMode = parsed.themeMode === "light" || parsed.themeMode === "dark" ? parsed.themeMode : "system";
    return {
      themeMode,
      accent: typeof parsed.accent === "string" && isAccentName(parsed.accent) ? parsed.accent : fallback.accent,
      listView: parsed.listView === "priority" ? "priority" : "group",
      showUnits: parsed.showUnits !== false,
      checkedItems: isCheckedItems(parsed.checkedItems)
        ? parsed.checkedItems
        : // Before the three-way choice this was a switch, "checkedToEnd".
          parsed.checkedToEnd === false
          ? "stay"
          : "end",
      checkedCollapsed: parsed.checkedCollapsed !== false,
      groupLabel: parsed.groupLabel === "icon" ? "icon" : "name",
      keepAdding: parsed.keepAdding === true,
    };
  } catch {
    return fallback;
  }
};

const prefsStore = createExternalStore<Prefs>(load());

export const usePrefs = (): Prefs => useExternalStore(prefsStore);

export const setPrefs = (patch: Partial<Prefs>): void => {
  prefsStore.set((previous) => ({ ...previous, ...patch }));
  deviceStorage.set(KEY, JSON.stringify(prefsStore.get()));
};
