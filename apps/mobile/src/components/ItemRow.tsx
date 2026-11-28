import { formatQuantity, isGroupIcon, type Group, type Item } from "@mira/shared";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type TextProps, type TextStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  ReduceMotion,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { usePref } from "@/data/prefs";
import { SPRING_POP } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, SEPARATOR_HEIGHT, TAP } from "@/theme/tokens";
import { GroupFill, GroupTile, useGroupTone } from "./GroupBadge";
import { Icon } from "./Icon";
import { NewItemTint, type RowTint } from "./NewItemTint";
import { HOLD_MS, PRESS_DELAY_MS, haptic } from "./Tap";
import { Text, TEXT_VARIANTS, type TextVariant } from "./Text";
import { IconTap, SMALL_ICON_WASH } from "./PressWash";

/** How far rows (and their tint) reach past the page's content edge on each side. */
export const ROW_INSET = 12;

/** Shows quickly when a finger lands (after the press delay) and fades out gently on release. */
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 240;

const PressFade = ({ pressed, color }: { pressed: boolean; color: string }) => {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.set(withTiming(pressed ? 1 : 0, { duration: pressed ? PRESS_IN_MS : PRESS_OUT_MS }));
  }, [pressed, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
};

/** Mounted on a row's first press, not with every row: most rows on screen are never pressed. */
const PressHighlight = ({ pressed, color }: { pressed: boolean; color: string }) => {
  const [used, setUsed] = useState(pressed);
  if (pressed && !used) setUsed(true);
  return used ? <PressFade pressed={pressed} color={color} /> : null;
};

const CHECK_START_SCALE = 0.6;
/** Lucide's check, drawn from its short stroke up to the long one. */
const TICK_PATH = "M20 6 9 17l-5-5";
/** A touch over the path's length (22.6 in its 24-unit box), so a fully undrawn tick shows nothing. */
const TICK_LENGTH = 23;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const EASE_IN = Easing.bezier(0.5, 0, 0.75, 0);
type Step = { duration: number; easing: NonNullable<WithTimingConfig["easing"]>; delay: number };
const timed = ({ duration, easing, delay = 0 }: Omit<Step, "delay"> & { delay?: number }): Step => ({ duration, easing, delay });

/** Check: the fill pops, the tick draws, the line strikes through the name, the text greys. Uncheck runs it back, quicker and without the bounce. */
const CHECK = {
  fillOpacity: timed({ duration: 100, easing: Easing.out(Easing.quad) }),
  tick: timed({ duration: 220, easing: EASE_OUT, delay: 70 }),
  strike: timed({ duration: 260, easing: EASE_OUT, delay: 90 }),
  tone: timed({ duration: 200, easing: Easing.out(Easing.quad) }),
};
const UNCHECK = {
  fill: timed({ duration: 200, easing: EASE_IN }),
  fillOpacity: timed({ duration: 140, easing: Easing.in(Easing.quad), delay: 60 }),
  tick: timed({ duration: 120, easing: EASE_IN }),
  strike: timed({ duration: 160, easing: EASE_IN }),
  tone: timed({ duration: 200, easing: Easing.out(Easing.quad) }),
};
/** Reduced motion: no scaling or drawing, the fill and the line fade. */
const REDUCED_FADE = timed({ duration: 150, easing: Easing.out(Easing.quad) });

const animateTo = ({ to, delay, duration, easing }: Step & { to: number }) =>
  withDelay(delay, withTiming(to, { duration, easing, reduceMotion: ReduceMotion.Never }), ReduceMotion.Never);

type CheckMotion = {
  /** 0 → 1 drives the fill's scale (0.6 → 1); the spring overshoots past 1 for the pop. */
  fill: SharedValue<number>;
  fillOpacity: SharedValue<number>;
  tick: SharedValue<number>;
  strike: SharedValue<number>;
  /** Text and outline colour: 0 as unchecked, 1 as checked. */
  tone: SharedValue<number>;
  reduceMotion: boolean;
};

/**
 * One set of values per row that stays mounted and follows `checked`, so both directions animate and a row that
 * re-renders or moves keeps playing. A row that mounts already checked (opening the list, scrolling) starts at the end.
 */
const useCheckMotion = (checked: boolean): CheckMotion => {
  const reduceMotion = useReducedMotion();
  const start = checked ? 1 : 0;
  const fill = useSharedValue(start);
  const fillOpacity = useSharedValue(start);
  const tick = useSharedValue(start);
  const strike = useSharedValue(start);
  const tone = useSharedValue(start);
  const shown = useRef(checked);

  useEffect(() => {
    if (shown.current === checked) return;
    shown.current = checked;
    const to = checked ? 1 : 0;
    if (reduceMotion) {
      fill.set(1);
      tick.set(to);
      fillOpacity.set(animateTo({ to, ...REDUCED_FADE }));
      strike.set(animateTo({ to, ...REDUCED_FADE }));
      tone.set(animateTo({ to, ...CHECK.tone }));
      return;
    }
    const steps = checked ? CHECK : UNCHECK;
    fill.set(checked ? withSpring(1, { ...SPRING_POP, reduceMotion: ReduceMotion.Never }) : animateTo({ to, ...UNCHECK.fill }));
    fillOpacity.set(animateTo({ to, ...steps.fillOpacity }));
    tick.set(animateTo({ to, ...steps.tick }));
    strike.set(animateTo({ to, ...steps.strike }));
    tone.set(animateTo({ to, ...steps.tone }));
  }, [checked, fill, fillOpacity, reduceMotion, strike, tick, tone]);

  return { fill, fillOpacity, tick, strike, tone, reduceMotion };
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

const Checkbox = ({ motion }: { motion: CheckMotion }) => {
  const { colors } = useTheme();
  const { fill, fillOpacity, tick, tone, reduceMotion } = motion;
  const boxStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(tone.value, [0, 1], [colors.ink3, colors.accent]) }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fillOpacity.value,
    transform: [{ scale: reduceMotion ? 1 : interpolate(fill.value, [0, 1], [CHECK_START_SCALE, 1]) }],
  }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: -TICK_LENGTH * (1 - tick.value) }));
  return (
    <Animated.View style={[styles.checkbox, boxStyle]}>
      <Animated.View pointerEvents="none" style={[styles.checkFill, { backgroundColor: colors.accent }, fillStyle]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <AnimatedPath
            d={TICK_PATH}
            stroke={colors.onAccent}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={[TICK_LENGTH, TICK_LENGTH]}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
};

/** Text whose colour eases between its unchecked and checked inks with the row's check. */
const ToneText = ({
  tone,
  from,
  to,
  variant,
  style,
  ...rest
}: Omit<TextProps, "style"> & { tone: SharedValue<number>; from: string; to: string; variant: TextVariant; style?: StyleProp<TextStyle> }) => {
  const colorStyle = useAnimatedStyle(() => ({ color: interpolateColor(tone.value, [0, 1], [from, to]) }));
  return <Animated.Text {...rest} style={[TEXT_VARIANTS[variant], style, colorStyle]} />;
};

/** The item's name with a line drawn through it from the left. Sized to the name as shown, so an ellipsized name is struck only as far as it reaches. */
const StruckName = ({ name, motion }: { name: string; motion: CheckMotion }) => {
  const { colors } = useTheme();
  const { strike, tone, reduceMotion } = motion;
  const strikeStyle = useAnimatedStyle(() =>
    reduceMotion ? { opacity: strike.value, transform: [{ scaleX: 1 }] } : { opacity: strike.value > 0 ? 1 : 0, transform: [{ scaleX: strike.value }] },
  );
  return (
    <View style={styles.name}>
      <ToneText tone={tone} from={colors.ink} to={colors.ink3} variant="body" numberOfLines={1}>
        {name}
      </ToneText>
      <Animated.View pointerEvents="none" style={[styles.strike, { backgroundColor: colors.ink3 }, strikeStyle]} />
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
  /** The new-item highlight (unchecked rows only). */
  tint?: RowTint;
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
export const ItemRow = memo(({ item, pending, onPress, onLongPress, onDelete, onEdit, grip, group, lifted, tint }: ItemRowProps) => {
  const { colors } = useTheme();
  const checked = item.checkedAt !== undefined;
  const showUnits = usePref("showUnits");
  const groupLabel = usePref("groupLabel");
  const quantity = formatQuantity({ qty: item.qty, unit: showUnits ? item.unit : undefined });
  // One line on the list; the full note stays on Item detail.
  const note = item.note?.replace(/\s+/g, " ").trim() || undefined;
  const badge = group && groupLabel === "name" ? group : undefined;
  const motion = useCheckMotion(checked);
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
              <NewItemTint tint={tint} cleared={checked} color={colors.accentSoft} />
              <PressHighlight pressed={pressed} color={colors.surface2} />
            </View>
          )}
          {lifted ? null : <View pointerEvents="none" style={[styles.separator, { backgroundColor: colors.line }]} />}
          <View style={styles.checkTarget}>
            <Checkbox motion={motion} />
          </View>
          <View style={styles.label}>
            <View style={styles.nameRow}>
              <StruckName name={item.name} motion={motion} />

              {group && groupLabel === "icon" ? <GroupTile group={group} dimmed={checked} /> : null}
              {pending ? (
                <View accessibilityLabel="Waiting to sync" style={[styles.pendingDot, { backgroundColor: colors.ink3 }]} />
              ) : null}
            </View>
            {/* Then the group badge (By priority, Name labels) and the note (up to two lines), each on its own line. */}
            {badge ? <GroupLine group={badge} dimmed={checked} /> : null}
            {note ? (
              <ToneText tone={motion.tone} from={colors.ink2} to={colors.ink3} variant="caption" numberOfLines={2} ellipsizeMode="tail">
                {note}
              </ToneText>
            ) : null}
          </View>
          {quantity ? (
            <ToneText tone={motion.tone} from={colors.ink2} to={colors.ink3} variant="secondary" style={styles.quantity}>
              {quantity}
            </ToneText>
          ) : null}
          {onEdit ? (
            <IconTap
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
              onPress={() => onEdit(item)}
              icon="pencil"
              iconSize={18}
              color={colors.ink3}
              wash={SMALL_ICON_WASH}
              style={styles.trailing}
            />
          ) : null}
          {grip}
        </>
      )}
    </Pressable>
  );
});
ItemRow.displayName = "ItemRow";

const PENDING_DOT = 6;

const styles = StyleSheet.create({
  pendingDot: { width: PENDING_DOT, height: PENDING_DOT, borderRadius: PENDING_DOT / 2 },
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
    height: SEPARATOR_HEIGHT,
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
  name: { flexShrink: 1, justifyContent: "center" },
  /** Just under the middle of the line box, where lowercase letters sit. */
  strike: { position: "absolute", left: 0, right: 0, top: "50%", marginTop: 0.5, height: 1.5, borderRadius: 1, transformOrigin: "left" },
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
