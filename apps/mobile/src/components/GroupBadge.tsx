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
export const GroupFill = ({
  stops,
  style,
  children,
  direction = "diagonal",
}: {
  stops: string[];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Gradient groups: corner to corner (badges, chips) or left to right (wide cards). */
  direction?: "diagonal" | "horizontal";
}) => {
  const [first, second] = stops;
  if (first && second) {
    return (
      <LinearGradient colors={[first, second]} start={{ x: 0, y: 0 }} end={direction === "horizontal" ? { x: 1, y: 0 } : { x: 1, y: 1 }} style={style}>
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

/** By priority with icon labels: a small tile after the item name, tinted like the group's header chip. */
export const GroupTile = ({ group, dimmed }: { group: GroupLook; dimmed?: boolean }) => {
  const tone = useGroupTone(group);
  return (
    <GroupFill stops={tone.tintStops} style={[styles.tile, dimmed ? styles.dimmed : null]}>
      <GroupGlyph group={group} size={TILE_ICON} color={tone.text} />
    </GroupFill>
  );
};

/** Text colours on a group card: the group's tint for coloured groups, plain inks on an outlined card. */
export const useGroupCardInk = (group: GroupLook): { colored: boolean; ink: string; muted: string } => {
  const { colors } = useTheme();
  const tone = useGroupTone(group);
  const colored = normalizeGroupColor(group?.color) !== undefined;
  return colored ? { colored, ink: tone.text, muted: tone.text } : { colored, ink: colors.ink, muted: colors.ink3 };
};

/**
 * Wide card in its group's tint (design frame 8), on the Groups page and in the group picker.
 * A group without a colour is a plain outlined card.
 */
export const GroupCard = ({ group, style, children }: { group: GroupLook; style?: StyleProp<ViewStyle>; children?: ReactNode }) => {
  const { colors } = useTheme();
  const tone = useGroupTone(group);
  const { colored } = useGroupCardInk(group);
  return (
    <GroupFill
      stops={colored ? tone.tintStops : [colors.surface]}
      direction="horizontal"
      // Every card keeps its 1px border (transparent when coloured): taking a border off a clipping view
      // on Android left the card's contents clipped away when a group went from no colour to a solid one.
      style={[styles.card, { borderColor: colored ? "transparent" : colors.line }, style]}
    >
      {children}
    </GroupFill>
  );
};

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
  tone: toneOverride,
}: {
  group: GroupLook;
  name: string;
  variant?: "header" | "value";
  trailing?: ReactNode;
  /** Draw with these tones instead of the current theme's (e.g. a light/dark preview). */
  tone?: GroupTone;
}) => {
  const themeTone = useGroupTone(group);
  const tone = toneOverride ?? themeTone;
  const isHeader = variant === "header";
  return (
    <GroupFill stops={tone.tintStops} style={isHeader ? styles.headerChip : styles.valueChip}>
      {group && isGroupIcon(group.icon) ? <Icon name={group.icon} size={isHeader ? 14 : 16} color={tone.icon} /> : null}
      <Text variant={isHeader ? "eyebrow" : "bodyStrong"} style={[styles.chipText, { color: tone.text }, isHeader ? styles.headerText : null]} numberOfLines={1}>
        {name}
      </Text>
      {trailing}
    </GroupFill>
  );
};

/** 36pt rounded square tinted like the list header chip, beside the group name field (design frame 9). */
export const GroupTintBadge = ({ group, size = 36 }: { group: GroupLook; size?: number }) => {
  const tone = useGroupTone(group);
  return (
    <GroupFill stops={tone.tintStops} style={[styles.tintBadge, { width: size, height: size }]}>
      <GroupGlyph group={group} size={size / 2} color={tone.text} />
    </GroupFill>
  );
};

const TILE_ICON = 13;

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    borderRadius: 14,
    borderCurve: "continuous",
    paddingLeft: 11,
    paddingRight: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  tile: { width: 22, height: 22, borderRadius: 7, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dimmed: { opacity: 0.6 },
  tintBadge: { borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  badge: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  headerChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 5, paddingLeft: 8, paddingRight: 10, overflow: "hidden", maxWidth: "100%" },
  chipText: { flexShrink: 1 },
  headerText: { fontWeight: "700", letterSpacing: 1.2 },
  valueChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, height: 36, paddingHorizontal: 10, maxWidth: 220, overflow: "hidden" },
});
