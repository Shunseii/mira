import type { Href } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";
import { TAP } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** How far the large title scrolls up before its name moves into the bar (about the title's own height). */
const COLLAPSE_AT = 34;
const TITLE_FADE_MS = 150;

/** Tracks a screen's scroll on the UI thread so the bar can collapse its large title without re-rendering. */
export const useNavScroll = () => {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  return { scrollY, onScroll };
};

/**
 * The bar at the top of every pushed screen: a fixed back link naming the screen it returns to, an
 * optional right-hand action, and the screen's title, which appears in the bar once the large title
 * (`NavTitle`, at the top of the scrolling content) has scrolled away.
 */
export const NavBar = ({
  back,
  title,
  scrollY,
  right,
}: {
  back: { label: string; fallback?: Href; feedback?: "select" | "none" };
  /** Shown in the bar once `scrollY` passes the large title. Leave out when the screen has no title. */
  title?: string;
  scrollY?: SharedValue<number>;
  right?: ReactNode;
}) => {
  const { colors } = useTheme();
  const collapsed = useDerivedValue(() => (scrollY ? scrollY.get() > COLLAPSE_AT : false));
  // Timed, not a spring: it's a fade. Reanimated's default ReduceMotion.System makes it jump when asked.
  const titleStyle = useAnimatedStyle(() => ({ opacity: withTiming(collapsed.get() ? 1 : 0, { duration: TITLE_FADE_MS }) }));
  const ruleStyle = useAnimatedStyle(() => ({ opacity: withTiming(collapsed.get() ? 1 : 0, { duration: TITLE_FADE_MS }) }));

  return (
    <View style={styles.bar}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={`Back to ${back.label}`}
        feedback={back.feedback ?? "none"}
        onPress={() => goBack(back.fallback)}
        style={styles.back}
      >
        <Icon name="chevron-left" size={22} color={colors.accent} />
        <Text variant="bodyStrong" color="accent" numberOfLines={1} style={styles.backLabel}>
          {back.label}
        </Text>
      </Tap>
      {title && scrollY ? (
        <Animated.View pointerEvents="none" style={[styles.titleWrap, titleStyle]} importantForAccessibility="no-hide-descendants">
          <Text variant="bodyStrong" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </Animated.View>
      ) : null}
      <View style={styles.right}>{right}</View>
      <Animated.View pointerEvents="none" style={[styles.rule, { backgroundColor: colors.line }, ruleStyle]} />
    </View>
  );
};

/** The screen's large title, at the top of its scrolling content. Same style on every pushed screen. */
export const NavTitle = ({ children, detail }: { children: string; detail?: string }) => (
  <View style={styles.large}>
    <Text variant="display" accessibilityRole="header">
      {children}
    </Text>
    {detail ? (
      <Text variant="caption" color="ink2">
        {detail}
      </Text>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  bar: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 10, paddingRight: 16 },
  back: { height: TAP.min, maxWidth: "45%", flexDirection: "row", alignItems: "center", gap: 1, paddingRight: 10, zIndex: 1 },
  backLabel: { fontSize: 16 },
  titleWrap: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 120 },
  title: { fontSize: 16 },
  right: { flexDirection: "row", alignItems: "center", gap: 8, zIndex: 1 },
  rule: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  large: { gap: 6, paddingTop: 2 },
});
