import { useState, type ReactNode } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { haptic } from "./Tap";
import { Text } from "./Text";

/** Share of the row's width a left swipe must pass to delete on release. */
const DELETE_THRESHOLD = 0.6;
/** Leaves room on the right edge for the grip/pencil before a leftward drag counts as a swipe. */
const RIGHT_EDGE_SLOP = 12;
const LEFT_EDGE_SLOP = 10;
/** How much the release velocity carries the row, as in a toss. */
const TOSS = 0.05;
/** Stiff and fully damped: the row follows through without bouncing. */
const SLIDE_SPRING = { mass: 2, damping: 1000, stiffness: 700, overshootClamping: true, reduceMotion: ReduceMotion.System };

/**
 * The red panel behind a swiped row. Mounted on the first swipe, not with every row, since most rows
 * are never swiped. Deletes the item the moment the row has slid fully off, rather than waiting for
 * the slide's spring to settle, which lags well behind what you see.
 */
const DeletePanel = ({
  translation,
  rowWidth,
  onGone,
}: {
  translation: SharedValue<number>;
  rowWidth: SharedValue<number>;
  onGone: () => void;
}) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const fired = useSharedValue(false);
  useAnimatedReaction(
    () => rowWidth.value > 0 && translation.value <= 1 - rowWidth.value,
    (gone) => {
      if (!gone || fired.value) return;
      fired.set(true);
      scheduleOnRN(onGone);
    },
  );
  // Hidden at rest so no red can show around the row's edges.
  const style = useAnimatedStyle(() => ({ opacity: translation.value < 0 ? 1 : 0 }));
  return (
    <Animated.View style={[styles.panel, { width, backgroundColor: colors.dangerFill }, style]}>
      <Icon name="trash-2" size={20} color={colors.onDangerFill} />
      <Text variant="label" color="onDangerFill">
        Delete
      </Text>
    </Animated.View>
  );
};

/**
 * Swipe a row left to delete it. A swipe past the threshold slides the row off and the item is
 * deleted as it leaves; anything shorter springs back. The list shows Undo afterwards.
 *
 * Built on one pan gesture rather than ReanimatedSwipeable, which costs every row several animated
 * styles and views up front and roughly doubled the list's first render at launch.
 */
export const SwipeToDelete = ({ enabled, onDelete, children }: { enabled: boolean; onDelete: () => void; children: ReactNode }) => {
  const { width } = useWindowDimensions();
  const translation = useSharedValue(0);
  const rowWidth = useSharedValue(0);
  const [swiped, setSwiped] = useState(false);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-RIGHT_EDGE_SLOP, LEFT_EDGE_SLOP])
    .onStart(() => {
      scheduleOnRN(setSwiped, true);
    })
    .onUpdate((event) => {
      translation.set(Math.min(0, Math.max(-width, event.translationX)));
    })
    .onEnd((event) => {
      const deleting = event.translationX + TOSS * event.velocityX < -width * DELETE_THRESHOLD;
      if (deleting) scheduleOnRN(haptic, "medium");
      translation.set(withSpring(deleting ? -width : 0, { ...SLIDE_SPRING, velocity: event.velocityX }));
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translation.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.container} onLayout={(event) => rowWidth.set(event.nativeEvent.layout.width)}>
        {swiped ? <DeletePanel translation={translation} rowWidth={rowWidth} onGone={onDelete} /> : null}
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  // Pinned to the row's right edge and wider than the row, so it fills whatever the row uncovers.
  // Starts below the row's top hairline, matching the row fill, so no red line shows above a swiped row.
  panel: {
    position: "absolute",
    top: StyleSheet.hairlineWidth,
    bottom: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingRight: 24,
  },
});
