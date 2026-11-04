import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { createGroup, liveGroups } from "@mira/shared";
import { router } from "expo-router";
import { forwardRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { GroupBadge, GroupCard, useGroupCardInk, type GroupLook } from "./GroupBadge";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";
import { SquircleFill } from "./Squircle";

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
      onDismiss={() => {
        setCreating(false);
        setNewName("");
      }}
      action={
        <Tap accessibilityRole="button" onPress={editGroups} style={styles.headerAction}>
          <Text variant="bodyStrong" color="accent" style={styles.actionText}>
            Edit groups
          </Text>
        </Tap>
      }
    >
      <View style={styles.list}>
        <Option group={undefined} selected={selectedId === undefined} onPress={() => choose(undefined)} label="No group" muted>
          <View style={[styles.noBadge, { backgroundColor: colors.surface2 }]}>
            <Icon name="ban" size={16} color={colors.ink3} />
          </View>
        </Option>
        {groups.map((group) => (
          <Option key={group.id} group={group} selected={selectedId === group.id} onPress={() => choose(group.id)} label={group.name}>
            <GroupBadge group={group} />
          </Option>
        ))}
        {creating ? (
          <Animated.View entering={FadeIn} style={styles.newRow}>
            <View style={styles.newInputWrap}>
              <SquircleFill radius={14} color={colors.bg} stroke={{ color: colors.line, width: 1 }} />
              <BottomSheetTextInput
                autoFocus
                // Uncontrolled: a controlled sheet input doubles what you type on Android ("loremlorem").
                // The field only exists while creating, so it starts empty each time.
                onChangeText={setNewName}
                placeholder="Group name, e.g. Produce"
                placeholderTextColor={colors.ink3}
                returnKeyType="done"
                onSubmitEditing={create}
                style={[styles.newInput, { color: colors.ink }]}
              />
            </View>
            <Tap accessibilityRole="button" onPress={create} style={styles.newAdd}>
              <SquircleFill radius={14} color={colors.accent} />
              <Text variant="bodyStrong" color="onAccent">
                Add
              </Text>
            </Tap>
          </Animated.View>
        ) : (
          <Tap accessibilityRole="button" onPress={() => setCreating(true)} style={styles.newGroup}>
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

/** One choice, drawn as the group's card from the Groups page so a group looks the same in both places. */
const Option = ({
  group,
  selected,
  onPress,
  label,
  muted,
  children,
}: {
  group: GroupLook;
  selected: boolean;
  onPress: () => void;
  label: string;
  muted?: boolean;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const { colored, ink, muted: mutedInk } = useGroupCardInk(group);
  return (
    <Tap accessibilityRole="radio" accessibilityState={{ selected }} feedback="select" pressScale={0.98} onPress={onPress}>
      <GroupCard group={group}>
        {children}
        <Text
          variant={selected ? "bodyStrong" : "body"}
          numberOfLines={1}
          style={[styles.optionLabel, { color: muted ? mutedInk : ink }]}
        >
          {label}
        </Text>
        {selected ? <Icon name="check" size={20} color={colored ? ink : colors.accent} /> : null}
      </GroupCard>
    </Tap>
  );
};

const styles = StyleSheet.create({
  headerAction: { height: 44, justifyContent: "center" },
  actionText: { fontSize: 15 },
  list: { gap: 6 },
  // Lines its badge up with the cards' badges (card padding + border).
  newGroup: { height: 56, paddingLeft: 12, flexDirection: "row", alignItems: "center", gap: 14 },
  optionLabel: { flex: 1 },
  noBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  newRow: { flexDirection: "row", gap: 8, paddingVertical: 10 },
  newInputWrap: { flex: 1 },
  newInput: { height: 48, paddingHorizontal: 15, fontFamily: FONTS.body, fontSize: 16 },
  newAdd: { height: 48, paddingHorizontal: 18, justifyContent: "center" },
});
