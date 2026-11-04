import { addableMonths, monthName, monthYear, type MonthKey, type MonthOption } from "@mira/shared";
import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { useStoreQuery } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";
import { SquircleFill } from "./Squircle";

const SECTION_TITLES: Record<MonthOption["kind"], string> = {
  next: "Next month",
  current: "This month",
  earlier: "Earlier",
};

export const MonthSheet = forwardRef<
  SheetRef,
  { current: MonthKey; selected: MonthKey; onSelect: (month: MonthKey) => void; title?: string; subtitle?: string }
>(({ current, selected, onSelect, title = "Add to list", subtitle = "Months that had groceries, plus next month." }, ref) => {
  const { colors } = useTheme();
  const options = useStoreQuery((store) => addableMonths({ store, current }), [current]);
  const kinds: MonthOption["kind"][] = ["next", "current", "earlier"];
  return (
    <Sheet ref={ref} title={title} subtitle={subtitle}>
      {kinds.map((kind) => {
        const section = options.filter((option) => option.kind === kind);
        if (section.length === 0) return null;
        return (
          <View key={kind} style={styles.section}>
            <Text variant="eyebrow" color="ink3" style={styles.sectionTitle}>
              {SECTION_TITLES[kind]}
            </Text>
            {section.map((option) => {
              const isSelected = option.month === selected;
              return (
                <Tap
                  key={option.month}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  feedback="select"
                  pressScale={0.98}
                  onPress={() => {
                    onSelect(option.month);
                    if (ref && typeof ref === "object") ref.current?.dismiss();
                  }}
                  style={[styles.row, isSelected ? null : { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  {isSelected ? <SquircleFill radius={12} color={colors.accentSoft} stroke={{ color: colors.accent, width: 1 }} /> : null}
                  <Text variant="body" color={isSelected ? "accent" : "ink"} style={isSelected ? styles.bold : null}>
                    {monthName(option.month)}{" "}
                    <Text variant="body" color={isSelected ? "accent" : "ink3"}>
                      {monthYear(option.month)}
                    </Text>
                  </Text>
                  <View style={styles.right}>
                    <Text variant="caption" color={isSelected ? "accent" : "ink3"}>
                      {option.itemCount === 0 ? "Nothing yet" : `${option.itemCount} item${option.itemCount === 1 ? "" : "s"}`}
                    </Text>
                    {isSelected ? <Icon name="check" size={18} color={colors.accent} /> : null}
                  </View>
                </Tap>
              );
            })}
          </View>
        );
      })}
    </Sheet>
  );
});
MonthSheet.displayName = "MonthSheet";

const styles = StyleSheet.create({
  section: { marginBottom: 14 },
  sectionTitle: { marginBottom: 4 },
  row: { height: 52, paddingHorizontal: 12, marginHorizontal: -12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  bold: { fontFamily: FONTS.bodyBold },
});
