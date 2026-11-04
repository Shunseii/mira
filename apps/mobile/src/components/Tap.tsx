import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

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
};

/** Pressable with a springy press-in and optional haptic, used for every tap target. */
export const Tap = ({ style, children, pressScale = 0.96, feedback = "none", onPressIn, onPressOut, onPress, disabled, ...rest }: TapProps) => {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      hitSlop={rest.hitSlop ?? 4}
      onPressIn={(event) => {
        scale.value = withSpring(pressScale, { damping: 20, stiffness: 400 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (feedback !== "none") haptic(feedback);
        onPress?.(event);
      }}
      style={[animated, style, disabled ? { opacity: 0.5 } : null]}
    >
      {children}
    </AnimatedPressable>
  );
};
