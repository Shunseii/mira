import { GROUP_ICON_SECTIONS, isGroupIcon, type GroupTone } from "@mira/shared";
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";

const IconCell = memo(
  ({ name, selected, tone, onPress }: { name: (typeof GROUP_ICON_SECTIONS)[number]["icons"][number]; selected: boolean; tone: GroupTone; onPress: () => void }) => {
    const { colors } = useTheme();
    return (
      <Tap
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`Icon ${name.replace(/-/g, " ")}`}
        feedback="select"
        pressScale={0.9}
        onPress={onPress}
        style={[styles.cell, { backgroundColor: selected ? tone.tintStops[0] : colors.surface2 }, selected ? { borderColor: tone.icon, borderWidth: 1.5 } : null]}
      >
        <Icon name={name} size={20} color={selected ? tone.icon : colors.ink2} />
      </Tap>
    );
  },
);
IconCell.displayName = "IconCell";

/**
 * Sectioned grid of the curated group icons. `value` is the raw stored key: if
 * it came from a newer build and this one can't draw it, it's shown as kept
 * (and saved back unchanged) until someone picks a different icon.
 */
export const GroupIconPicker = ({ value, tone, onChange }: { value: string | undefined; tone: GroupTone; onChange: (icon: string | undefined) => void }) => {
  const { colors } = useTheme();
  const unknown = value !== undefined && !isGroupIcon(value);
  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <Tap
          accessibilityRole="radio"
          accessibilityState={{ selected: value === undefined }}
          accessibilityLabel="No icon"
          onPress={() => onChange(undefined)}
          style={[styles.cell, { backgroundColor: colors.surface2 }, value === undefined ? { borderColor: colors.ink2, borderWidth: 1.5 } : null]}
        >
          <Icon name="ban" size={20} color={colors.ink3} />
        </Tap>
        {unknown ? (
          <View accessibilityLabel="Icon from a newer version of Mira, kept" style={[styles.cell, { backgroundColor: tone.tintStops[0], borderColor: tone.icon, borderWidth: 1.5 }]}>
            <View style={[styles.dot, { backgroundColor: tone.icon }]} />
          </View>
        ) : null}
      </View>
      {unknown ? (
        <Text variant="caption" color="ink2">
          This group's icon was set on a newer version of Mira. It's kept as is; update the app to see it.
        </Text>
      ) : null}
      {GROUP_ICON_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text variant="tag" color="ink3">
            {section.label}
          </Text>
          <View style={styles.grid}>
            {section.icons.map((name) => (
              <IconCell key={name} name={name} selected={value === name} tone={tone} onPress={() => onChange(name)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  section: { gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
