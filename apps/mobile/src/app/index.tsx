import {
  addMonths,
  browsableRange,
  buildMonthView,
  carriedSince,
  compareMonthKeys,
  monthName,
  setChecked,
  type Item,
  type MonthKey,
} from "@mira/shared";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GroupChip } from "@/components/GroupBadge";
import { Icon } from "@/components/Icon";
import { ItemRow } from "@/components/ItemRow";
import { ListHeader } from "@/components/ListHeader";
import { Screen } from "@/components/Screen";
import { Tap } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useCurrentMonth, useHousehold, useHouseholdState, useStoreQuery } from "@/data/HouseholdProvider";
import { updateSession, useSession } from "@/data/session";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

const ROW_LAYOUT = LinearTransition.springify().damping(22).stiffness(220);

type Row =
  | { kind: "header"; key: string; title: string; count: number; group?: Parameters<typeof GroupChip>[0]["group"] }
  | { kind: "item"; key: string; item: Item };

const SearchBar = ({ month, value, onChange }: { month: MonthKey; value: string; onChange: (text: string) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: colors.surface2 }]}>
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
  );
};

const EmptyState = ({ searching }: { searching: boolean }) => {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn.delay(80)} style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={searching ? "search" : "shopping-basket"} size={32} color={colors.ink2} />
      </View>
      <Text variant="title">{searching ? "Nothing matches" : "Nothing on the list yet"}</Text>
      {searching ? null : (
        <Text variant="secondary" color="ink2" style={styles.emptyBody}>
          Tap + to add the first thing you need this month.
        </Text>
      )}
    </Animated.View>
  );
};

export default function ListScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const household = useHousehold();
  const { pending, status } = useHouseholdState();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const [month, setMonth] = useState<MonthKey>(current);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [search, setSearch] = useState("");

  const view = useStoreQuery((store) => buildMonthView({ store, month, search }), [month, search]);
  const range = useStoreQuery((store) => browsableRange({ store, current }), [current]);
  const pendingSet = useMemo(() => new Set(pending), [pending]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const section of view.sections) {
      if (section.group) {
        out.push({ kind: "header", key: `h-${section.key}`, title: section.group.name, count: section.items.length, group: section.group });
      }
      for (const item of section.items) out.push({ kind: "item", key: item.id, item });
    }
    if (view.basket.length > 0) {
      out.push({ kind: "header", key: "h-basket", title: "In the basket", count: view.basket.length });
      for (const item of view.basket) out.push({ kind: "item", key: item.id, item });
    }
    return out;
  }, [view]);

  const goTo = (next: MonthKey) => {
    setDirection(compareMonthKeys(next, month) > 0 ? 1 : -1);
    setMonth(next);
    setSearch("");
  };

  const toggle = useCallback(
    (item: Item) => {
      if (!userId) return;
      household.write((store) => setChecked({ store, itemId: item.id, userId, checked: item.checkedAt === undefined }));
    },
    [household, userId],
  );
  const open = useCallback((item: Item) => router.push({ pathname: "/item/[id]", params: { id: item.id } }), []);

  return (
    <Screen edges={["top"]}>
      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={false} onRefresh={household.nudge} tintColor={colors.accent} />}
      >
        <ListHeader
          month={month}
          direction={direction}
          canGoBack={compareMonthKeys(month, range.first) > 0}
          canGoForward={compareMonthKeys(month, range.last) < 0}
          onPrevious={() => goTo(addMonths(month, -1))}
          onNext={() => goTo(addMonths(month, 1))}
          onSettings={() => router.push("/settings")}
          onSyncPill={() => (status === "unauthorized" ? updateSession({ password: null }) : household.nudge())}
        />
        {view.totalCount > 0 ? <SearchBar month={month} value={search} onChange={setSearch} /> : null}

        <View key={month} style={styles.rows}>
          {rows.length === 0 ? <EmptyState searching={search.trim() !== ""} /> : null}
          {rows.map((row) =>
            row.kind === "header" ? (
              <Animated.View key={row.key} layout={ROW_LAYOUT} entering={FadeIn} exiting={FadeOut} style={[styles.groupHeader, { borderBottomColor: colors.line }]}>
                {row.group ? (
                  <GroupChip group={row.group} name={row.title} />
                ) : (
                  <Text variant="eyebrow" color="ink2">
                    {row.title}
                  </Text>
                )}
                <Text variant="tag" color="ink3">
                  {row.count}
                </Text>
              </Animated.View>
            ) : (
              <Animated.View key={row.key} layout={ROW_LAYOUT} entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                <ItemRow
                  item={row.item}
                  since={carriedSince({ item: row.item, month })}
                  pending={pendingSet.has(`items/${row.item.id}`)}
                  onToggle={toggle}
                  onOpen={open}
                />
              </Animated.View>
            ),
          )}
        </View>
      </Animated.ScrollView>

      <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={`Add item to ${monthName(month)}`}
          feedback="light"
          pressScale={0.92}
          onPress={() => router.push({ pathname: "/add", params: { month } })}
          style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
        >
          <Icon name="plus" size={28} color={colors.onAccent} />
        </Tap>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8 },
  search: { height: 44, borderRadius: 14, paddingLeft: 14, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 6 },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 16, height: "100%", outlineWidth: 0 },
  clear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  rows: { paddingTop: 4 },
  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 20, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: "center", gap: 10, paddingTop: 96, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyBody: { textAlign: "center" },
  dock: { position: "absolute", right: 20, bottom: 0 },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
