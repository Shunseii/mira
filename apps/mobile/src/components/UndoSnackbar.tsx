import { StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOut, interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { Tap } from "./Tap";
import { Text } from "./Text";
import { SquircleFill } from "./Squircle";

/** How long a "Deleted … · Undo" offer stays up. */
export const UNDO_MS = 5000;
/** A swipe past this share of the bar's width, or a quick flick, dismisses it. */
const DISMISS_DISTANCE = 0.3;
const DISMISS_VELOCITY = 800;

/** "Deleted X · Undo" bar floating above the bottom of the screen. Swipe it sideways to dismiss it early. */
export const UndoSnackbar = ({
  message,
  onUndo,
  onDismiss,
  bottom,
  undoHaptic = "none",
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  bottom: number;
  undoHaptic?: "light" | "none";
}) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const offset = useSharedValue(0);

  const swipe = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      offset.set(event.translationX);
    })
    .onEnd((event) => {
      const away = Math.abs(event.translationX) > width * DISMISS_DISTANCE || Math.abs(event.velocityX) > DISMISS_VELOCITY;
      if (!away) {
        offset.set(withSpring(0, { ...SPRING_SNAPPY, velocity: event.velocityX }));
        return;
      }
      const direction = (event.translationX || event.velocityX) < 0 ? -1 : 1;
      offset.set(
        withSpring(direction * width, { ...SPRING_SNAPPY, velocity: event.velocityX }, () => {
          "worklet";
          scheduleOnRN(onDismiss);
        }),
      );
    });

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    opacity: interpolate(Math.abs(offset.value), [0, width * 0.6], [1, 0], "clamp"),
  }));

  return (
    <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOut.duration(120)} style={[styles.position, { bottom }]}>
      <GestureDetector gesture={swipe}>
        <Animated.View
          accessibilityActions={[{ name: "dismiss", label: "Dismiss" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "dismiss") onDismiss();
          }}
          style={[styles.snackbar, swipeStyle]}
        >
          <SquircleFill radius={14} color={colors.ink} />
          <Text variant="secondary" numberOfLines={1} style={[styles.message, { color: colors.bg }]}>
            {message}
          </Text>
          <Tap accessibilityRole="button" feedback={undoHaptic} onPress={onUndo} style={styles.undo}>
            <Text variant="bodyStrong" style={{ color: colors.accentSoft }}>
              Undo
            </Text>
          </Tap>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  position: { position: "absolute", left: 20, right: 20 },
  snackbar: {
    minHeight: 52,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  message: { flex: 1 },
  undo: { height: 52, paddingHorizontal: 16, justifyContent: "center" },
});
