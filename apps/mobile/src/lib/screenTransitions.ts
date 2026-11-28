import { Animated, Easing } from "react-native";
import {
  CardStyleInterpolators,
  type StackCardInterpolationProps,
  type StackCardStyleInterpolator,
  type StackNavigationOptions,
  type TransitionPreset,
} from "expo-router/js-stack";
import { SPRING_SCREEN, SPRING_SCREEN_BACK } from "@/theme/motion";
import { mix } from "@/theme/tokens";

/**
 * The screen underneath, once covered, sits back: it shrinks, rounds its corners, drifts a little left and
 * dims, over a backdrop darker than the app background so its edges show. The drift stays under the 3% the
 * shrink pulls its left edge in by, so the rounded left corners stay on screen.
 */
const RECEDE_SCALE = 0.94;
const RECEDE_RADIUS = 28;
const RECEDE_SHIFT = 0.015;
const RECEDE_DIM = 0.18;
const BACKDROP_SHADE = 0.3;

/** Soft shadow the incoming screen casts on the one it covers (left edge; the other sides are off screen). */
const EDGE_SHADOW = "0 0 24px rgba(0, 0, 0, 0.18)";
/**
 * How far past its place a pushed screen may bounce. The screen carries this much of its background past its
 * right edge, so the bounce never opens a gap at the right of the display.
 */
const OVERSHOOT_COVER = 40;

const CROSSFADE_MS = 200;
const ROOT_FADE_MS = 250;

type SpringConfig = { mass: number; stiffness: number; damping: number; overshootClamping?: boolean };

const spring = (config: SpringConfig): TransitionPreset["transitionSpec"]["open"] => ({
  animation: "spring",
  // The gesture value is in points: within half a point and slower than 10 pt/s, what's left is invisible.
  config: { ...config, restDisplacementThreshold: 0.5, restSpeedThreshold: 10 },
});

const PUSH_SPEC = spring(SPRING_SCREEN);
// Clamped too, so a fast swipe-release can't carry the screen underneath past full size.
const BACK_SPEC = spring({ ...SPRING_SCREEN_BACK, overshootClamping: true });

const timed = (duration: number): TransitionPreset["transitionSpec"]["open"] => ({
  animation: "timing",
  config: { duration, easing: Easing.out(Easing.quad) },
});

const recedeWhenCovered = ({
  next,
  inverted,
  layouts: { screen },
  backdrop,
}: Pick<StackCardInterpolationProps, "next" | "inverted" | "layouts"> & { backdrop: string }) => {
  if (!next) return undefined;
  const overshootLimit = 1 + OVERSHOOT_COVER / Math.max(1, screen.width);
  // Follows the covering screen a little past 1 while it bounces, so the whole scene moves on one spring.
  const covered = next.progress.interpolate({ inputRange: [0, overshootLimit], outputRange: [0, overshootLimit], extrapolate: "clamp" });
  return {
    containerStyle: { backgroundColor: backdrop },
    overflow: "hidden" as const,
    borderRadius: covered.interpolate({ inputRange: [0, 1], outputRange: [0, RECEDE_RADIUS] }),
    transform: [
      { translateX: Animated.multiply(covered.interpolate({ inputRange: [0, 1], outputRange: [0, -screen.width * RECEDE_SHIFT] }), inverted) },
      { scale: covered.interpolate({ inputRange: [0, 1], outputRange: [1, RECEDE_SCALE] }) },
    ],
  };
};

/** Keeps one interpolator per background colour, so re-rendering the navigator doesn't rebuild every card's animation. */
const perBackground = (create: (background: string) => StackCardStyleInterpolator) => {
  const made = new Map<string, StackCardStyleInterpolator>();
  return (background: string): StackCardStyleInterpolator => {
    const existing = made.get(background);
    if (existing) return existing;
    const interpolator = create(background);
    made.set(background, interpolator);
    return interpolator;
  };
};

const backdropFor = (background: string) => mix({ color: "#000000", base: background, amount: BACKDROP_SHADE });

/** The new screen slides in from the right with a shadow and a small bounce; the one underneath sits back. Swipe back runs it in reverse. */
const springPushFor = perBackground((background) => {
  const backdrop = backdropFor(background);
  return ({ current, next, inverted, layouts }) => {
    // Before the first layout the width can be 0, which would put Infinity into the input range.
    const width = Math.max(1, layouts.screen.width);
    const slideIn = current.progress.interpolate({
      inputRange: [0, 1, 1 + OVERSHOOT_COVER / width],
      outputRange: [width, 0, -OVERSHOOT_COVER],
      extrapolate: "clamp",
    });
    const receded = recedeWhenCovered({ next, inverted, layouts, backdrop });
    return {
      containerStyle: receded?.containerStyle,
      cardStyle: {
        overflow: receded?.overflow,
        borderRadius: receded?.borderRadius,
        transform: [{ translateX: Animated.multiply(slideIn, inverted) }, ...(receded?.transform ?? [])],
      },
      // Drawn under the incoming screen, over the one it covers.
      overlayStyle: { opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, RECEDE_DIM], extrapolate: "clamp" }) },
      // The stack's shadow layer, widened from a sliver to the whole screen plus OVERSHOOT_COVER, under the content.
      shadowStyle: { width: width + OVERSHOOT_COVER, backgroundColor: background, shadowOpacity: 0, boxShadow: EDGE_SHADOW },
    };
  };
});

/** Home keeps its root fade, and sits back like any other screen when one is pushed over it. */
const homeFadeFor = perBackground((background) => {
  const backdrop = backdropFor(background);
  return (props) => {
    const fade = CardStyleInterpolators.forFadeFromCenter(props);
    const receded = recedeWhenCovered({ ...props, backdrop });
    return {
      containerStyle: receded?.containerStyle,
      cardStyle: [fade.cardStyle, receded && { overflow: receded.overflow, borderRadius: receded.borderRadius, transform: receded.transform }],
    };
  };
});

const forCrossfade: StackCardStyleInterpolator = ({ current }) => ({ cardStyle: { opacity: current.progress } });

type TransitionOptions = { reduceMotion: boolean; background: string };

/** Every pushed screen (Item detail, Settings, Groups, Edit group). Reduced motion swaps the slide for a short crossfade. */
export const pushTransition = ({ reduceMotion, background }: TransitionOptions): StackNavigationOptions =>
  reduceMotion
    ? {
        gestureEnabled: true,
        gestureDirection: "horizontal",
        cardOverlayEnabled: false,
        cardShadowEnabled: false,
        cardStyleInterpolator: forCrossfade,
        transitionSpec: { open: timed(CROSSFADE_MS), close: timed(CROSSFADE_MS) },
      }
    : {
        // On by default only on iOS. On Android with gesture navigation the system's back swipe usually gets the edge first; it still pops with the spring.
        gestureEnabled: true,
        gestureDirection: "horizontal",
        cardOverlayEnabled: true,
        cardShadowEnabled: true,
        cardStyleInterpolator: springPushFor(background),
        transitionSpec: { open: PUSH_SPEC, close: BACK_SPEC },
      };

/** Sign in ↔ the list: a hand-off between flows rather than a step deeper, so it fades instead of sliding. */
export const ROOT_FADE: StackNavigationOptions = {
  animation: "fade",
  gestureEnabled: false,
  cardOverlayEnabled: false,
  cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
  transitionSpec: { open: timed(ROOT_FADE_MS), close: timed(ROOT_FADE_MS) },
};

/** The list: ROOT_FADE for Sign in ↔ the list, plus sitting back under pushed screens. Sign in keeps plain ROOT_FADE so it never sits back. */
export const homeTransition = ({ reduceMotion, background }: TransitionOptions): StackNavigationOptions =>
  reduceMotion ? ROOT_FADE : { ...ROOT_FADE, cardStyleInterpolator: homeFadeFor(background) };

/** Add item draws its own entrance (FabMorph), so the stack shows and removes it at once and leaves the list untouched beneath. */
export const NO_TRANSITION: StackNavigationOptions = {
  animation: "none",
  gestureEnabled: false,
  cardOverlayEnabled: false,
  cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
};
