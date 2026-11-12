import { readGroup, type MonthKey } from "@mira/shared";
import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { GroupSheet } from "@/components/GroupSheet";
import { GroupValue, MonthValue, OptionRow, OptionTable, Stepper } from "@/components/ItemOptions";
import { MonthSheet } from "@/components/MonthSheet";
import type { SheetRef } from "@/components/Sheet";
import { SquircleFill } from "@/components/Squircle";
import { Text } from "@/components/Text";
import { UnitSheet, UnitSuggestions } from "@/components/UnitPicker";
import { useCurrentMonth, useStoreQuery } from "@/data/HouseholdProvider";
import { usePrefs } from "@/data/prefs";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

export type ItemFieldValues = {
  groupId?: string;
  qty?: number;
  unit?: string;
  month: MonthKey;
  note: string;
};

/**
 * Everything about an item below its name: group, quantity, unit, list and note, with their pickers.
 * Add item and the item screen both use it so the two forms can't drift apart.
 */
export const ItemFields = ({
  value,
  onChange,
  unitSuggestions,
}: {
  value: ItemFieldValues;
  /** Called with only the field the person changed. */
  onChange: (patch: Partial<ItemFieldValues>) => void;
  unitSuggestions: string[];
}) => {
  const { colors } = useTheme();
  const current = useCurrentMonth();
  const { showUnits } = usePrefs();
  const group = useStoreQuery((store) => (value.groupId ? readGroup({ store, id: value.groupId }) : undefined), [value.groupId]);
  const liveGroup = group && group.deletedAt === undefined ? group : undefined;
  const groupSheet = useRef<SheetRef>(null);
  const monthSheet = useRef<SheetRef>(null);
  const unitSheet = useRef<SheetRef>(null);

  return (
    <>
      <OptionTable>
        <OptionRow label="Group">
          <GroupValue group={liveGroup} onPress={() => groupSheet.current?.present()} />
        </OptionRow>
        <OptionRow label="Quantity">
          <Stepper value={value.qty} onChange={(qty) => onChange({ qty })} />
        </OptionRow>
        {showUnits ? (
          <OptionRow label="Unit" hint="optional">
            <UnitSuggestions
              suggestions={unitSuggestions}
              selected={value.unit}
              onSelect={(unit) => onChange({ unit })}
              onMore={() => unitSheet.current?.present()}
            />
          </OptionRow>
        ) : null}
        <OptionRow label="List">
          <MonthValue month={value.month} onPress={() => monthSheet.current?.present()} />
        </OptionRow>
      </OptionTable>

      <View style={styles.noteBlock}>
        <Text variant="label" color="ink2">
          Note
        </Text>
        <View>
          <SquircleFill radius={14} color={colors.surface} stroke={{ color: colors.line, width: 1 }} />
          <TextInput
            value={value.note}
            onChangeText={(note) => onChange({ note })}
            multiline
            placeholder="Brand, ripeness, anything that helps"
            placeholderTextColor={colors.ink3}
            selectionColor={colors.accent}
            style={[styles.note, { color: colors.ink }]}
          />
        </View>
      </View>

      <GroupSheet ref={groupSheet} selectedId={liveGroup?.id} onSelect={(groupId) => onChange({ groupId })} />
      <MonthSheet ref={monthSheet} current={current} selected={value.month} onSelect={(month) => onChange({ month })} />
      {showUnits ? <UnitSheet ref={unitSheet} selected={value.unit} onSelect={(unit) => onChange({ unit })} /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  noteBlock: { gap: 8 },
  note: {
    minHeight: 96,
    padding: 15,
    fontFamily: FONTS.body,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
    outlineWidth: 0,
  },
});
