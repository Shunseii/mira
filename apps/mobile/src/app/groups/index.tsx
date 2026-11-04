import { liveGroups, moveGroup, type Group } from "@mira/shared";
import { router } from "expo-router";
import { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import ReorderableList, { useIsActive, useReorderableDrag, type ReorderableListReorderEvent } from "react-native-reorderable-list";
import { Button } from "@/components/Button";
import { GroupBadge, GroupCard, useGroupCardInk } from "@/components/GroupBadge";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { HOLD_MS, PRESS_DELAY_MS, Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { UNDO_MS, UndoSnackbar } from "@/components/UndoSnackbar";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { goBack } from "@/lib/navigation";
import { clearUndo, usePendingUndo } from "@/lib/pendingUndo";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

const describe = (group: Group): string | undefined =>
  !group.icon && !group.color ? "No icon or color" : !group.icon ? "No icon" : !group.color ? "No color" : undefined;

/** Hold anywhere on a card to pick it up and drag it; a plain tap opens Edit group. */
const GroupRow = ({ group, index, count, onMove }: { group: Group; index: number; count: number; onMove: (to: number) => void }) => {
  const drag = useReorderableDrag();
  const active = useIsActive();
  const detail = describe(group);
  const { ink, muted, colored } = useGroupCardInk(group);
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={group.name}
      accessibilityHint="Opens the group. Hold and drag to reorder"
      accessibilityActions={[
        ...(index > 0 ? [{ name: "moveUp", label: "Move up" }] : []),
        ...(index < count - 1 ? [{ name: "moveDown", label: "Move down" }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "moveUp") onMove(index - 1);
        if (event.nativeEvent.actionName === "moveDown") onMove(index + 1);
      }}
      pressScale={0.98}
      delayLongPress={HOLD_MS - PRESS_DELAY_MS}
      onLongPress={() => {
        haptic("medium");
        drag();
      }}
      onPress={() => router.push({ pathname: "/groups/[id]", params: { id: group.id } })}
      style={styles.cardSpacing}
    >
      <GroupCard group={group} style={active ? styles.lifted : null}>
        <GroupBadge group={group} />
        <View style={styles.cardText}>
          <Text variant="body" numberOfLines={1} style={[styles.name, { color: ink }]}>
            {group.name}
          </Text>
          {detail ? (
            <Text variant="tag" style={[colored ? styles.meta : null, { color: muted }]}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-right" size={18} color={muted} />
      </GroupCard>
    </Tap>
  );
};

export default function Groups() {
  const { colors } = useTheme();
  const household = useHousehold();
  const groups = useStoreQuery((store) => liveGroups({ store }), []);
  const insets = useSafeAreaInsets();

  // A group deleted on Edit group comes back here with an undo offer.
  const pendingUndo = usePendingUndo();
  useEffect(() => {
    if (!pendingUndo) return undefined;
    const timer = setTimeout(() => clearUndo(pendingUndo.id), UNDO_MS);
    return () => clearTimeout(timer);
  }, [pendingUndo]);

  const onReorder = useCallback(
    ({ from, to }: ReorderableListReorderEvent) => {
      const moved = groups[from];
      if (!moved || from === to) return;
      household.write((store) => moveGroup({ store, groupId: moved.id, toIndex: to }));
    },
    [groups, household],
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Tap accessibilityRole="button" onPress={() => goBack("/settings")} style={styles.back}>
          <Icon name="chevron-left" size={20} color={colors.accent} />
          <Text variant="bodyStrong" color="accent" style={styles.backLabel}>
            Settings
          </Text>
        </Tap>
        <Text variant="heading">Groups</Text>
        <Text variant="caption" color="ink2">
          Hold and drag to reorder. This is the order groups appear in your list.
        </Text>
      </View>
      <ReorderableList
        data={groups}
        keyExtractor={(group) => group.id}
        renderItem={({ item, index }) => (
          <GroupRow
            group={item}
            index={index}
            count={groups.length}
            onMove={(to) => household.write((store) => moveGroup({ store, groupId: item.id, toIndex: to }))}
          />
        )}
        onDragEnd={() => {
          "worklet";
          scheduleOnRN(haptic, "light");
        }}
        onReorder={onReorder}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text variant="secondary" color="ink2" style={styles.footnote}>
            No groups yet. Groups are optional sections like Produce or Dairy.
          </Text>
        }
      />
      <View style={styles.footer}>
        <Button label="New group" onPress={() => router.push({ pathname: "/groups/[id]", params: { id: "new" } })} />
      </View>
      {pendingUndo ? (
        <UndoSnackbar
          message={pendingUndo.message}
          undoHaptic="light"
          onDismiss={() => clearUndo(pendingUndo.id)}
          bottom={Math.max(insets.bottom, 16) + FOOTER_HEIGHT}
          onUndo={() => {
            pendingUndo.undo();
            clearUndo(pendingUndo.id);
          }}
        />
      ) : null}
    </Screen>
  );
}

/** The New group button and its padding; the undo bar floats just above it. */
const FOOTER_HEIGHT = 76;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, gap: 6, paddingBottom: 12 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8, alignSelf: "flex-start", paddingRight: 12 },
  backLabel: { fontSize: 15 },
  list: { paddingHorizontal: 20 },
  cardSpacing: { paddingBottom: 6 },
  cardText: { flex: 1, gap: 1, paddingVertical: 8 },
  name: { fontFamily: FONTS.bodyMedium, fontSize: 17 },
  meta: { opacity: 0.7 },
  lifted: { shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6, overflow: "visible" },
  footnote: { paddingVertical: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
