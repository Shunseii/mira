import { monthName, monthYear, type Group, type MonthKey } from "@mira/shared";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { GroupChip } from "./GroupBadge";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** One 48pt row of the options table: label on the left, control on the right. */
export const OptionRow = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <View>
        <Text variant="option" color="ink2">
          {label}
        </Text>
        {hint ? (
          <Text variant="tag" color="ink3">
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.control}>{children}</View>
    </View>
  );
};

export const OptionTable = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  return <View style={[styles.table, { borderTopColor: colors.line }]}>{children}</View>;
};

export const parseQuantity = (qty: string | undefined): number | undefined => {
  if (!qty) return undefined;
  const value = Number(qty);
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/** − value + ; the value reads "1" (muted) until someone sets it. */
export const Stepper = ({ value, onChange }: { value: number | undefined; onChange: (value: number | undefined) => void }) => {
  const { colors } = useTheme();
  const shown = value ?? 1;
  return (
    <View style={styles.stepper}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel="Less"
        feedback="select"
        pressScale={0.88}
        disabled={shown <= 1}
        onPress={() => onChange(shown - 1 <= 1 ? undefined : shown - 1)}
        style={[styles.stepButton, { backgroundColor: colors.surface2 }]}
      >
        <Icon name="minus" size={18} color={colors.ink} />
      </Tap>
      <View style={styles.stepValue}>
        <Text variant="bodyStrong" color={value === undefined ? "ink3" : "ink"}>
          {shown}
        </Text>
      </View>
      <Tap
        accessibilityRole="button"
        accessibilityLabel="More"
        feedback="select"
        pressScale={0.88}
        onPress={() => onChange(shown + 1)}
        style={[styles.stepButton, { backgroundColor: colors.surface2 }]}
      >
        <Icon name="plus" size={18} color={colors.ink} />
      </Tap>
    </View>
  );
};

export const GroupValue = ({ group, onPress }: { group: Group | undefined; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`Group: ${group?.name ?? "none"}`} onPress={onPress} pressScale={0.96}>
      {group ? (
        <GroupChip group={group} name={group.name} variant="value" trailing={<Icon name="chevrons-up-down" size={16} color={colors.ink3} />} />
      ) : (
        <View style={styles.plainValue}>
          <Text variant="body" color="ink2">
            No group
          </Text>
          <Icon name="chevrons-up-down" size={16} color={colors.ink3} />
        </View>
      )}
    </Tap>
  );
};

export const MonthValue = ({ month, onPress }: { month: MonthKey; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`List: ${monthName(month)} ${monthYear(month)}`} onPress={onPress} pressScale={0.96}>
      <View style={styles.plainValue}>
        <Text variant="bodyStrong">
          {monthName(month)} {monthYear(month)}
        </Text>
        <Icon name="chevrons-up-down" size={16} color={colors.ink3} />
      </View>
    </Tap>
  );
};

const styles = StyleSheet.create({
  table: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 56, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  control: { flexShrink: 1, alignItems: "flex-end" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stepValue: { width: 56, alignItems: "center" },
  plainValue: { height: 40, flexDirection: "row", alignItems: "center", gap: 6 },
});
