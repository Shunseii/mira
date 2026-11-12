import {
  deleteItem,
  monthName,
  moveItemToMonth,
  readItem,
  readUser,
  suggestUnits,
  updateItem,
  type Item,
  type MonthKey,
} from "@mira/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { ItemFields } from "@/components/ItemFields";
import { parseQuantity } from "@/components/ItemOptions";
import { NameField } from "@/components/NameField";
import { Screen } from "@/components/Screen";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { usePrefs } from "@/data/prefs";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";

const formatDay = (at: number): string => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(at);

type Draft = { name: string; qty?: number; unit?: string; groupId?: string; month: MonthKey; note: string };

const draftOf = (item: Item): Draft => ({
  name: item.name,
  qty: parseQuantity(item.qty),
  unit: item.unit,
  groupId: item.groupId,
  month: item.listId,
  note: item.note ?? "",
});

export default function ItemDetail() {
  const { colors } = useTheme();
  const household = useHousehold();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStoreQuery((store) => readItem({ store, id }), [id]);
  // Edits stay in this draft until Save; Back discards them.
  const [draft, setDraft] = useState<Draft | undefined>(() => (item ? draftOf(item) : undefined));
  useEffect(() => {
    if (!draft && item) setDraft(draftOf(item));
  }, [draft, item]);
  const patchDraft = (patch: Partial<Draft>) => setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
  const addedBy = useStoreQuery((store) => (item ? readUser({ store, id: item.addedBy }) : undefined), [item?.addedBy]);
  const unitHints = useStoreQuery((store) => suggestUnits({ store, name: draft?.name ?? "" }), [draft?.name]);
  const { showUnits } = usePrefs();

  if (!item || item.deletedAt !== undefined || !draft) {
    return (
      <Screen style={styles.missing}>
        <Text variant="title">This item is gone</Text>
        <Button label="Back to the list" compact onPress={() => goBack()} />
      </Screen>
    );
  }

  const save = () => {
    if (!draft.name.trim()) return;
    household.write((store) => {
      updateItem({
        store,
        itemId: item.id,
        patch: {
          name: draft.name,
          qty: draft.qty === undefined ? null : String(draft.qty),
          // With units hidden, leave the stored unit alone so it's still there when they're turned back on.
          unit: showUnits ? (draft.unit ?? null) : undefined,
          groupId: draft.groupId ?? null,
          note: draft.note,
        },
      });
      if (draft.month !== item.listId) moveItemToMonth({ store, itemId: item.id, month: draft.month });
    });
    haptic("success");
    goBack();
  };

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
          <NameField value={draft.name} onChangeText={(text) => patchDraft({ name: text })} returnKeyType="done" />

          <ItemFields value={draft} onChange={patchDraft} unitSuggestions={unitHints.suggestions} />

          <View style={styles.addedBy}>
            <Avatar name={addedBy?.name ?? "?"} seed={item.addedBy} size={32} />
            <View>
              <Text variant="label">Added by {addedBy?.name ?? "someone"}</Text>
              <Text variant="caption" color="ink2">
                {formatDay(item.addedAt)}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Save" onPress={save} disabled={!draft.name.trim()} />
        </View>
      </KeyboardAvoidingView>

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
  addedBy: { flexDirection: "row", alignItems: "center", gap: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
