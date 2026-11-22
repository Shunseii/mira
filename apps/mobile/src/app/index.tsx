import {
  browsableMonths,
  buildMonthView,
  deleteItems,
  monthName,
  moveItem,
  liveGroups,
  moveItemInPriority,
  restoreItems,
  setChecked,
  setCheckedMany,
  TABLES,
  type Group,
  type Item,
  type MonthKey,
  type MonthView,
} from "@mira/shared";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BackHandler, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  NestedReorderableList,
  ScrollViewContainer,
  reorderItems,
  useIsActive,
  useReorderableDrag,
  type ReorderableListReorderEvent,
} from "react-native-reorderable-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { ArrangeListSheet } from "@/components/ArrangeListSheet";
import { GroupChip } from "@/components/GroupBadge";
import { Icon } from "@/components/Icon";
import { SQUIRCLE_SHADOW_RADIUS, SquircleFill } from "@/components/Squircle";
import { GripIcon, ItemRow, ROW_INSET } from "@/components/ItemRow";
import { ListTopBar, MonthTitle } from "@/components/ListHeader";
import { MonthSheet } from "@/components/MonthSheet";
import { UpdateSheet } from "@/components/UpdateReady";
import type { SheetRef } from "@/components/Sheet";
import { Screen } from "@/components/Screen";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { UNDO_MS, UndoSnackbar } from "@/components/UndoSnackbar";
import { HOLD_MS, Tap, haptic, PRESS_DELAY_MS } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useCurrentMonth, useHousehold, useHouseholdState, useStoreQuery } from "@/data/HouseholdProvider";
import { getPref, setPrefs, usePref, type ListView } from "@/data/prefs";
import { updateSession, useSession } from "@/data/session";
import { setExpandOrigin, useOriginHidden } from "@/lib/expandOrigin";
import { createStabilizer } from "@/lib/stableRows";
import { ROW_LAYOUT, SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, SEPARATOR_HEIGHT } from "@/theme/tokens";

/** Just after a row's hold fires (HOLD_MS), so the row is picked up before the pan takes the touch. */
const PAN_AFTER_HOLD_MS = HOLD_MS + 50;
const FAB_SIZE = 64;
const SEARCH_HEIGHT = 44;
const SEARCH_RADIUS = 14;

/** How far a new month's list slides in from the side it came from. */
const MONTH_SHIFT = 24;
const MONTH_FADE_MS = 180;
const MIN_SYNC_FEEDBACK_MS = 600;

const monthEntering = (direction: 1 | -1) => () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateX: MONTH_SHIFT * direction }] },
    animations: {
      opacity: withTiming(1, { duration: MONTH_FADE_MS }),
      transform: [{ translateX: withSpring(0, SPRING_SNAPPY) }],
    },
  };
};

/** What the Undo bar would put back. Checks tapped in a row gather into one offer. */
type UndoOffer =
  | { kind: "delete"; itemIds: string[]; message: string }
  | { kind: "check"; items: { id: string; name: string }[] }
  | { kind: "checkAll"; itemIds: string[]; checked: boolean; title: string };

const undoMessage = (offer: UndoOffer): string => {
  if (offer.kind === "delete") return offer.message;
  if (offer.kind === "check") {
    const [only] = offer.items;
    return offer.items.length === 1 && only ? `Checked ${only.name}` : `Checked ${offer.items.length} items`;
  }
  const count = offer.itemIds.length === 1 ? "1 item" : `${offer.itemIds.length} items`;
  return `${offer.checked ? "Checked" : "Unchecked"} ${count} in ${offer.title}`;
};

const CheckedChevron = ({ open }: { open: boolean }) => {
  const { colors } = useTheme();
  const turn = useSharedValue(open ? 90 : 0);
  useEffect(() => {
    turn.set(withSpring(open ? 90 : 0, SPRING_SNAPPY));
  }, [open, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="chevron-right" size={18} color={colors.ink3} />
    </Animated.View>
  );
};

type HeaderRow = {
  kind: "header";
  key: string;
  title: string;
  remaining: number;
  group?: Group;
  groupId?: string;
  itemIds: string[];
  /** By priority: one plain label over the whole list instead of a group chip. */
  priority?: boolean;
  /** The collapsible Checked section at the bottom (when checked items go to their own section). */
  checkedSection?: boolean;
  /** Filtered out by the search. Stays mounted so clearing the search is only a style change. */
  hidden?: boolean;
};
/**
 * `hidden`: filtered out by the search. `inChecked`: in the Checked section, which folds on the UI thread.
 * Both stay mounted, so clearing the search or unfolding Checked is only a style change, not mounting rows.
 */
type ItemRowData = { kind: "item"; key: string; item: Item; group?: Group; hidden?: boolean; inChecked?: boolean };
type Row = HeaderRow | ItemRowData;

const buildRows = ({ view, listView, groupsById }: { view: MonthView; listView: ListView; groupsById: Map<string, Group> }): Row[] => [
  ...listRows({ view, listView, groupsById }),
  ...checkedRows({ view, groupsById }),
];

/** The Checked section: one collapsible header after everything else, then the checked items with their group shown. */
const checkedRows = ({ view, groupsById }: { view: MonthView; groupsById: Map<string, Group> }): Row[] => {
  if (view.checked.length === 0) return [];
  const header: Row = {
    kind: "header",
    key: "h-checked",
    title: "Checked",
    remaining: view.checked.length,
    itemIds: view.checked.map((item) => item.id),
    checkedSection: true,
  };
  return [
    header,
    ...view.checked.map(
      (item): Row => ({ kind: "item", key: item.id, item, group: item.groupId ? groupsById.get(item.groupId) : undefined, inChecked: true }),
    ),
  ];
};

const listRows = ({ view, listView, groupsById }: { view: MonthView; listView: ListView; groupsById: Map<string, Group> }): Row[] => {
  if (listView === "priority") {
    if (view.priority.length === 0) return [];
    const groupOf = groupsById;
    const remaining = view.priority.filter((item) => item.checkedAt === undefined).length;
    return [
      {
        kind: "header",
        key: "h-priority",
        title: "By priority",
        remaining,
        itemIds: view.priority.map((item) => item.id),
        priority: true,
      },
      ...view.priority.map((item): Row => ({
        kind: "item",
        key: item.id,
        item,
        group: item.groupId ? groupOf.get(item.groupId) : undefined,
      })),
    ];
  }
  const out: Row[] = [];
  for (const section of view.sections) {
    if (section.group) {
      out.push({
        kind: "header",
        key: `h-${section.key}`,
        title: section.group.name,
        remaining: section.remaining,
        group: section.group,
        groupId: section.group.id,
        itemIds: section.items.map((item) => item.id),
      });
    }
    for (const item of section.items) out.push({ kind: "item", key: item.id, item });
  }
  return out;
};

const isOpenItem = (row: Row | undefined): boolean => row?.kind === "item" && row.item.checkedAt === undefined;

/**
 * By group: where a row dropped at `index` lands. The nearest section header
 * above it decides the group (none above = ungrouped); the index counts the
 * unchecked items above it in that section.
 */
const dropTarget = ({ rows, index }: { rows: Row[]; index: number }): { groupId: string | undefined; toIndex: number } => {
  let toIndex = 0;
  for (let i = index - 1; i >= 0; i--) {
    const row = rows[i];
    if (!row) continue;
    // The Checked section isn't a group: a row dropped below it belongs to the last group above.
    if (row.kind === "header" && row.checkedSection) continue;
    if (row.kind === "header") return { groupId: row.groupId, toIndex };
    if (isOpenItem(row)) toIndex++;
  }
  return { groupId: undefined, toIndex };
};

/** By priority: the dropped item's place among all the month's unchecked items. */
const priorityDropIndex = ({ rows, index }: { rows: Row[]; index: number }): number => rows.slice(0, index).filter(isOpenItem).length;

const SearchBar = ({ month, value, onChange, onView }: { month: MonthKey; value: string; onChange: (text: string) => void; onView: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.searchRow}>
      <View style={styles.search}>
        <SquircleFill radius={SEARCH_RADIUS} color={colors.surface2} />
        <Icon name="search" size={18} color={colors.ink3} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={`Search ${monthName(month)}`}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.ink }]}
        />
        {value ? (
          <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityLabel="Clear search" onPress={() => onChange("")} style={styles.clear}>
            <Icon name="x" size={18} color={colors.ink2} />
          </Tap>
        ) : null}
      </View>
      <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="button" accessibilityLabel="Arrange list" pressScale={0.92} onPress={onView} style={styles.viewButton}>
        <SquircleFill size={{ width: SEARCH_HEIGHT, height: SEARCH_HEIGHT }} radius={SEARCH_RADIUS} color={colors.surface2} />
        <Icon name="list-ordered" size={20} color={colors.ink2} />
      </Tap>
    </View>
  );
};

const EmptyState = ({ searching }: { searching: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={searching ? "search" : "shopping-basket"} size={32} color={colors.ink2} />
      </View>
      <Text variant="title">{searching ? "Nothing matches" : "Nothing on the list yet"}</Text>
      {searching ? null : (
        <Text variant="secondary" color="ink2" style={styles.emptyBody}>
          Tap + to add the first thing you need this month.
        </Text>
      )}
    </View>
  );
};

/**
 * Rows in Checked fold on the UI thread from a shared value, so folding or unfolding Checked doesn't
 * re-render the list: only the header re-renders.
 */
const FoldableRow = ({ folded, hidden, children }: { folded?: SharedValue<boolean>; hidden: boolean; children: ReactNode }) => {
  const foldStyle = useAnimatedStyle(() => ({ display: hidden || folded?.value ? "none" : "flex" }));
  return <Animated.View style={foldStyle}>{children}</Animated.View>;
};

const FoldSync = ({ folded }: { folded: SharedValue<boolean> }) => {
  const collapsed = usePref("checkedCollapsed");
  useEffect(() => {
    folded.set(collapsed);
  }, [collapsed, folded]);
  return null;
};

/** Reads the fold itself, so folding Checked re-renders this header and nothing else in the list. */
const CheckedHeader = ({ row, onToggle }: { row: HeaderRow; onToggle: () => void }) => {
  const { colors } = useTheme();
  const collapsed = usePref("checkedCollapsed");
  return (
      <View style={styles.headerInset}>
        <Tap
          unstable_pressDelay={PRESS_DELAY_MS}
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={`Checked items, ${row.remaining}`}
          accessibilityHint={collapsed ? "Shows them" : "Hides them"}
          pressScale={0.99}
          onPress={onToggle}
          style={[styles.groupHeader, styles.priorityHeader]}
        >
          <View pointerEvents="none" style={[styles.headerLine, { backgroundColor: colors.line }]} />
          <Text variant="eyebrow" color="ink2">
            {row.title}
          </Text>
          <Text variant="tag" color="ink2">
            {row.remaining}
          </Text>
          <View style={styles.flex} />
          <CheckedChevron open={!collapsed} />
        </Tap>
      </View>
  );
};

/** Group header: chip, items left (✓ when done), and a check-all / uncheck-all button. */
const SectionHeader = ({
  row,
  onCheckAll,
  onToggleChecked,
}: {
  row: HeaderRow;
  onCheckAll?: (row: HeaderRow) => void;
  onToggleChecked: () => void;
}) => {
  const { colors } = useTheme();
  const done = row.remaining === 0;
  if (row.checkedSection) {
    return <CheckedHeader row={row} onToggle={onToggleChecked} />;
  }
  if (row.priority) {
    return (
      <View style={styles.headerInset}>
        <View style={[styles.groupHeader, styles.priorityHeader]}>
          <View pointerEvents="none" style={[styles.headerLine, { backgroundColor: colors.line }]} />
          <Text variant="eyebrow" color="ink2">
            {row.title}
          </Text>
          <Text variant="tag" color="ink2">
            {row.remaining}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.headerInset}>
      <View style={styles.groupHeader}>
        <View pointerEvents="none" style={[styles.headerLine, { backgroundColor: colors.line }]} />
        {row.group ? <GroupChip group={row.group} name={row.title} /> : null}
        {done ? (
          <Icon name="check" size={14} color={colors.ink3} />
        ) : (
          <Text variant="tag" color="ink2">
            {row.remaining}
          </Text>
        )}
        <View style={styles.flex} />
        {onCheckAll ? (
          <Tap
            unstable_pressDelay={PRESS_DELAY_MS}
            accessibilityRole="button"
            accessibilityLabel={done ? `Uncheck everything in ${row.title}` : `Check off everything in ${row.title}`}
            feedback="select"
            pressScale={0.9}
            onPress={() => onCheckAll(row)}
            style={styles.checkAll}
          >
            <Icon name="check-check" size={18} color={done ? colors.accent : colors.ink3} />
          </Tap>
        ) : (
          // Same footprint without the button, so headers keep their height across modes and pages.
          <View style={styles.checkAll} />
        )}
      </View>
    </View>
  );
};

/** Replaces the search bar in reorder mode. */
const ReorderHint = ({ listView, onDone }: { listView: ListView; onDone: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.reorderHint}>
      <SquircleFill radius={14} color={colors.accentSoft} />
      <Icon name="grip-vertical" size={18} color={colors.accent} />
      <Text variant="caption" color="ink" style={styles.flex}>
        {listView === "priority" ? "Hold and drag items into the order you shop." : "Hold and drag items, within or between groups."}
      </Text>
      <Tap
        unstable_pressDelay={PRESS_DELAY_MS}
        accessibilityRole="button"
        accessibilityLabel="Done reordering"
        feedback="select"
        onPress={onDone}
        style={[styles.done, { backgroundColor: colors.accent }]}
      >
        <Text variant="label" color="onAccent">
          Done
        </Text>
      </Tap>
    </View>
  );
};

const noop = () => undefined;

type RowHandlers = {
  onPress: (item: Item) => void;
  /** Enters reorder mode; returns whether the held row may be picked up straight away. */
  onHold: (item: Item) => boolean;
  onDelete: (item: Item) => void;
  onEdit: (item: Item) => void;
};

/**
 * An item row inside the reorderable list. Normally: tap to check, swipe left
 * to delete, hold to pick it up and drag it (which also starts reorder mode).
 * In reorder mode, holding an unchecked item picks it up and nothing else on the row reacts.
 */
/**
 * Everything below the list cell's context. The cell context changes whenever a row's index shifts (a check
 * that moves an item renumbers every row after it), so the swipeable row itself only re-renders when its
 * own props do.
 */
const RowContent = memo(
  ({
    item,
    group,
    pending,
    handlers,
    reorderMode,
    active,
    onLongPress,
  }: {
    item: Item;
    group?: Group;
    pending: boolean;
    handlers: RowHandlers;
    reorderMode: boolean;
    active: boolean;
    onLongPress: () => void;
  }) => {
    const checked = item.checkedAt !== undefined;
    const onDelete = useCallback(() => handlers.onDelete(item), [handlers, item]);
    return (
      <SwipeToDelete enabled={!reorderMode} onDelete={onDelete}>
        <ItemRow
          item={item}
          group={group}
          pending={pending}
          onPress={reorderMode ? noop : handlers.onPress}
          onLongPress={onLongPress}
          onDelete={reorderMode ? undefined : handlers.onDelete}
          onEdit={reorderMode ? undefined : handlers.onEdit}
          // In reorder mode the grip marks what can move; the row itself is what you hold.
          grip={reorderMode && !checked ? <GripIcon active={active} /> : undefined}
          lifted={active}
        />
      </SwipeToDelete>
    );
  },
);
RowContent.displayName = "RowContent";

/**
 * An item row inside the reorderable list. Normally: tap to check, swipe left
 * to delete, hold to pick it up and drag it (which also starts reorder mode).
 * In reorder mode, holding an unchecked item picks it up and nothing else on the row reacts.
 */
const DraggableItem = memo(
  ({
    item,
    group,
    pending,
    handlers,
    reorderMode,
  }: {
    item: Item;
    group?: Group;
    pending: boolean;
    handlers: RowHandlers;
    reorderMode: boolean;
  }) => {
    const drag = useReorderableDrag();
    const active = useIsActive();
    const checked = item.checkedAt !== undefined;
    // Read through a ref so a renumbered cell (new drag handler) doesn't re-render the row.
    const dragRef = useRef(drag);
    useEffect(() => {
      dragRef.current = drag;
    }, [drag]);
    const onLongPress = useCallback(() => {
      const pickUp = reorderMode || handlers.onHold(item);
      if (pickUp && !checked) dragRef.current();
    }, [checked, handlers, item, reorderMode]);

    return (
      <RowContent
        item={item}
        group={group}
        pending={pending}
        handlers={handlers}
        reorderMode={reorderMode}
        active={active}
        onLongPress={onLongPress}
      />
    );
  },
);
DraggableItem.displayName = "DraggableItem";

export default function ListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const household = useHousehold();
  const { pending, status } = useHouseholdState();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const [place, setPlace] = useState<{ month: MonthKey; direction: 1 | -1 }>({ month: current, direction: 1 });
  const { month } = place;
  const [search, setSearch] = useState("");
  const [undo, setUndo] = useState<UndoOffer>();
  const [reorderMode, setReorderMode] = useState(false);
  const monthSheet = useRef<SheetRef>(null);
  const viewSheet = useRef<SheetRef>(null);
  const updateSheet = useRef<SheetRef>(null);
  const listView = usePref("listView");
  const checkedItems = usePref("checkedItems");
  // Checked folds on the UI thread (see FoldableRow); FoldSync keeps it in step if the pref changes elsewhere.
  const folded = useSharedValue(getPref("checkedCollapsed"));

  const view = useStoreQuery(
    (store) => buildMonthView({ store, month, checkedLast: checkedItems !== "stay", checkedApart: checkedItems === "section" }),
    [month, checkedItems],
  );
  const searching = search.trim() !== "";
  const searchView = useStoreQuery(
    (store) =>
      searching
        ? buildMonthView({ store, month, search, checkedLast: checkedItems !== "stay", checkedApart: checkedItems === "section" })
        : undefined,
    [month, search, searching, checkedItems],
  );
  const groups = useStoreQuery((store) => liveGroups({ store }), []);
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const toggleChecked = useCallback(() => {
    const next = !getPref("checkedCollapsed");
    folded.set(next);
    setPrefs({ checkedCollapsed: next });
  }, [folded]);
  const months = useStoreQuery((store) => browsableMonths({ store, current }), [current]);
  // Hand memoized rows the same objects when nothing about them changed, so one check re-renders one row.
  const [stableItem] = useState(createStabilizer<Item>);
  const [stableGroup] = useState(createStabilizer<Group>);
  const rows = useMemo(() => {
    const matches =
      searchView && new Map(buildRows({ view: searchView, listView, groupsById }).map((row) => [row.key, row]));
    return buildRows({ view, listView, groupsById })
      .map((row): Row => (matches ? (matches.get(row.key) ?? { ...row, hidden: true }) : row))
      .map((row) =>
        row.kind === "item"
          ? { ...row, item: stableItem(row.item.id, row.item), group: row.group && stableGroup(row.group.id, row.group) }
          : row,
      );
  }, [groupsById, listView, searchView, stableGroup, stableItem, view]);
  const nothingShown = rows.every((row) => row.hidden);
  const pendingSet = useMemo(() => new Set(pending), [pending]);

  const index = months.indexOf(month);
  const previous = index > 0 ? months[index - 1] : undefined;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : undefined;

  // Android back leaves reorder mode before it leaves the screen.
  useFocusEffect(
    useCallback(() => {
      if (!reorderMode) return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        setReorderMode(false);
        return true;
      });
      return () => subscription.remove();
    }, [reorderMode]),
  );

  useEffect(() => {
    if (!undo) return undefined;
    const timer = setTimeout(() => setUndo(undefined), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  // Pull to refresh and the sync pill: the spinner stays long enough to register, then shows how it went.
  const [syncing, setSyncing] = useState<"pull" | "pill">();
  const syncNow = useCallback(
    async (from: "pull" | "pill") => {
      setSyncing(from);
      await Promise.all([household.nudge({ asked: true }), new Promise((resolve) => setTimeout(resolve, MIN_SYNC_FEEDBACK_MS))]);
      setSyncing(undefined);
    },
    [household],
  );

  const goToMonth = useCallback((target: MonthKey) => {
    setPlace((previous) =>
      previous.month === target ? previous : { month: target, direction: target > previous.month ? 1 : -1 },
    );
    setSearch("");
    setReorderMode(false);
  }, []);

  const startReordering = useCallback(() => {
    setSearch("");
    setReorderMode(true);
  }, []);
  // Read when a row is held, without re-creating every row's handlers on each keystroke.
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  const handlers = useMemo<RowHandlers>(
    () => ({
      onPress: (item) => {
        if (!userId) return;
        const checking = item.checkedAt === undefined;
        household.write((store) => setChecked({ store, itemId: item.id, userId, checked: checking }));
        setUndo((offer) => {
          if (checking) {
            const items = offer?.kind === "check" ? offer.items.filter((other) => other.id !== item.id) : [];
            return { kind: "check", items: [...items, { id: item.id, name: item.name }] };
          }
          // Unchecking by hand takes that item out of a pending "Checked …" offer.
          if (offer?.kind !== "check") return offer;
          const items = offer.items.filter((other) => other.id !== item.id);
          return items.length === 0 ? undefined : { kind: "check", items };
        });
      },
      onHold: () => {
        // Clearing an active search reshuffles the rows, so only pick the row up when none was showing.
        const wasSearching = searchRef.current.trim() !== "";
        startReordering();
        return !wasSearching;
      },
      onDelete: (item) => {
        household.write((store) => deleteItems({ store, itemIds: [item.id] }));
        setUndo({ kind: "delete", itemIds: [item.id], message: `Deleted ${item.name}` });
      },
      onEdit: (item) => router.push({ pathname: "/item/[id]", params: { id: item.id } }),
    }),
    [household, startReordering, userId],
  );

  const checkAll = useCallback(
    (row: HeaderRow) => {
      if (!userId) return;
      const checked = row.remaining > 0;
      const { store } = household;
      const changing = row.itemIds.filter((id) => (store.getCell(TABLES.items, id, "checked_at") !== undefined) !== checked);
      if (changing.length === 0) return;
      household.write((store) => setCheckedMany({ store, itemIds: changing, userId, checked }));
      haptic(checked ? "success" : "light");
      setUndo({ kind: "checkAll", itemIds: changing, checked, title: row.title });
    },
    [household, userId],
  );

  // Add item grows out of the + button, so it needs to know where the button is.
  const fab = useRef<View>(null);
  const fabHidden = useOriginHidden();
  const openAdd = () => {
    const push = () => router.push({ pathname: "/add", params: { month } });
    if (!fab.current) return push();
    fab.current.measureInWindow((x, y, width, height) => {
      setExpandOrigin({ x, y, width, height, radius: FAB_SIZE * SQUIRCLE_SHADOW_RADIUS });
      push();
    });
  };

  const undoLast = () => {
    if (!undo) return;
    setUndo(undefined);
    if (undo.kind === "delete") {
      household.write((store) => restoreItems({ store, itemIds: undo.itemIds }));
      return;
    }
    if (!userId) return;
    const itemIds = undo.kind === "check" ? undo.items.map((item) => item.id) : undo.itemIds;
    const checked = undo.kind === "checkAll" ? !undo.checked : false;
    household.write((store) => setCheckedMany({ store, itemIds, userId, checked }));
  };

  const onReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      const moved = rows[from];
      if (!moved || moved.kind !== "item" || moved.item.checkedAt !== undefined || from === to) return;
      const reordered = reorderItems(rows, from, to);
      const index = reordered.indexOf(moved);
      if (listView === "priority") {
        const toIndex = priorityDropIndex({ rows: reordered, index });
        household.write((store) => moveItemInPriority({ store, itemId: moved.item.id, toIndex }));
        return;
      }
      const target = dropTarget({ rows: reordered, index });
      household.write((store) => moveItem({ store, itemId: moved.item.id, toGroupId: target.groupId, toIndex: target.toIndex }));
    },
    [household, listView, rows],
  );

  const renderRow = useCallback(
    ({ item: row }: { item: Row }) =>
      row.kind === "header" ? (
        <View style={row.hidden && styles.folded}>
          <SectionHeader row={row} onCheckAll={reorderMode ? undefined : checkAll} onToggleChecked={toggleChecked} />
        </View>
      ) : (
        <FoldableRow folded={row.inChecked ? folded : undefined} hidden={row.hidden === true}>
          <DraggableItem
            item={row.item}
            group={row.group}
            pending={pendingSet.has(`items/${row.item.id}`)}
            handlers={handlers}
            reorderMode={reorderMode}
          />
        </FoldableRow>
      ),
    [checkAll, folded, handlers, pendingSet, reorderMode, toggleChecked],
  );

  return (
    <Screen edges={["top"]}>
      <FoldSync folded={folded} />
      <ScrollViewContainer
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            enabled={!reorderMode}
            refreshing={syncing === "pull"}
            onRefresh={() => void syncNow("pull")}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <ListTopBar
          onSettings={() => router.push({ pathname: "/settings", params: { month } })}
          syncing={syncing !== undefined}
          onSyncPill={() => (status === "unauthorized" ? updateSession({ password: null }) : void syncNow("pill"))}
          onUpdatePill={() => updateSheet.current?.present()}
        />
        <LayoutAnimationConfig skipEntering>
          <Animated.View key={month} entering={monthEntering(place.direction)}>
            <MonthTitle
              month={month}
              canGoBack={previous !== undefined}
              canGoForward={next !== undefined}
              onStep={(direction) => {
                const target = direction === 1 ? next : previous;
                if (target) goToMonth(target);
              }}
              onOpenPicker={() => monthSheet.current?.present()}
            />
          </Animated.View>
        </LayoutAnimationConfig>
        {reorderMode ? (
          <ReorderHint listView={listView} onDone={() => setReorderMode(false)} />
        ) : view.totalCount > 0 ? (
          <SearchBar month={month} value={search} onChange={setSearch} onView={() => viewSheet.current?.present()} />
        ) : null}

        <LayoutAnimationConfig skipEntering>
          <Animated.View key={month} entering={monthEntering(place.direction)} style={styles.rows}>
            {nothingShown ? <EmptyState searching={searching} /> : null}
            <NestedReorderableList
              data={rows}
              // Lists are short: render every row in the first pass instead of
              // FlatList's default batches, so a month appears complete at once.
              initialNumToRender={Math.max(rows.length, 20)}
              maxToRenderPerBatch={100}
              windowSize={41}
              keyExtractor={(row) => row.key}
              renderItem={renderRow}
              onReorder={onReorder}
              onDragStart={() => {
                "worklet";
                scheduleOnRN(haptic, "medium");
              }}
              onDragEnd={() => {
                "worklet";
                scheduleOnRN(haptic, "light");
              }}
              shouldUpdateActiveItem
              // The same in and out of reorder mode, so entering it mid-hold doesn't cancel the drag.
              // The pan only takes over once a row has been held, so a plain swipe always scrolls.
              dragEnabled
              panEnabled
              panActivateAfterLongPress={PAN_AFTER_HOLD_MS}
              itemLayoutAnimation={ROW_LAYOUT}
              scrollEnabled={false}
              renderDropIndicator={() => (
                <View style={styles.dropIndicatorInset}>
                  <View style={[styles.dropIndicator, { backgroundColor: colors.accent }]} />
                </View>
              )}
            />
          </Animated.View>
        </LayoutAnimationConfig>
      </ScrollViewContainer>

      {undo ? (
        <UndoSnackbar
          message={undoMessage(undo)}
          onUndo={undoLast}
          onDismiss={() => setUndo(undefined)}
          bottom={Math.max(insets.bottom, 16) + (reorderMode ? 16 : 96)}
        />
      ) : null}

      {reorderMode ? null : (
        <Animated.View
          entering={FadeIn.duration(160)}
          pointerEvents="box-none"
          style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
        >
          <View ref={fab} collapsable={false} style={fabHidden ? styles.hidden : null}>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={`Add item to ${monthName(month)}`}
              feedback="none"
              pressScale={0.92}
              onPress={openAdd}
              style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
            >
              <SquircleFill size={{ width: FAB_SIZE, height: FAB_SIZE }} radius={FAB_SIZE / 2} color={colors.accent} />
              <Icon name="plus" size={28} color={colors.onAccent} />
            </Tap>
          </View>
        </Animated.View>
      )}
      <MonthSheet
        ref={monthSheet}
        current={current}
        selected={month}
        onSelect={goToMonth}
        title="Go to month"
        subtitle="Months that had groceries, plus next month."
      />
      <ArrangeListSheet
        ref={viewSheet}
        value={listView}
        onChange={(nextView) => {
          setPrefs({ listView: nextView });
          viewSheet.current?.dismiss();
        }}
        onReorder={() => {
          viewSheet.current?.dismiss();
          haptic("medium");
          startReordering();
        }}
      />
      <UpdateSheet ref={updateSheet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 8, marginBottom: 6 },
  search: {
    flex: 1,
    height: SEARCH_HEIGHT,
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  viewButton: {
    width: SEARCH_HEIGHT,
    height: SEARCH_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 16,
    height: "100%",
    outlineWidth: 0,
  },
  clear: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  /** Widened so selected rows' tint has room past the content edge; rows pad themselves back in. */
  rows: { paddingTop: 4, marginHorizontal: -ROW_INSET },
  folded: { display: "none" },
  headerInset: { paddingHorizontal: ROW_INSET },
  priorityHeader: { paddingTop: 20, paddingBottom: 8 },
  dropIndicatorInset: { paddingHorizontal: ROW_INSET },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
    paddingBottom: 8,
  },
  /**
   * Drawn over the header rather than as a border: a hairline border adds a fraction of a pixel to each
   * header's height, and By group's many headers pushed the rows below onto fractional positions where
   * Android clipped their separators and the last row's bottom.
   */
  headerLine: { position: "absolute", left: 0, right: 0, bottom: 0, height: SEPARATOR_HEIGHT },
  checkAll: {
    width: 44,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -10,
  },
  dropIndicator: { height: 2, borderRadius: 1 },
  reorderHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 44,
    marginTop: 8,
    marginBottom: 6,
  },
  done: { height: 32, borderRadius: 16, paddingHorizontal: 14, justifyContent: "center" },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingTop: 96,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyBody: { textAlign: "center" },
  dock: { position: "absolute", right: 20, bottom: 0 },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    // Casts the shadow; the squircle drawn on top covers it.
    borderRadius: FAB_SIZE * SQUIRCLE_SHADOW_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
