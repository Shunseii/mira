import { liveGroups, moveGroup, type Group } from "@mira/shared";
import { router } from "expo-router";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import ReorderableList, { useIsActive, useReorderableDrag, type ReorderableListReorderEvent } from "react-native-reorderable-list";
import { Button } from "@/components/Button";
import { GroupBadge } from "@/components/GroupBadge";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";

const describe = (group: Group): string | undefined =>
  !group.icon && !group.color ? "No icon or color" : !group.icon ? "No icon" : !group.color ? "No color" : undefined;

const GroupRow = ({ group }: { group: Group }) => {
  const { colors } = useTheme();
  const drag = useReorderableDrag();
  const active = useIsActive();
  const detail = describe(group);
  return (
    <View style={[styles.row, { borderBottomColor: colors.line, backgroundColor: active ? colors.surface : colors.bg }, active ? styles.lifted : null]}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${group.name}`}
        onLongPress={() => {
          haptic("medium");
          drag();
        }}
        onPressIn={() => undefined}
        delayLongPress={120}
        style={styles.grip}
      >
        <Icon name="grip-vertical" size={20} color={colors.ink3} />
      </Tap>
      <Tap
        accessibilityRole="button"
        pressScale={0.99}
        onPress={() => router.push({ pathname: "/groups/[id]", params: { id: group.id } })}
        style={styles.rowBody}
      >
        <GroupBadge group={group} />
        <View style={styles.flex}>
          <Text variant="body">{group.name}</Text>
          {detail ? (
            <Text variant="tag" color="ink3">
              {detail}
            </Text>
          ) : null}
        </View>
        <Icon name="chevron-right" size={18} color={colors.ink3} />
      </Tap>
    </View>
  );
};

export default function Groups() {
  const { colors } = useTheme();
  const household = useHousehold();
  const groups = useStoreQuery((store) => liveGroups({ store }), []);

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
          Shared with everyone in the household. Drag to set the order sections appear in your list.
        </Text>
      </View>
      <ReorderableList
        data={groups}
        keyExtractor={(group) => group.id}
        renderItem={({ item }) => <GroupRow group={item} />}
        onReorder={onReorder}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <Text variant="tag" color="ink3" style={styles.footnote}>
            Items without a group always sit at the top of the list.
          </Text>
        }
        ListEmptyComponent={
          <Text variant="secondary" color="ink2" style={styles.footnote}>
            No groups yet. Groups are optional sections like Produce or Dairy.
          </Text>
        }
      />
      <View style={styles.footer}>
        <Button label="New group" onPress={() => router.push({ pathname: "/groups/[id]", params: { id: "new" } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, gap: 6, paddingBottom: 12 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8, alignSelf: "flex-start", paddingRight: 12 },
  backLabel: { fontSize: 15 },
  list: { paddingHorizontal: 20 },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56 },
  lifted: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4, borderRadius: 12 },
  grip: { width: 44, height: 56, alignItems: "center", justifyContent: "center", marginLeft: -12 },
  rowBody: { flex: 1, minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  footnote: { paddingVertical: 14 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
