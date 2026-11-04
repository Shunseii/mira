import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { haptic } from "./Tap";
import { Text } from "./Text";

/** Share of the row's width a left swipe must pass to delete on release. */
const DELETE_THRESHOLD = 0.6;

/**
 * The red panel behind a swiped row. Deletes the item the moment the row has
 * slid fully off: the swipeable's own "open" callback waits for its spring to
 * settle, which lags well behind what you see.
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
      fired.value = true;
      scheduleOnRN(onGone);
    },
  );
  return (
    <View style={[styles.panel, { width, backgroundColor: colors.dangerFill }]}>
      <Icon name="trash-2" size={20} color={colors.onDangerFill} />
      <Text variant="label" color="onDangerFill">
        Delete
      </Text>
    </View>
  );
};

/**
 * Swipe a row left to delete it. The panel spans the whole row, so a swipe
 * past the threshold slides the row off and the item is deleted as it leaves;
 * anything shorter springs back. The list shows Undo afterwards.
 */
export const SwipeToDelete = ({ enabled, onDelete, children }: { enabled: boolean; onDelete: () => void; children: ReactNode }) => {
  const { width } = useWindowDimensions();
  const rowWidth = useSharedValue(0);
  return (
    <ReanimatedSwipeable
      enabled={enabled}
      friction={1}
      overshootRight={false}
      rightThreshold={width * DELETE_THRESHOLD}
      // Leave room on the right edge for the grip/pencil and keep vertical scrolls with the list.
      dragOffsetFromRightEdge={12}
      onSwipeableWillOpen={() => haptic("medium")}
      renderRightActions={(_progress, translation) => <DeletePanel translation={translation} rowWidth={rowWidth} onGone={onDelete} />}
    >
      <View onLayout={(event) => (rowWidth.value = event.nativeEvent.layout.width)}>{children}</View>
    </ReanimatedSwipeable>
  );
};

const styles = StyleSheet.create({
  // Starts below the row's top hairline, matching the row fill, so no red line shows above a swiped row.
  panel: { marginTop: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8, paddingRight: 24 },
});
