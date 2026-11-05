import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, useColorScheme, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { type Rect, splashHandoff, useSplashHandoff } from "@/lib/splashHandoff";
import { SPRING_GLIDE } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { buildPalette } from "@/theme/tokens";
import { Text } from "./Text";

const SPLASH_ICON = require("../../assets/splash-icon.png");
/** The native splash draws splash-icon.png this many dp square, centred on the screen (app.json `imageWidth`). */
const SPLASH_ICON_SIZE = 120;
/** The wordmark's ink inside splash-icon.png, in its own pixels. */
const ICON_INK = { x: 167, y: 204, width: 266, height: 190, size: 600 };
/**
 * Off for now: the glide sometimes overshoots above the header and drops back. Until that's fixed,
 * the splash just fades into the app, as with reduced motion.
 */
const GLIDE_ENABLED = false;
/** Long enough for the home list or login to lay out its wordmark; after that, just fade. */
const TARGET_WAIT_MS = 600;
/** If the icon hasn't reported loading by then, hand over anyway. */
const ICON_WAIT_MS = 300;
const FADE_MS = 250;
/** Counts as landed from here, rather than waiting out the spring's tail. */
const LANDED_AT = 0.995;
/** The splash's letterforms hand over to the header font's over this stretch of the glide, once it's nearly there. */
const FONT_SWAP = [0.94, LANDED_AT];

/**
 * Where the splash icon has to sit so its wordmark covers `ink`. The splash
 * wordmark is a heavier cut than the header's font, so it matches the target's
 * ink area and centre rather than its exact width and height.
 */
const iconRectOver = (ink: Rect): Rect => {
  const scale = Math.sqrt((ink.width * ink.height) / (ICON_INK.width * ICON_INK.height));
  const size = ICON_INK.size * scale;
  const inkCentreX = (ICON_INK.x + ICON_INK.width / 2) * scale;
  const inkCentreY = (ICON_INK.y + ICON_INK.height / 2) * scale;
  return { x: ink.x + ink.width / 2 - inkCentreX, y: ink.y + ink.height / 2 - inkCentreY, width: size, height: size };
};

/** Where the native splash draws its icon: centred on the screen. */
const restingIconRect = (frame: Rect): Rect => {
  "worklet";
  return {
    x: (frame.width - SPLASH_ICON_SIZE) / 2,
    y: (frame.height - SPLASH_ICON_SIZE) / 2,
    width: SPLASH_ICON_SIZE,
    height: SPLASH_ICON_SIZE,
  };
};

/** A window rect, relative to the overlay. */
const local = ({ rect, frame }: { rect: Rect; frame: Rect }): Rect => ({ ...rect, x: rect.x - frame.x, y: rect.y - frame.y });

/**
 * Covers the native splash's hand-off to the app. It first draws exactly what the
 * native splash shows, so hiding the splash changes nothing on screen, then glides
 * the wordmark into the home header (or login), shifting it from the splash's
 * terracotta to the user's accent while the screen fades in underneath.
 * With reduced motion, or nothing to land on, it just fades.
 */
export const SplashOverlay = () => {
  const { colors } = useTheme();
  // The native splash follows the system appearance, not the app's own theme setting.
  const systemScheme = useColorScheme() === "dark" ? "dark" : "light";
  const splashBackground = buildPalette({ scheme: systemScheme, accent: "terracotta" }).bg;
  const reduceMotion = useReducedMotion();
  const { target, done } = useSplashHandoff();
  const [frame, setFrame] = useState<Rect>();
  const [iconLoaded, setIconLoaded] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [gone, setGone] = useState(done);
  const container = useRef<View>(null);
  const glideTo = useSharedValue<Rect | null>(null);
  const started = useRef(false);
  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  const finishGlide = () => {
    splashHandoff.finish();
    setGone(true);
  };

  const fadeOut = () => {
    splashHandoff.finish();
    opacity.set(withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }, () => scheduleOnRN(setGone, true)));
  };

  // Hide the native splash once this overlay is ready to stand in for it, pixel for pixel.
  useEffect(() => {
    if (gone || splashHidden || !frame) return undefined;
    const hide = () => {
      // The overlay already looks like the splash, so its own fade-out would only delay the glide.
      SplashScreen.setOptions({ duration: 0 });
      void SplashScreen.hideAsync().finally(() => setSplashHidden(true));
    };
    if (iconLoaded) {
      hide();
      return undefined;
    }
    const timer = setTimeout(hide, ICON_WAIT_MS);
    return () => clearTimeout(timer);
  }, [gone, splashHidden, frame, iconLoaded]);

  // Then glide onto the wordmark once it has laid out, or fade if it doesn't.
  useEffect(() => {
    if (!splashHidden || !frame || started.current || gone) return undefined;
    if (reduceMotion || !GLIDE_ENABLED) {
      fadeOut();
      return undefined;
    }
    if (target) {
      started.current = true;
      progress.set(withSpring(1, { ...SPRING_GLIDE, reduceMotion: ReduceMotion.Never }));
      return undefined;
    }
    const timer = setTimeout(fadeOut, TARGET_WAIT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fadeOut and progress are stable for this purpose
  }, [splashHidden, frame, target, gone, reduceMotion]);

  // The target can still move a little as the screen settles (fonts, a sync pill); follow it.
  useEffect(() => {
    if (frame && target) glideTo.set(local({ rect: iconRectOver(target.ink), frame }));
  }, [frame, target, glideTo]);

  useAnimatedReaction(
    () => progress.value >= LANDED_AT,
    (landed, wasLanded) => {
      if (landed && !wasLanded) scheduleOnRN(finishGlide);
    },
  );

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.7], [1, 0], Extrapolation.CLAMP),
  }));
  const iconStyle = useAnimatedStyle(() => {
    const to = glideTo.value;
    if (!frame || !to) return { opacity: 1 };
    const from = restingIconRect(frame);
    const mix = (start: number, end: number) => interpolate(progress.value, [0, 1], [start, end]);
    return {
      left: mix(from.x, to.x),
      top: mix(from.y, to.y),
      width: mix(from.width, to.width),
      height: mix(from.height, to.height),
      opacity: interpolate(progress.value, FONT_SWAP, [1, 0], Extrapolation.CLAMP),
    };
  });
  const accentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6], [0, 1], Extrapolation.CLAMP),
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, FONT_SWAP, [0, 1], Extrapolation.CLAMP),
  }));

  if (gone) return null;

  const resting = frame ? restingIconRect(frame) : undefined;
  const textBox = frame && target && splashHidden ? local({ rect: target.box, frame }) : undefined;

  return (
    <Animated.View
      ref={container}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, containerStyle]}
      onLayout={() =>
        container.current?.measureInWindow((x, y, width, height) => setFrame({ x, y, width, height }))
      }
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: splashBackground }, backgroundStyle]} />
      {target && textBox ? (
        <Animated.View style={[styles.textCopy, { left: textBox.x, top: textBox.y, width: textBox.width, height: textBox.height }, textStyle]}>
          <Text variant={target.variant} color="accent" style={[styles.textCopyText, { textAlign: target.textAlign }]}>
            ميرة
          </Text>
        </Animated.View>
      ) : null}
      {resting ? (
        <Animated.View
          style={[styles.icon, { left: resting.x, top: resting.y, width: resting.width, height: resting.height }, iconStyle]}
        >
          <Image source={SPLASH_ICON} style={styles.iconImage} onLoad={() => setIconLoaded(true)} fadeDuration={0} />
          <Animated.View style={[StyleSheet.absoluteFill, accentStyle]}>
            <Image source={SPLASH_ICON} style={[styles.iconImage, { tintColor: colors.accent }]} fadeDuration={0} />
          </Animated.View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  icon: { position: "absolute" },
  iconImage: { width: "100%", height: "100%" },
  textCopy: { position: "absolute" },
  textCopyText: { alignSelf: "stretch" },
});
