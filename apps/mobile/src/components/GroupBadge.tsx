import { groupTone, isGroupIcon, normalizeGroupColor, type Group, type GroupTone } from "@mira/shared";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { Text } from "./Text";

export type GroupLook = Pick<Group, "icon" | "color" | "color2"> | undefined;

/**
 * Theme-derived colours for a group. Stored hexes are never drawn as-is;
 * groups without a colour fall back to neutral palette tokens.
 */
export const useGroupTone = (group: GroupLook): GroupTone => {
  const { colors, scheme } = useTheme();
  const hex = normalizeGroupColor(group?.color);
  const hex2 = hex ? normalizeGroupColor(group?.color2) : undefined;
  return useMemo(
    () =>
      hex
        ? groupTone({ hex, hex2, scheme, pageBackground: colors.bg })
        : { tintStops: [colors.surface2], text: colors.ink2, icon: colors.ink2, badgeStops: [colors.surface2], onBadge: colors.ink3 },
    [hex, hex2, scheme, colors],
  );
};

/** Background for one or two stops: a diagonal gradient, or a plain fill. */
export const GroupFill = ({ stops, style, children }: { stops: string[]; style?: StyleProp<ViewStyle>; children?: ReactNode }) => {
  const [first, second] = stops;
  if (first && second) {
    return (
      <LinearGradient colors={[first, second]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[style, { backgroundColor: first }]}>{children}</View>;
};

const GroupGlyph = ({ group, size, color }: { group: GroupLook; size: number; color: string }) =>
  group && isGroupIcon(group.icon) ? (
    <Icon name={group.icon} size={size} color={color} />
  ) : (
    <View style={{ width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: color }} />
  );

/** Round badge, used in the group picker, Groups page and swatches. */
export const GroupBadge = ({ group, size = 32 }: { group: GroupLook; size?: number }) => {
  const tone = useGroupTone(group);
  return (
    <GroupFill stops={tone.badgeStops} style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>
      <GroupGlyph group={group} size={size / 2} color={tone.onBadge} />
    </GroupFill>
  );
};

/** Tinted chip with icon + name: section headers on the list and the Group value on Add item. */
export const GroupChip = ({
  group,
  name,
  variant = "header",
  trailing,
}: {
  group: GroupLook;
  name: string;
  variant?: "header" | "value";
  trailing?: ReactNode;
}) => {
  const tone = useGroupTone(group);
  const isHeader = variant === "header";
  return (
    <GroupFill stops={tone.tintStops} style={isHeader ? styles.headerChip : styles.valueChip}>
      {group && isGroupIcon(group.icon) ? <Icon name={group.icon} size={isHeader ? 14 : 16} color={tone.icon} /> : null}
      <Text variant={isHeader ? "eyebrow" : "bodyStrong"} style={[{ color: tone.text }, isHeader ? styles.headerText : null]} numberOfLines={1}>
        {name}
      </Text>
      {trailing}
    </GroupFill>
  );
};

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  headerChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 5, paddingLeft: 8, paddingRight: 10, overflow: "hidden" },
  headerText: { fontWeight: "700", letterSpacing: 1.2 },
  valueChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, height: 36, paddingHorizontal: 10, maxWidth: 220, overflow: "hidden" },
});
