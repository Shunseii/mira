import { createGroup, deleteGroup, readGroup, restoreGroup, updateGroup } from "@mira/shared";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button } from "@/components/Button";
import { ColorRow, CustomColorSheet, type Appearance } from "@/components/ColorPicker";
import { GroupTintBadge, useGroupTone } from "@/components/GroupBadge";
import { GroupIconPicker } from "@/components/GroupIconPicker";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import type { SheetRef } from "@/components/Sheet";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { goBack } from "@/lib/navigation";
import { offerUndo } from "@/lib/pendingUndo";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { SquircleFill } from "@/components/Squircle";

const SectionLabel = ({ label }: { label: string }) => (
  <Text variant="label" color="ink2">
    {label}{" "}
    <Text variant="tag" color="ink3">
      optional
    </Text>
  </Text>
);

export default function EditGroup() {
  const { colors } = useTheme();
  const household = useHousehold();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const existing = useStoreQuery((store) => (isNew ? undefined : readGroup({ store, id })), [id, isNew]);

  // The icon grid fills in once the screen has slid in; drawing ~100 icons during the slide stalls it.
  const navigation = useNavigation();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const settle = () => setSettled(true);
    const unsubscribe = navigation.addListener("transitionEnd" as never, settle);
    const fallback = setTimeout(settle, SETTLE_FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);
  const [name, setName] = useState(existing?.name ?? "");
  // Raw stored key, so an icon from a newer build survives an edit here.
  const [icon, setIcon] = useState<string | undefined>(existing?.icon);
  const [appearance, setAppearance] = useState<Appearance>({ color: existing?.color, color2: existing?.color2 });
  const [nameFocused, setNameFocused] = useState(false);
  const [searchingIcons, setSearchingIcons] = useState(false);
  const look = { ...appearance, icon };
  const tone = useGroupTone(look);
  const customSheet = useRef<SheetRef>(null);
  const openCustom = useCallback(() => customSheet.current?.present(), []);

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
    let ungrouped: string[] = [];
    household.write((store) => {
      ungrouped = deleteGroup({ store, groupId: id });
    });
    haptic("medium");
    offerUndo({
      message: `Deleted ${existing?.name ?? "group"}`,
      undo: () => household.write((store) => restoreGroup({ store, groupId: id, itemIds: ungrouped })),
    });
    goBack("/groups");
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <Text variant="display">{isNew ? "New group" : "Edit group"}</Text>

          <View style={styles.block}>
            <Text variant="label" color="ink2">
              Name
            </Text>
            <View style={styles.nameField}>
              <SquircleFill radius={14} color={colors.surface} stroke={{ color: nameFocused ? colors.accent : colors.line, width: 1 }} />
              <GroupTintBadge group={look} />
              <TextInput
                // Uncontrolled: a controlled value races the keyboard on Android while the screen re-renders.
                defaultValue={existing?.name}
                onChangeText={setName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="e.g. Produce"
                placeholderTextColor={colors.ink3}
                selectionColor={colors.accent}
                autoFocus={isNew}
                autoCapitalize="words"
                returnKeyType="done"
                accessibilityLabel="Group name"
                style={[styles.nameInput, { color: colors.ink }]}
              />
            </View>
          </View>

          <View style={styles.block}>
            <SectionLabel label="Icon" />
            <GroupIconPicker
              value={icon}
              tone={tone}
              onChange={setIcon}
              onSearchFocusChange={setSearchingIcons}
              scrollable={false}
              iconsReady={settled}
            />
          </View>

          <View style={styles.block}>
            <SectionLabel label="Color" />
            <ColorRow value={appearance} onChange={setAppearance} onCustom={openCustom} />
            <Text variant="tag" color="ink3">
              Shades adjust automatically so text stays readable
            </Text>
          </View>
        </KeyboardAwareScrollView>

        {/* Save stays put under the scrolling page; it steps aside while the icon search has the keyboard. */}
        {searchingIcons ? null : (
          <View style={[styles.footer, { borderTopColor: colors.line, backgroundColor: colors.bg }]}>
            <Button label={isNew ? "Create group" : "Save group"} onPress={save} disabled={!name.trim()} />
          </View>
        )}
      </KeyboardAvoidingView>
      <CustomColorSheet
        ref={customSheet}
        initial={appearance.color2 ? undefined : appearance.color}
        name={name.trim()}
        icon={icon}
        onPick={(color) => setAppearance({ color })}
      />
    </Screen>
  );
}

/** In case the transition-end event never comes (e.g. no animation). */
const SETTLE_FALLBACK_MS = 600;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 24, gap: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: -10 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8, paddingRight: 8 },
  backLabel: { fontSize: 15 },
  trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  block: { gap: 10 },
  nameField: { height: 56, paddingLeft: 11, paddingRight: 17, flexDirection: "row", alignItems: "center", gap: 12 },
  nameInput: { flex: 1, height: "100%", fontFamily: FONTS.body, fontSize: 17, outlineWidth: 0 },
});
