import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import type { ListView } from "@/data/prefs";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { SquircleFill } from "./Squircle";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";

const OPTIONS: {
  view: ListView;
  icon: IconName;
  title: string;
  description: string;
}[] = [
  {
    view: "group",
    icon: "layers",
    title: "By group",
    description: "A section for each group. Drag to reorder inside a section.",
  },
  {
    view: "priority",
    icon: "list-ordered",
    title: "By priority",
    description: "One list in your order, with the group shown on each item. Drag anything anywhere.",
  },
];

/** The list's View button: pick By group or By priority. Per device, never synced. */
export const ArrangeListSheet = forwardRef<SheetRef, { value: ListView; onChange: (view: ListView) => void; onReorder: () => void }>(
  ({ value, onChange, onReorder }, ref) => {
    const { colors } = useTheme();
    return (
      <Sheet ref={ref} title="Arrange list">
        <View style={[styles.options, { borderTopColor: colors.line }]}>
          {OPTIONS.map((option) => {
            const selected = option.view === value;
            return (
              <Tap
                key={option.view}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.title}
                accessibilityHint={option.description}
                feedback="select"
                pressScale={0.98}
                onPress={() => onChange(option.view)}
                style={styles.option}
              >
                <SquircleFill
                  radius={CARD_RADIUS}
                  color={selected ? colors.accentSoft : colors.surface}
                  stroke={{ color: selected ? colors.accent : colors.line, width: 1 }}
                />
                <View style={styles.tile}>
                  <SquircleFill size={{ width: TILE_SIZE, height: TILE_SIZE }} radius={TILE_RADIUS} color={selected ? colors.accent : colors.surface2} />
                  <Icon name={option.icon} size={20} color={selected ? colors.onAccent : colors.ink2} />
                </View>
                <View style={styles.text}>
                  <Text variant="bodyStrong">{option.title}</Text>
                  <Text variant="caption" color="ink2" style={styles.description}>
                    {option.description}
                  </Text>
                </View>
                <View style={[styles.radio, selected ? { backgroundColor: colors.accent } : { borderColor: colors.ink3, borderWidth: 1.5 }]}>
                  {selected ? <Icon name="check" size={15} color={colors.onAccent} strokeWidth={3} /> : null}
                </View>
              </Tap>
            );
          })}
        </View>
        <Tap
          accessibilityRole="button"
          accessibilityHint="Shows a handle on each item to drag it into place"
          feedback="select"
          pressScale={0.98}
          onPress={onReorder}
          style={styles.reorder}
        >
          <SquircleFill radius={CARD_RADIUS} color={colors.bg} stroke={{ color: colors.line, width: 1 }} />
          <Icon name="grip-vertical" size={20} color={colors.accent} />
          <Text variant="bodyStrong" color="accent" style={styles.reorderLabel}>
            Reorder items
          </Text>
          <Icon name="chevron-right" size={18} color={colors.ink3} />
        </Tap>
        <View style={styles.note}>
          <Icon name="arrow-down-up" size={16} color={colors.ink3} />
          <Text variant="caption" color="ink2" style={styles.noteText}>
            Both views share one order. Switching back to groups keeps your priority order inside each group.
          </Text>
        </View>
      </Sheet>
    );
  },
);
ArrangeListSheet.displayName = "ArrangeListSheet";

const CARD_RADIUS = 16;
const TILE_SIZE = 40;
const TILE_RADIUS = 12;

const styles = StyleSheet.create({
  options: {
    gap: 10,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 3 },
  description: { fontSize: 14, lineHeight: 19 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reorder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    height: 52,
  },
  reorderLabel: { flex: 1 },
  note: { flexDirection: "row", gap: 10, paddingTop: 16, paddingHorizontal: 4 },
  noteText: { flex: 1 },
});
