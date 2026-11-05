import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { SPRING_SNAPPY } from "@/theme/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const haptic = (kind: "light" | "medium" | "success" | "select" = "light"): void => {
  if (Platform.OS === "web") return;
  if (kind === "success") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === "select") void Haptics.selectionAsync();
  else void Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
};

type TapProps = Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** How far it shrinks while pressed. */
  pressScale?: number;
  feedback?: "light" | "medium" | "select" | "none";
  /** false: the caller shows its own disabled look instead of the whole thing fading. */
  dimWhenDisabled?: boolean;
};

/** Waits this long before showing a press, so a touch that turns into a scroll never highlights or shrinks (as on iOS). */
export const PRESS_DELAY_MS = 100;

/** How long to hold a row to pick it up (press delay included). */
export const HOLD_MS = 350;

/** Pressable with a springy press-in and optional haptic, used for every tap target. */
export const Tap = ({
  style,
  children,
  pressScale = 0.96,
  feedback = "none",
  unstable_pressDelay = PRESS_DELAY_MS,
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  dimWhenDisabled = true,
  ...rest
}: TapProps) => {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      // Always a boolean: going from true to undefined drops the disabled accessibility state instead of clearing
      // it, and Android leaves the view disabled, so only its children (the label) still take touches.
      disabled={disabled === true}
      unstable_pressDelay={unstable_pressDelay}
      hitSlop={rest.hitSlop ?? 4}
      onPressIn={(event) => {
        scale.set(withSpring(pressScale, SPRING_SNAPPY));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, SPRING_SNAPPY));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback !== "none") haptic(feedback);
        onPress?.(event);
      }}
      style={[animated, style, disabled && dimWhenDisabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
};
