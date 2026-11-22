import { useEffect, useRef, useState, type Ref } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { SPRING_SNAPPY } from "@/theme/motion";
import { FONTS } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { SquircleFill } from "./Squircle";
import { Tap, PRESS_DELAY_MS } from "./Tap";
import { Text } from "./Text";

export type NameFieldHint = { icon: IconName; text: string };

const HINT_DROP = 4;
const MEASURING_LINE: NameFieldHint = { icon: "list-checks", text: " " };

const sameHint = (a?: NameFieldHint, b?: NameFieldHint): boolean => a?.icon === b?.icon && a?.text === b?.text;

/**
 * A quiet line under the name. The card grows by animating this wrapper's height; the line inside is
 * absolutely positioned, so it keeps its full size while the wrapper opens. It fades in over the second
 * half of the same spring, once there's room for it, so it's never cut off and stays in step when typing
 * interrupts it.
 */
const FieldHint = ({ hint }: { hint?: NameFieldHint }) => {
  const { colors } = useTheme();
  // Kept after the hint goes away, so the line still has its text while it fades out.
  const [lastHint, setLastHint] = useState(hint);
  if (hint && !sameHint(hint, lastHint)) setLastHint(hint);
  // Always laid out (invisible until shown), so its height is known before the first hint arrives.
  const line = lastHint ?? MEASURING_LINE;

  const visible = hint !== undefined;
  const contentHeight = useSharedValue(0);
  const open = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    open.set(withSpring(visible ? 1 : 0, SPRING_SNAPPY));
  }, [visible, open]);

  const wrapperStyle = useAnimatedStyle(() => ({ height: Math.max(0, open.get()) * contentHeight.get() }));
  const lineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(open.get(), [0, 1], [-HINT_DROP, 0]) }],
  }));

  return (
    <Animated.View style={wrapperStyle} importantForAccessibility={visible ? "auto" : "no-hide-descendants"}>
      <Animated.View
        style={[styles.hint, lineStyle]}
        onLayout={(event) => contentHeight.set(event.nativeEvent.layout.height)}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.hintRow}>
          <Icon name={line.icon} size={14} color={colors.accent} />
          <Text variant="label" color="accent" numberOfLines={1}>
            {line.text}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

/**
 * The item name as a big tinted card (Add item and editing an item). The whole card is the
 * tap target, so tapping its empty space focuses the input. An optional `hint` slides in under the name.
 */
export const NameField = ({
  ref,
  hint,
  ...input
}: Omit<TextInputProps, "style"> & {
  ref?: Ref<TextInput>;
  hint?: NameFieldHint;
}) => {
  const { colors } = useTheme();
  const own = useRef<TextInput>(null);
  const setInput = (node: TextInput | null) => {
    own.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="none" pressScale={1} onPress={() => own.current?.focus()} style={styles.card}>
      <SquircleFill radius={20} color={colors.accentSoft} />
      <Text variant="label" color="accent">
        Item name
      </Text>
      <TextInput
        ref={setInput}
        accessibilityLabel="Item name"
        numberOfLines={1}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        autoCapitalize="sentences"
        {...input}
        style={[styles.input, { color: colors.ink }]}
      />
      <FieldHint hint={hint} />
    </Tap>
  );
};

const styles = StyleSheet.create({
  card: { paddingHorizontal: 20, paddingVertical: 16 },
  input: { marginTop: 2, fontFamily: FONTS.displayBold, fontSize: 36, lineHeight: 44, minHeight: 48, padding: 0, outlineWidth: 0 },
  hint: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 4 },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
