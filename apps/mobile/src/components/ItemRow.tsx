import { formatQuantity, isGroupIcon, type Group, type Item } from "@mira/shared";
import { memo, useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { usePrefs } from "@/data/prefs";
import { SPRING_POP } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, TAP } from "@/theme/tokens";
import { GroupFill, GroupTile, useGroupTone } from "./GroupBadge";
import { Icon } from "./Icon";
import { HOLD_MS, PRESS_DELAY_MS, Tap, haptic } from "./Tap";
import { Text } from "./Text";

/** How far rows (and their tint) reach past the page's content edge on each side. */
export const ROW_INSET = 12;

const CHECK_START_SCALE = 0.6;
const CHECK_FADE_MS = 120;

/** Shows quickly when a finger lands (after the press delay) and fades out gently on release. */
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 240;

const PressHighlight = ({ pressed, color }: { pressed: boolean; color: string }) => {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withTiming(pressed ? 1 : 0, { duration: pressed ? PRESS_IN_MS : PRESS_OUT_MS }));
  }, [pressed, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
};

/**
 * The check pops in on a spring (a touch past full size, then settles) with a short fade. It is mounted
 * only while the item is checked, so what's on screen always follows the data: an animation that gets cut
 * short (the app frozen in the background mid-sync, say) can't leave a checked item looking unchecked.
 * Unchecking removes it at once for the same reason.
 */
const checkIn = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: CHECK_START_SCALE }] },
    animations: { opacity: withTiming(1, { duration: CHECK_FADE_MS }), transform: [{ scale: withSpring(1, SPRING_POP) }] },
  };
};

const Checkbox = ({ checked }: { checked: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.checkbox, { borderColor: checked ? colors.accent : colors.ink3 }]}>
      {/* Rows that mount already checked (opening the list, scrolling) show the check without the pop. */}
      <LayoutAnimationConfig skipEntering>
        {checked ? (
          <Animated.View entering={checkIn} style={[styles.checkFill, { backgroundColor: colors.accent }]}>
            <Icon name="check" size={16} color={colors.onAccent} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </LayoutAnimationConfig>
    </View>
  );
};

type ItemRowProps = {
  item: Item;
  pending: boolean;
  /** Tap on the row: check/uncheck. */
  onPress: (item: Item) => void;
  /** Hold on the row: pick it up to drag (and start reorder mode). */
  onLongPress?: (item: Item) => void;
  /** Screen readers' stand-in for swipe-to-delete. */
  onDelete?: (item: Item) => void;
  /** The pencil button: open the item to edit it. */
  onEdit?: (item: Item) => void;
  /** Drag handle to render on the right (reorder mode only). */
  grip?: ReactNode;
  /** By priority: the item's group, as a line under the name or an icon tile after it (the Group labels setting). */
  group?: Group;
  /** Lifted while being dragged: surface background and shadow, as in the design's mid-drag frame. */
  lifted?: boolean;
};

/** Drag handle: rendered by the list, which wires it to its drag gesture. */
export const GripIcon = ({ active }: { active: boolean }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.grip}>
      <Icon name="grip-vertical" size={20} color={active ? colors.accent : colors.ink3} />
    </View>
  );
};

/** By priority: a small badge under the item name, tinted like the group's header chip (gradient groups use their gradient tint). */
export const GroupLine = ({ group, dimmed = false }: { group: Pick<Group, "name" | "icon" | "color" | "color2">; dimmed?: boolean }) => {
  const tone = useGroupTone(group);
  return (
    <GroupFill stops={tone.tintStops} style={[styles.groupBadge, dimmed ? styles.dimmed : null]}>
      {isGroupIcon(group.icon) ? <Icon name={group.icon} size={12} color={tone.text} strokeWidth={2.25} /> : null}
      <Text variant="tag" numberOfLines={1} style={[styles.groupName, { color: tone.text }]}>
        {group.name}
      </Text>
    </GroupFill>
  );
};

/**
 * One item. Tapping anywhere on the row checks it off; the pencil edits it;
 * swiping it left deletes it; holding it starts reorder mode, where the grip drags it.
 */
export const ItemRow = memo(({ item, pending, onPress, onLongPress, onDelete, onEdit, grip, group, lifted }: ItemRowProps) => {
  const { colors } = useTheme();
  const checked = item.checkedAt !== undefined;
  const { showUnits, groupLabel } = usePrefs();
  const quantity = formatQuantity({ qty: item.qty, unit: showUnits ? item.unit : undefined });
  // One line on the list; the full note stays on Item detail.
  const note = item.note?.replace(/\s+/g, " ").trim() || undefined;
  const badge = group && groupLabel === "name" ? group : undefined;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ checked }}
      accessibilityLabel={[item.name, group?.name, note, quantity].filter(Boolean).join(", ")}
      accessibilityHint={checked ? "Puts it back on the list. Hold to reorder" : "Checks it off. Hold to reorder"}
      onPress={() => {
        haptic(checked ? "light" : "select");
        onPress(item);
      }}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      // React Native counts the long press from after the press delay; together they make a 350 ms hold.
      delayLongPress={HOLD_MS - PRESS_DELAY_MS}
      unstable_pressDelay={PRESS_DELAY_MS}
      accessibilityActions={[
        ...(onLongPress ? [{ name: "longpress", label: "Reorder" }] : []),
        ...(onDelete ? [{ name: "delete", label: "Delete" }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "longpress") onLongPress?.(item);
        if (event.nativeEvent.actionName === "delete") onDelete?.(item);
      }}
      style={[styles.row, lifted ? [styles.lifted, { backgroundColor: colors.surface }] : null]}
    >
      {({ pressed }) => (
        <>
          {/* Opaque fill (so the delete panel can't show through a swiped row) and a plain pressed state instead of
          the native ripple, which sticks to a row that slides under a swipe. It starts one hairline down so it
          never paints over the separator of the row above when rows land on fractional pixels. */}
          {lifted ? null : (
            <View pointerEvents="none" style={[styles.fill, { backgroundColor: colors.bg }]}>
              <PressHighlight pressed={pressed} color={colors.surface2} />
            </View>
          )}
          {lifted ? null : <View pointerEvents="none" style={[styles.separator, { backgroundColor: colors.line }]} />}
          <View style={styles.checkTarget}>
            <Checkbox checked={checked} />
          </View>
          <View style={styles.label}>
            <View style={styles.nameRow}>
              <Text variant="body" color={checked ? "ink3" : "ink"} numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>

              {group && groupLabel === "icon" ? <GroupTile group={group} dimmed={checked} /> : null}
              {pending ? <Icon name="cloud-upload" size={14} color={colors.accent} /> : null}
            </View>
            {/* Then the group badge (By priority, Name labels) and the note (up to two lines), each on its own line. */}
            {badge ? <GroupLine group={badge} dimmed={checked} /> : null}
            {note ? (
              <Text variant="caption" color={checked ? "ink3" : "ink2"} numberOfLines={2} ellipsizeMode="tail">
                {note}
              </Text>
            ) : null}
          </View>
          {quantity ? (
            <Text variant="secondary" color={checked ? "ink3" : "ink2"} style={styles.quantity}>
              {quantity}
            </Text>
          ) : null}
          {onEdit ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              pressScale={0.88}
              onPress={() => onEdit(item)}
              style={styles.trailing}
            >
              <Icon name="pencil" size={18} color={colors.ink3} />
            </Tap>
          ) : null}
          {grip}
        </>
      )}
    </Pressable>
  );
});
ItemRow.displayName = "ItemRow";

const styles = StyleSheet.create({
  /** Rows sit in a list widened by ROW_INSET on each side; the padding keeps content on the page's edge. */
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ROW_INSET,
  },
  fill: { position: "absolute", top: StyleSheet.hairlineWidth, bottom: 0, left: 0, right: 0 },
  separator: {
    position: "absolute",
    left: ROW_INSET,
    right: ROW_INSET,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  checkTarget: {
    width: TAP.row - 12,
    height: 60,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkFill: {
    position: "absolute",
    top: -1.5,
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { flex: 1, gap: 3, paddingVertical: 10 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 8,
    overflow: "hidden",
  },
  groupName: { fontFamily: FONTS.bodyBold, flexShrink: 1 },
  dimmed: { opacity: 0.6 },
  name: { flexShrink: 1 },
  quantity: { marginLeft: 12 },
  trailing: {
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  grip: {
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -12,
  },
  lifted: {
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
