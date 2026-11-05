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
  type Group,
  type Item,
  type MonthKey,
  type MonthView,
} from "@mira/shared";
import { router, useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
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
import { HOLD_MS, Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useCurrentMonth, useHousehold, useHouseholdState, useStoreQuery } from "@/data/HouseholdProvider";
import { setPrefs, usePrefs, type ListView } from "@/data/prefs";
import { updateSession, useSession } from "@/data/session";
import { setExpandOrigin, useOriginHidden } from "@/lib/expandOrigin";
import { ROW_LAYOUT } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

/** Rows glide to their new place; no fades or bounce, so adding and editing stay calm. */
/** Right-edge strip (px) where a touch belongs to the grip in reorder mode. */
/** Just after a row's hold fires (HOLD_MS), so the row is picked up before the pan takes the touch. */
const PAN_AFTER_HOLD_MS = HOLD_MS + 50;
const FAB_SIZE = 64;
const SEARCH_HEIGHT = 44;
const SEARCH_RADIUS = 14;

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
  checkedSection?: { collapsed: boolean };
};
type ItemRowData = { kind: "item"; key: string; item: Item; group?: Group };
type Row = HeaderRow | ItemRowData;

const buildRows = ({
  view,
  listView,
  groupsById,
  checkedCollapsed,
}: {
  view: MonthView;
  listView: ListView;
  groupsById: Map<string, Group>;
  checkedCollapsed: boolean;
}): Row[] => [...listRows({ view, listView, groupsById }), ...checkedRows({ view, groupsById, collapsed: checkedCollapsed })];

/** The Checked section: one collapsible header after everything else, then (when open) the checked items with their group shown. */
const checkedRows = ({ view, groupsById, collapsed }: { view: MonthView; groupsById: Map<string, Group>; collapsed: boolean }): Row[] => {
  if (view.checked.length === 0) return [];
  const header: Row = {
    kind: "header",
    key: "h-checked",
    title: "Checked",
    remaining: view.checked.length,
    itemIds: view.checked.map((item) => item.id),
    checkedSection: { collapsed },
  };
  if (collapsed) return [header];
  return [
    header,
    ...view.checked.map((item): Row => ({ kind: "item", key: item.id, item, group: item.groupId ? groupsById.get(item.groupId) : undefined })),
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
          <Tap accessibilityLabel="Clear search" onPress={() => onChange("")} style={styles.clear}>
            <Icon name="x" size={18} color={colors.ink2} />
          </Tap>
        ) : null}
      </View>
      <Tap accessibilityRole="button" accessibilityLabel="Arrange list" pressScale={0.92} onPress={onView} style={styles.viewButton}>
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
    const { collapsed } = row.checkedSection;
    return (
      <View style={styles.headerInset}>
        <Tap
          accessibilityRole="button"
          accessibilityState={{ expanded: !collapsed }}
          accessibilityLabel={`Checked items, ${row.remaining}`}
          accessibilityHint={collapsed ? "Shows them" : "Hides them"}
          pressScale={0.99}
          onPress={onToggleChecked}
          style={[styles.groupHeader, styles.priorityHeader, { borderBottomColor: colors.line }]}
        >
          <Text variant="eyebrow" color="ink2">
            {row.title}
          </Text>
          <Text variant="tag" color="ink3">
            {row.remaining}
          </Text>
          <View style={styles.flex} />
          <View style={collapsed ? null : styles.chevronOpen}>
            <Icon name="chevron-right" size={18} color={colors.ink3} />
          </View>
        </Tap>
      </View>
    );
  }
  if (row.priority) {
    return (
      <View style={styles.headerInset}>
        <View style={[styles.groupHeader, styles.priorityHeader, { borderBottomColor: colors.line }]}>
          <Text variant="eyebrow" color="ink2">
            {row.title}
          </Text>
          <Text variant="tag" color="ink3">
            {row.remaining}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.headerInset}>
      <View style={[styles.groupHeader, { borderBottomColor: colors.line }]}>
        {row.group ? <GroupChip group={row.group} name={row.title} /> : null}
        {done ? (
          <Icon name="check" size={14} color={colors.ink3} />
        ) : (
          <Text variant="tag" color="ink3">
            {row.remaining}
          </Text>
        )}
        <View style={styles.flex} />
        {onCheckAll ? (
          <Tap
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
const DraggableItem = memo(
  ({
    item,
    group,
    month,
    pending,
    handlers,
    reorderMode,
  }: {
    item: Item;
    group?: Group;
    month: MonthKey;
    pending: boolean;
    handlers: RowHandlers;
    reorderMode: boolean;
  }) => {
    const drag = useReorderableDrag();
    const active = useIsActive();
    const checked = item.checkedAt !== undefined;

    return (
      <SwipeToDelete enabled={!reorderMode} onDelete={() => handlers.onDelete(item)}>
        <ItemRow
          item={item}
          group={group}
          pending={pending}
          onPress={reorderMode ? noop : handlers.onPress}
          onLongPress={() => {
            const pickUp = reorderMode || handlers.onHold(item);
            if (pickUp && !checked) drag();
          }}
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
DraggableItem.displayName = "DraggableItem";

export default function ListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const household = useHousehold();
  const { pending, status } = useHouseholdState();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const [month, setMonth] = useState<MonthKey>(current);
  const [search, setSearch] = useState("");
  const [undo, setUndo] = useState<{ itemIds: string[]; message: string }>();
  const [reorderMode, setReorderMode] = useState(false);
  const monthSheet = useRef<SheetRef>(null);
  const viewSheet = useRef<SheetRef>(null);
  const updateSheet = useRef<SheetRef>(null);
  const { listView, checkedItems, checkedCollapsed } = usePrefs();

  const view = useStoreQuery(
    (store) => buildMonthView({ store, month, search, checkedLast: checkedItems !== "stay", checkedApart: checkedItems === "section" }),
    [month, search, checkedItems],
  );
  const groups = useStoreQuery((store) => liveGroups({ store }), []);
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const toggleChecked = useCallback(() => setPrefs({ checkedCollapsed: !checkedCollapsed }), [checkedCollapsed]);
  const months = useStoreQuery((store) => browsableMonths({ store, current }), [current]);
  const rows = useMemo(() => buildRows({ view, listView, groupsById, checkedCollapsed }), [checkedCollapsed, groupsById, listView, view]);
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

  const goToMonth = useCallback((target: MonthKey) => {
    setMonth(target);
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
        household.write((store) => setChecked({ store, itemId: item.id, userId, checked: item.checkedAt === undefined }));
      },
      onHold: () => {
        // Clearing an active search reshuffles the rows, so only pick the row up when none was showing.
        const wasSearching = searchRef.current.trim() !== "";
        startReordering();
        return !wasSearching;
      },
      onDelete: (item) => {
        household.write((store) => deleteItems({ store, itemIds: [item.id] }));
        setUndo({ itemIds: [item.id], message: `Deleted ${item.name}` });
      },
      onEdit: (item) => router.push({ pathname: "/item/[id]", params: { id: item.id } }),
    }),
    [household, startReordering, userId],
  );

  const checkAll = useCallback(
    (row: HeaderRow) => {
      if (!userId) return;
      household.write((store) => setCheckedMany({ store, itemIds: row.itemIds, userId, checked: row.remaining > 0 }));
      haptic(row.remaining > 0 ? "success" : "light");
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

  const undoDelete = () => {
    if (!undo) return;
    const { itemIds } = undo;
    household.write((store) => restoreItems({ store, itemIds }));
    setUndo(undefined);
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
        <SectionHeader row={row} onCheckAll={reorderMode ? undefined : checkAll} onToggleChecked={toggleChecked} />
      ) : (
        <DraggableItem
          item={row.item}
          group={row.group}
          month={month}
          pending={pendingSet.has(`items/${row.item.id}`)}
          handlers={handlers}
          reorderMode={reorderMode}
        />
      ),
    [checkAll, handlers, month, pendingSet, reorderMode, toggleChecked],
  );

  return (
    <Screen edges={["top"]}>
      <ScrollViewContainer
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl enabled={!reorderMode} refreshing={false} onRefresh={household.nudge} tintColor={colors.accent} />}
      >
        <ListTopBar
          onSettings={() => router.push("/settings")}
          onSyncPill={() => (status === "unauthorized" ? updateSession({ password: null }) : household.nudge())}
          onUpdatePill={() => updateSheet.current?.present()}
        />
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
        {reorderMode ? (
          <ReorderHint listView={listView} onDone={() => setReorderMode(false)} />
        ) : view.totalCount > 0 ? (
          <SearchBar month={month} value={search} onChange={setSearch} onView={() => viewSheet.current?.present()} />
        ) : null}

        <View style={styles.rows}>
          {rows.length === 0 ? <EmptyState searching={search.trim() !== ""} /> : null}
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
        </View>
      </ScrollViewContainer>

      {undo ? (
        <UndoSnackbar
          message={undo.message}
          onUndo={undoDelete}
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
  chevronOpen: { transform: [{ rotate: "90deg" }] },
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
  headerInset: { paddingHorizontal: ROW_INSET },
  priorityHeader: { paddingTop: 20, paddingBottom: 8 },
  dropIndicatorInset: { paddingHorizontal: ROW_INSET },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 20,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
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
