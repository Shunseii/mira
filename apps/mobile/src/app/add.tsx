import {
  addItem,
  isMonthKey,
  lastItemNamed,
  monthName,
  monthShortName,
  readGroup,
  suggestUnits,
  usuals,
  type MonthKey,
  type Usual,
} from "@mira/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { Button, IconButton } from "@/components/Button";
import { GroupSheet } from "@/components/GroupSheet";
import { GroupValue, MonthValue, OptionRow, OptionTable, Stepper } from "@/components/ItemOptions";
import { MonthSheet } from "@/components/MonthSheet";
import { Screen } from "@/components/Screen";
import type { SheetRef } from "@/components/Sheet";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { UnitSheet, UnitSuggestions } from "@/components/UnitPicker";
import { useCurrentMonth, useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { useSession } from "@/data/session";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

const UsualChip = ({ usual, onPress }: { usual: Usual; onPress: () => void }) => {
  const { colors } = useTheme();
  const quantity = [usual.qty, usual.unit].filter(Boolean).join(" ");
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`Use ${usual.name}`} feedback="select" pressScale={0.94} onPress={onPress} style={[styles.usual, { backgroundColor: colors.surface2 }]}>
      <Text variant="secondary" style={{ fontFamily: FONTS.bodyMedium }}>
        {usual.name}
      </Text>
      {quantity ? (
        <Text variant="caption" color="ink2">
          {quantity}
        </Text>
      ) : null}
    </Tap>
  );
};

export default function AddItem() {
  const { colors } = useTheme();
  const household = useHousehold();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const params = useLocalSearchParams<{ month?: string }>();
  const [month, setMonth] = useState<MonthKey>(params.month && isMonthKey(params.month) ? params.month : current);
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number | undefined>();
  const [unit, setUnit] = useState<string | undefined>();
  const [unitTouched, setUnitTouched] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>();
  const [groupTouched, setGroupTouched] = useState(false);
  const [justAdded, setJustAdded] = useState<string>();
  const nameRef = useRef<TextInput>(null);
  const groupSheet = useRef<SheetRef>(null);
  const monthSheet = useRef<SheetRef>(null);
  const unitSheet = useRef<SheetRef>(null);

  const chips = useStoreQuery((store) => usuals({ store, month, query: name, limit: 8 }), [month, name]);
  const unitHints = useStoreQuery((store) => suggestUnits({ store, name }), [name]);
  const remembered = useStoreQuery((store) => lastItemNamed({ store, name }), [name]);
  const group = useStoreQuery((store) => (groupId ? readGroup({ store, id: groupId }) : undefined), [groupId]);

  // Typing a name you've bought before brings back its unit and group, unless you've picked them.
  useEffect(() => {
    if (!unitTouched) setUnit(unitHints.remembered);
    if (!groupTouched) setGroupId(remembered?.groupId);
  }, [unitHints.remembered, remembered?.groupId, unitTouched, groupTouched]);

  const reset = () => {
    setName("");
    setQty(undefined);
    setUnit(undefined);
    setUnitTouched(false);
    setGroupId(undefined);
    setGroupTouched(false);
  };

  const add = ({ andClose }: { andClose: boolean }) => {
    const trimmed = name.trim();
    if (!trimmed || !userId) {
      nameRef.current?.focus();
      return;
    }
    household.write((store) =>
      addItem({
        store,
        month,
        userId,
        item: { name: trimmed, qty: qty === undefined ? undefined : String(qty), unit, groupId: group && !group.deletedAt ? groupId : undefined },
      }),
    );
    haptic("success");
    if (andClose) {
      goBack();
      return;
    }
    setJustAdded(trimmed);
    reset();
    nameRef.current?.focus();
  };

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(undefined), 1600);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const useUsual = (usual: Usual) => {
    setName(usual.name);
    setQty(usual.qty && Number(usual.qty) > 0 ? Number(usual.qty) : undefined);
    setUnit(usual.unit);
    setUnitTouched(true);
    setGroupId(usual.groupId);
    setGroupTouched(true);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.nav}>
          <IconButton icon="arrow-left" label="Back" onPress={() => goBack()} />
          <Text variant="title">Add item</Text>
          <View style={styles.navSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Tap accessibilityRole="none" pressScale={1} onPress={() => nameRef.current?.focus()} style={[styles.hero, { backgroundColor: colors.accentSoft }]}>
            <Text variant="label" color="accent">
              Item name
            </Text>
            <TextInput
              ref={nameRef}
              autoFocus
              value={name}
              onChangeText={setName}
              placeholder="What do you need?"
              placeholderTextColor={colors.ink3}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              returnKeyType="done"
              submitBehavior="submit"
              onSubmitEditing={() => add({ andClose: false })}
              autoCapitalize="sentences"
              style={[styles.heroInput, { color: colors.ink }]}
            />
            {justAdded ? (
              <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut} style={styles.added}>
                <Text variant="caption" color="accent">
                  Added {justAdded} to {monthShortName(month)} ✓
                </Text>
              </Animated.View>
            ) : null}
          </Tap>

          {chips.length > 0 ? (
            <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.usuals}>
              <Text variant="label" color="ink2">
                Your usuals
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.usualRow}>
                {chips.map((usual) => (
                  <UsualChip key={usual.name} usual={usual} onPress={() => useUsual(usual)} />
                ))}
              </ScrollView>
            </Animated.View>
          ) : null}

          <OptionTable>
            <OptionRow label="Quantity">
              <Stepper value={qty} onChange={setQty} />
            </OptionRow>
            <OptionRow label="Unit" hint="optional">
              <UnitSuggestions
                suggestions={unitHints.suggestions}
                selected={unit}
                onSelect={(next) => {
                  setUnit(next);
                  setUnitTouched(true);
                }}
                onMore={() => unitSheet.current?.present()}
              />
            </OptionRow>
            <OptionRow label="Group">
              <GroupValue group={group && !group.deletedAt ? group : undefined} onPress={() => groupSheet.current?.present()} />
            </OptionRow>
            <OptionRow label="List">
              <MonthValue month={month} onPress={() => monthSheet.current?.present()} />
            </OptionRow>
          </OptionTable>
        </ScrollView>

        <View style={styles.footer}>
          <Button label={`Add to ${monthName(month)}`} onPress={() => add({ andClose: true })} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>

      <GroupSheet
        ref={groupSheet}
        selectedId={groupId}
        onSelect={(next) => {
          setGroupId(next);
          setGroupTouched(true);
        }}
      />
      <MonthSheet ref={monthSheet} current={current} selected={month} onSelect={setMonth} />
      <UnitSheet
        ref={unitSheet}
        selected={unit}
        onSelect={(next) => {
          setUnit(next);
          setUnitTouched(true);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 4 },
  navSpacer: { width: 44 },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, gap: 18 },
  hero: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  heroInput: { fontFamily: FONTS.displayBold, fontSize: 36, lineHeight: 44, minHeight: 48, padding: 0, outlineWidth: 0 },
  added: { paddingTop: 4 },
  usuals: { gap: 10 },
  usualRow: { gap: 8, paddingRight: 20 },
  usual: { height: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
