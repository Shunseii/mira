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
import { StyleSheet, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { FormScreen } from "@/components/FormScreen";
import { Icon } from "@/components/Icon";
import { ItemFields } from "@/components/ItemFields";
import { parseQuantity } from "@/components/ItemOptions";
import { NameField } from "@/components/NameField";
import { NavBar } from "@/components/NavBar";
import { Screen } from "@/components/Screen";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { usePref } from "@/data/prefs";
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
  const checkedBy = useStoreQuery(
    (store) => (item?.checkedBy ? readUser({ store, id: item.checkedBy }) : undefined),
    [item?.checkedBy],
  );
  const unitHints = useStoreQuery((store) => suggestUnits({ store, name: draft?.name ?? "" }), [draft?.name]);
  const showUnits = usePref("showUnits");

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
    <FormScreen
      header={
        <NavBar
          back={{ label: monthName(item.listId) }}
          right={
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
          }
        />
      }
      contentContainerStyle={styles.content}
      footer={<Button label="Save" onPress={save} disabled={!draft.name.trim()} />}
    >
      <NameField value={draft.name} onChangeText={(text) => patchDraft({ name: text })} returnKeyType="done" />

      <ItemFields value={draft} onChange={patchDraft} unitSuggestions={unitHints.suggestions} />

      <View style={styles.byLine}>
        <Avatar name={addedBy?.name ?? "?"} seed={item.addedBy} size={32} />
        <View>
          <Text variant="label">Added by {addedBy?.name ?? "someone"}</Text>
          <Text variant="caption" color="ink2">
            {formatDay(item.addedAt)}
          </Text>
        </View>
      </View>

      {item.checkedAt !== undefined && (
        <View style={styles.byLine}>
          <Avatar name={checkedBy?.name ?? "?"} seed={item.checkedBy ?? ""} size={32} />
          <View>
            <Text variant="label">Checked by {checkedBy?.name ?? "someone"}</Text>
            <Text variant="caption" color="ink2">
              {formatDay(item.checkedAt)}
            </Text>
          </View>
        </View>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  missing: { alignItems: "center", justifyContent: "center", gap: 16 },
  trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 22 },
  byLine: { flexDirection: "row", alignItems: "center", gap: 12 },
});
