import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { haptic } from "./Tap";

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const THUMB = 22;
const INSET = (TRACK_HEIGHT - THUMB) / 2;
const COLOR_FADE_MS = 160;
/** About how long the thumb's spring takes to settle. */
export const TOGGLE_SLIDE_MS = 250;

/**
 * On/off switch. Drawn with Reanimated instead of the native Switch, whose slide
 * Android drops whenever the app is busy re-rendering right after the tap.
 */
export const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (value: boolean) => void; label: string }) => {
  const { colors } = useTheme();
  // The thumb moves on a spring; the track colour is a timed fade.
  const position = useSharedValue(value ? 1 : 0);
  const tint = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    position.value = withSpring(value ? 1 : 0, SPRING_SNAPPY);
    tint.value = withTiming(value ? 1 : 0, { duration: COLOR_FADE_MS });
  }, [position, tint, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.value, [0, 1], [colors.line, colors.accent]),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * (TRACK_WIDTH - THUMB - INSET * 2) }],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      hitSlop={10}
      onPress={() => {
        haptic("select");
        onChange(!value);
      }}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.thumb, { backgroundColor: colors.surface }, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, padding: INSET },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
