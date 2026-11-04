import {
  carriedSince,
  deleteItem,
  monthKeyOf,
  monthName,
  moveItemToMonth,
  readGroup,
  readItem,
  readUser,
  setChecked,
  suggestUnits,
  updateItem,
} from "@mira/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { GroupValue, MonthValue, OptionRow, OptionTable, Stepper, parseQuantity } from "@/components/ItemOptions";
import { GroupSheet } from "@/components/GroupSheet";
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

const formatDay = (at: number): string => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(at);

export default function ItemDetail() {
  const { colors } = useTheme();
  const household = useHousehold();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStoreQuery((store) => readItem({ store, id }), [id]);
  const group = useStoreQuery((store) => (item?.groupId ? readGroup({ store, id: item.groupId }) : undefined), [item?.groupId]);
  const addedBy = useStoreQuery((store) => (item ? readUser({ store, id: item.addedBy }) : undefined), [item?.addedBy]);
  const unitHints = useStoreQuery((store) => suggestUnits({ store, name: item?.name ?? "" }), [item?.name]);
  const [name, setName] = useState(item?.name ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const groupSheet = useRef<SheetRef>(null);
  const monthSheet = useRef<SheetRef>(null);
  const unitSheet = useRef<SheetRef>(null);

  useEffect(() => setName(item?.name ?? ""), [item?.name]);
  useEffect(() => setNote(item?.note ?? ""), [item?.note]);

  if (!item || item.deletedAt !== undefined) {
    return (
      <Screen style={styles.missing}>
        <Text variant="title">This item is gone</Text>
        <Button label="Back to the list" compact onPress={() => goBack()} />
      </Screen>
    );
  }

  const liveGroup = group && group.deletedAt === undefined ? group : undefined;
  const since = carriedSince({ item, month: item.listId });
  const checked = item.checkedAt !== undefined;
  const commitName = () => name.trim() && name.trim() !== item.name && household.write((store) => updateItem({ store, itemId: item.id, patch: { name } }));
  const commitNote = () => note.trim() !== (item.note ?? "") && household.write((store) => updateItem({ store, itemId: item.id, patch: { note } }));

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <View style={styles.nav}>
          <Tap accessibilityRole="button" onPress={() => goBack()} style={styles.back}>
            <Icon name="chevron-left" size={20} color={colors.accent} />
            <Text variant="bodyStrong" color="accent" style={styles.backLabel}>
              {monthName(item.listId)}
            </Text>
          </Tap>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Delete item"
            feedback="medium"
            onPress={() => {
              household.write((store) => deleteItem({ store, itemId: item.id }));
              goBack();
            }}
            style={styles.trash}
          >
            <Icon name="trash-2" size={20} color={colors.ink2} />
          </Tap>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.titleBlock}>
            {liveGroup ? (
              <Text variant="eyebrow" color="ink2">
                {liveGroup.name}
              </Text>
            ) : null}
            <View style={styles.titleRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={commitName}
                onSubmitEditing={commitName}
                returnKeyType="done"
                selectionColor={colors.accent}
                style={[styles.titleInput, { color: colors.ink }]}
              />
              {since ? (
                <View style={[styles.tag, { backgroundColor: colors.surface2 }]}>
                  <Text variant="tag" color="ink2">
                    since {since}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <OptionTable>
            <OptionRow label="Quantity">
              <Stepper
                value={parseQuantity(item.qty)}
                onChange={(next) => household.write((store) => updateItem({ store, itemId: item.id, patch: { qty: next === undefined ? null : String(next) } }))}
              />
            </OptionRow>
            <OptionRow label="Unit" hint="optional">
              <UnitSuggestions
                suggestions={unitHints.suggestions}
                selected={item.unit}
                onSelect={(unit) => household.write((store) => updateItem({ store, itemId: item.id, patch: { unit: unit ?? null } }))}
                onMore={() => unitSheet.current?.present()}
              />
            </OptionRow>
            <OptionRow label="Group">
              <GroupValue group={liveGroup} onPress={() => groupSheet.current?.present()} />
            </OptionRow>
            <OptionRow label="List">
              <MonthValue month={item.listId} onPress={() => monthSheet.current?.present()} />
            </OptionRow>
          </OptionTable>

          <View style={styles.noteBlock}>
            <Text variant="label" color="ink2">
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              onBlur={commitNote}
              multiline
              placeholder="Brand, ripeness, anything that helps"
              placeholderTextColor={colors.ink3}
              selectionColor={colors.accent}
              style={[styles.note, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line }]}
            />
          </View>

          <View style={styles.addedBy}>
            <Avatar name={addedBy?.name ?? "?"} seed={item.addedBy} size={32} />
            <View>
              <Text variant="label">Added by {addedBy?.name ?? "someone"}</Text>
              <Text variant="caption" color="ink2">
                {formatDay(item.addedAt)}
                {since ? ` · carried over from ${monthName(monthKeyOf(new Date(item.addedAt)))}` : ""}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={checked ? "Put back on the list" : "Mark as got"}
            kind={checked ? "soft" : "primary"}
            onPress={() => {
              if (!userId) return;
              haptic(checked ? "light" : "success");
              household.write((store) => setChecked({ store, itemId: item.id, userId, checked: !checked }));
              goBack();
            }}
          />
        </View>
      </KeyboardAvoidingView>

      <GroupSheet ref={groupSheet} selectedId={liveGroup?.id} onSelect={(groupId) => household.write((store) => updateItem({ store, itemId: item.id, patch: { groupId: groupId ?? null } }))} />
      <MonthSheet ref={monthSheet} current={current} selected={item.listId} onSelect={(month) => household.write((store) => moveItemToMonth({ store, itemId: item.id, month }))} />
      <UnitSheet ref={unitSheet} selected={item.unit} onSelect={(unit) => household.write((store) => updateItem({ store, itemId: item.id, patch: { unit: unit ?? null } }))} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { alignItems: "center", justifyContent: "center", gap: 16 },
  nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 4 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, paddingRight: 12 },
  backLabel: { fontSize: 15 },
  trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 22 },
  titleBlock: { gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleInput: { flexShrink: 1, fontFamily: FONTS.displayBold, fontSize: 30, lineHeight: 38, padding: 0, outlineWidth: 0 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  noteBlock: { gap: 8 },
  note: { minHeight: 96, borderRadius: 14, borderWidth: 1, padding: 14, fontFamily: FONTS.body, fontSize: 16, lineHeight: 22, textAlignVertical: "top", outlineWidth: 0 },
  addedBy: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
