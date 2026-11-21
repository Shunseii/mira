import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { customUnits, UNIT_GROUPS } from "@mira/shared";
import { forwardRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useStoreQuery } from "@/data/HouseholdProvider";
import { useSheetPick } from "@/lib/useSheetPick";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap, PRESS_DELAY_MS } from "./Tap";
import { Text } from "./Text";
import { SquircleFill } from "./Squircle";

const CHECK_SIZE = 16;
const CHECK_GAP = 6;
const CHIP_LARGE_PADDING = 14;

const UnitChip = ({ unit, selected, size, onPress }: { unit: string; selected: boolean; size: "small" | "large"; onPress: () => void }) => {
  const { colors } = useTheme();
  const large = size === "large";
  const fontSize = large ? 16 : 14;
  return (
    <Tap
      unstable_pressDelay={PRESS_DELAY_MS}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Unit ${unit}`}
      feedback="select"
      pressScale={0.92}
      onPress={onPress}
      // Same width picked or not, so the chips around it don't shift: the border is always there (clear when
      // unpicked), the label's width is the bold one's, and a large chip's padding makes room for its check.
      style={[
        large ? (selected ? styles.chipLarge : styles.chipLargeRoomy) : styles.chipSmall,
        { backgroundColor: selected ? colors.accentSoft : colors.surface2, borderColor: selected ? colors.accent : "transparent" },
      ]}
    >
      {selected && large ? <Icon name="check" size={CHECK_SIZE} color={colors.accent} /> : null}
      <View>
        <Text variant="secondary" style={[{ fontFamily: FONTS.bodyBold, fontSize }, styles.ghost]}>
          {unit}
        </Text>
        <Text
          variant="secondary"
          color={selected ? "accent" : "ink"}
          style={[{ fontFamily: selected ? FONTS.bodyBold : FONTS.bodyMedium, fontSize }, styles.label]}
        >
          {unit}
        </Text>
      </View>
    </Tap>
  );
};

/** Inline: up to three ranked suggestions plus "More". */
export const UnitSuggestions = ({
  suggestions,
  selected,
  onSelect,
  onMore,
}: {
  suggestions: string[];
  selected: string | undefined;
  onSelect: (unit: string | undefined) => void;
  onMore: () => void;
}) => {
  const { colors } = useTheme();
  const shown = selected && !suggestions.includes(selected) ? [selected, ...suggestions.slice(0, 2)] : suggestions;
  return (
    <View style={styles.inline}>
      {shown.map((unit) => (
        <UnitChip key={unit} unit={unit} size="small" selected={unit === selected} onPress={() => onSelect(unit === selected ? undefined : unit)} />
      ))}
      <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="button" accessibilityLabel="More units" onPress={onMore} style={[styles.more, { borderColor: colors.line }]}>
        <Text variant="secondary" color="ink2" style={{ fontFamily: FONTS.bodyMedium, fontSize: 14 }}>
          More
        </Text>
        <Icon name="chevrons-up-down" size={14} color={colors.ink2} />
      </Tap>
    </View>
  );
};

const Section = ({ icon, title, hint, children }: { icon: IconName; title: string; hint?: string; children: React.ReactNode }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabel}>
        <Icon name={icon} size={14} color={colors.ink3} />
        <Text variant="eyebrow" color="ink2">
          {title}
        </Text>
        {hint ? (
          <Text variant="tag" color="ink2">
            · {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
};

export const UnitSheet = forwardRef<SheetRef, { selected: string | undefined; onSelect: (unit: string | undefined) => void }>(
  ({ selected, onSelect }, ref) => {
    const { colors } = useTheme();
    const yours = useStoreQuery((store) => customUnits({ store }), []);
    const [custom, setCustom] = useState("");
    // Bumped to clear the custom field: it's uncontrolled (a controlled sheet input doubles text on Android).
    const [customKey, setCustomKey] = useState(0);
    const [shown, choose] = useSheetPick({
      selected,
      onSelect: (unit) => {
        onSelect(unit);
        setCustom("");
        setCustomKey((key) => key + 1);
      },
      dismiss: () => {
        if (ref && typeof ref === "object") ref.current?.dismiss();
      },
    });
    const chips = (units: readonly string[]) =>
      units.map((unit) => <UnitChip key={unit} unit={unit} size="large" selected={unit === shown} onPress={() => choose(unit)} />);

    return (
      <Sheet
        ref={ref}
        title="Unit"
        action={
          <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="button" onPress={() => choose(undefined)} style={styles.clear}>
            <Text variant="bodyStrong" color="accent" style={{ fontSize: 15 }}>
              No unit
            </Text>
          </Tap>
        }
      >
        <View style={styles.sections}>
          <View style={styles.pair}>
            <Section icon="cherry" title="Weight">
              {chips(UNIT_GROUPS.weight)}
            </Section>
            <Section icon="milk" title="Volume">
              {chips(UNIT_GROUPS.volume)}
            </Section>
          </View>
          <Section icon="tags" title="Count">
            {chips(UNIT_GROUPS.count)}
          </Section>
          {yours.length > 0 ? (
            <Section icon="users-round" title="Yours" hint="added by your household">
              {chips(yours)}
            </Section>
          ) : null}
        </View>
        <View style={[styles.customBlock, { borderTopColor: colors.line }]}>
          <Text variant="caption" color="ink2" style={{ fontFamily: FONTS.bodyMedium }}>
            Something else?
          </Text>
          <View style={styles.customInput}>
            <SquircleFill radius={14} color={colors.bg} stroke={{ color: colors.line, width: 1 }} />
            <BottomSheetTextInput
              key={customKey}
              onChangeText={setCustom}
              placeholder="Type a unit, e.g. jar"
              placeholderTextColor={colors.ink3}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => custom.trim() && choose(custom.trim())}
              style={[styles.customText, { color: colors.ink }]}
            />
            <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="button" disabled={!custom.trim()} onPress={() => choose(custom.trim())} style={styles.customAdd}>
              <SquircleFill radius={10} color={custom.trim() ? colors.accent : colors.surface2} />
              <Text variant="bodyStrong" color={custom.trim() ? "onAccent" : "ink3"} style={{ fontSize: 15 }}>
                Add
              </Text>
            </Tap>
          </View>
        </View>
      </Sheet>
    );
  },
);
UnitSheet.displayName = "UnitSheet";

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 1 },
  chipSmall: { height: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  chipLarge: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: CHIP_LARGE_PADDING,
    flexDirection: "row",
    alignItems: "center",
    gap: CHECK_GAP,
  },
  chipLargeRoomy: {
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: CHIP_LARGE_PADDING + (CHECK_SIZE + CHECK_GAP) / 2,
    flexDirection: "row",
    alignItems: "center",
  },
  ghost: { opacity: 0 },
  label: { position: "absolute", left: 0, right: 0, textAlign: "center" },
  more: { height: 32, borderRadius: 16, borderWidth: 1, paddingLeft: 11, paddingRight: 8, flexDirection: "row", alignItems: "center", gap: 3 },
  clear: { height: 44, justifyContent: "center" },
  sections: { gap: 22, paddingTop: 4, paddingBottom: 24 },
  pair: { flexDirection: "row", gap: 16 },
  section: { gap: 10, flexGrow: 1 },
  sectionLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 8 },
  customInput: { height: 52, paddingLeft: 17, paddingRight: 7, flexDirection: "row", alignItems: "center", gap: 10 },
  customText: { flex: 1, fontFamily: FONTS.body, fontSize: 16, height: "100%" },
  customAdd: { height: 40, paddingHorizontal: 14, justifyContent: "center" },
});
