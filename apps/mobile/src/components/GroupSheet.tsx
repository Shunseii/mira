import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { createGroup, liveGroups, type Group } from "@mira/shared";
import { router } from "expo-router";
import { forwardRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { GroupBadge, useGroupTone } from "./GroupBadge";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";

type GroupSheetProps = {
  selectedId: string | undefined;
  onSelect: (groupId: string | undefined) => void;
};

export const GroupSheet = forwardRef<SheetRef, GroupSheetProps>(({ selectedId, onSelect }, ref) => {
  const { colors } = useTheme();
  const household = useHousehold();
  const groups = useStoreQuery((store) => liveGroups({ store }), []);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const choose = (groupId: string | undefined) => {
    onSelect(groupId);
    if (ref && typeof ref === "object") ref.current?.dismiss();
  };

  const create = () => {
    if (!newName.trim()) return;
    let groupId = "";
    household.write((store) => {
      groupId = createGroup({ store, group: { name: newName } });
    });
    setNewName("");
    setCreating(false);
    choose(groupId);
  };

  const editGroups = () => {
    if (ref && typeof ref === "object") ref.current?.dismiss();
    router.push("/groups");
  };

  return (
    <Sheet
      ref={ref}
      title="Group"
      onDismiss={() => setCreating(false)}
      action={
        <Tap accessibilityRole="button" onPress={editGroups} style={styles.headerAction}>
          <Text variant="bodyStrong" color="accent" style={styles.actionText}>
            Edit groups
          </Text>
        </Tap>
      }
    >
      <View style={[styles.list, { borderTopColor: colors.line }]}>
        <Option selected={selectedId === undefined} onPress={() => choose(undefined)} label="No group" muted>
          <View style={[styles.noBadge, { backgroundColor: colors.surface2 }]}>
            <Icon name="ban" size={16} color={colors.ink3} />
          </View>
        </Option>
        {groups.map((group) => (
          <GroupOption key={group.id} group={group} selected={selectedId === group.id} onPress={() => choose(group.id)} />
        ))}
        {creating ? (
          <Animated.View entering={FadeIn} style={styles.newRow}>
            <BottomSheetTextInput
              autoFocus
              value={newName}
              onChangeText={setNewName}
              placeholder="Group name, e.g. Produce"
              placeholderTextColor={colors.ink3}
              returnKeyType="done"
              onSubmitEditing={create}
              style={[styles.newInput, { color: colors.ink, borderColor: colors.line, backgroundColor: colors.bg }]}
            />
            <Tap accessibilityRole="button" onPress={create} style={[styles.newAdd, { backgroundColor: colors.accent }]}>
              <Text variant="bodyStrong" color="onAccent">
                Add
              </Text>
            </Tap>
          </Animated.View>
        ) : (
          <Tap accessibilityRole="button" onPress={() => setCreating(true)} style={styles.option}>
            <View style={[styles.noBadge, { borderWidth: 1.5, borderColor: colors.accent }]}>
              <Icon name="plus" size={16} color={colors.accent} />
            </View>
            <Text variant="bodyStrong" color="accent">
              New group
            </Text>
          </Tap>
        )}
      </View>
    </Sheet>
  );
});
GroupSheet.displayName = "GroupSheet";

const GroupOption = ({ group, selected, onPress }: { group: Group; selected: boolean; onPress: () => void }) => {
  const tone = useGroupTone(group);
  return (
    <Option selected={selected} onPress={onPress} label={group.name} selectedColor={group.color ? tone.text : undefined}>
      <GroupBadge group={group} />
    </Option>
  );
};

const Option = ({
  selected,
  onPress,
  label,
  muted,
  selectedColor,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  muted?: boolean;
  selectedColor?: string;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const tone = selected && selectedColor ? selectedColor : undefined;
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      feedback="select"
      pressScale={0.98}
      onPress={onPress}
      style={[styles.option, { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
    >
      {children}
      <Text
        variant={selected ? "bodyStrong" : "body"}
        color={muted ? "ink2" : "ink"}
        style={[styles.optionLabel, tone ? { color: tone } : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? <Icon name="check" size={20} color={tone ?? colors.accent} /> : null}
    </Tap>
  );
};

const styles = StyleSheet.create({
  headerAction: { height: 44, justifyContent: "center" },
  actionText: { fontSize: 15 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  option: { height: 52, flexDirection: "row", alignItems: "center", gap: 14 },
  optionLabel: { flex: 1 },
  noBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  newRow: { flexDirection: "row", gap: 8, paddingVertical: 10 },
  newInput: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontFamily: FONTS.body, fontSize: 16 },
  newAdd: { height: 48, borderRadius: 14, paddingHorizontal: 18, justifyContent: "center" },
});
