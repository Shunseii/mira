import { createGroup, deleteGroup, readGroup, updateGroup } from "@mira/shared";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { ColorSwatches, CustomColorSheet, type Appearance } from "@/components/ColorPicker";
import { GroupChip, useGroupTone } from "@/components/GroupBadge";
import { GroupIconPicker } from "@/components/GroupIconPicker";
import type { SheetRef } from "@/components/Sheet";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";

export default function EditGroup() {
  const { colors } = useTheme();
  const household = useHousehold();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const existing = useStoreQuery((store) => (isNew ? undefined : readGroup({ store, id })), [id, isNew]);
  const [name, setName] = useState(existing?.name ?? "");
  // Raw stored key, so an icon from a newer build survives an edit here.
  const [icon, setIcon] = useState<string | undefined>(existing?.icon);
  const [appearance, setAppearance] = useState<Appearance>({ color: existing?.color, color2: existing?.color2 });
  const tone = useGroupTone({ ...appearance, icon });
  const customSheet = useRef<SheetRef>(null);

  const save = () => {
    if (!name.trim()) return;
    household.write((store) => {
      if (isNew) createGroup({ store, group: { name, icon, ...appearance } });
      else updateGroup({ store, groupId: id, patch: { name, icon: icon ?? null, appearance } });
    });
    haptic("success");
    goBack("/groups");
  };

  const remove = () => {
    household.write((store) => deleteGroup({ store, groupId: id }));
    haptic("medium");
    goBack("/groups");
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.nav}>
          <Tap accessibilityRole="button" onPress={() => goBack("/groups")} style={styles.back}>
            <Icon name="chevron-left" size={20} color={colors.accent} />
            <Text variant="bodyStrong" color="accent" style={styles.backLabel}>
              Groups
            </Text>
          </Tap>
          {isNew ? null : (
            <Tap accessibilityRole="button" accessibilityLabel="Delete group" onPress={remove} style={styles.trash}>
              <Icon name="trash-2" size={20} color={colors.ink2} />
            </Tap>
          )}
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text variant="heading">{isNew ? "New group" : "Edit group"}</Text>
          <View style={styles.previewBlock}>
            <Text variant="tag" color="ink2">
              How it looks in your list
            </Text>
            <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <GroupChip group={{ icon, ...appearance }} name={name.trim() || "Group"} />
            </View>
          </View>

          <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Produce" autoFocus={isNew} autoCapitalize="words" returnKeyType="done" />

          <View style={styles.block}>
            <Text variant="label" color="ink2">
              Icon{" "}
              <Text variant="tag" color="ink3">
                optional
              </Text>
            </Text>
            <GroupIconPicker value={icon} tone={tone} onChange={setIcon} />
          </View>

          <View style={styles.block}>
            <Text variant="label" color="ink2">
              Color{" "}
              <Text variant="tag" color="ink3">
                optional
              </Text>
            </Text>
            <ColorSwatches value={appearance} onChange={setAppearance} onCustom={() => customSheet.current?.present()} />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button label={isNew ? "Create group" : "Save group"} onPress={save} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
      <CustomColorSheet ref={customSheet} initial={appearance.color2 ? undefined : appearance.color} name={name} icon={icon} onPick={(color) => setAppearance({ color })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, paddingRight: 12 },
  backLabel: { fontSize: 15 },
  trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
  previewBlock: { gap: 8 },
  preview: { borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "flex-start" },
  block: { gap: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
