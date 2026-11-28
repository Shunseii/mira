import { Animated, Easing } from "react-native";
import {
  CardStyleInterpolators,
  type StackCardStyleInterpolator,
  type StackNavigationOptions,
  type TransitionPreset,
} from "expo-router/js-stack";
import { SPRING_SCREEN } from "@/theme/motion";

/** How far the screen underneath slides left while a new one covers it, as a share of the screen width. */
const PARALLAX = 0.3;
/** How much the screen underneath darkens when fully covered (the design's brightness 0.85). */
const DIM = 0.15;
const CROSSFADE_MS = 200;
const ROOT_FADE_MS = 250;

const SPRING_SPEC: TransitionPreset["transitionSpec"]["open"] = {
  animation: "spring",
  // The gesture value is in points: settling within half a point ends the transition without a visible snap.
  config: { ...SPRING_SCREEN, overshootClamping: true, restDisplacementThreshold: 0.5, restSpeedThreshold: 0.5 },
};

const timed = (duration: number): TransitionPreset["transitionSpec"]["open"] => ({
  animation: "timing",
  config: { duration, easing: Easing.out(Easing.quad) },
});

/** The new screen slides in from the right; the one underneath moves 30% left and dims. Swipe back runs it in reverse. */
const forSpringPush: StackCardStyleInterpolator = ({ current, next, inverted, layouts: { screen } }) => {
  const slideIn = current.progress.interpolate({ inputRange: [0, 1], outputRange: [screen.width, 0], extrapolate: "clamp" });
  const slideAway = next
    ? next.progress.interpolate({ inputRange: [0, 1], outputRange: [0, -screen.width * PARALLAX], extrapolate: "clamp" })
    : 0;
  return {
    cardStyle: {
      transform: [{ translateX: Animated.multiply(slideIn, inverted) }, { translateX: Animated.multiply(slideAway, inverted) }],
    },
    // Drawn under the incoming screen, over the one it covers.
    overlayStyle: { opacity: current.progress.interpolate({ inputRange: [0, 1], outputRange: [0, DIM], extrapolate: "clamp" }) },
  };
};

const forCrossfade: StackCardStyleInterpolator = ({ current }) => ({ cardStyle: { opacity: current.progress } });

/** Every pushed screen (Item detail, Settings, Groups, Edit group). Reduced motion swaps the slide for a short crossfade. */
export const pushTransition = ({ reduceMotion }: { reduceMotion: boolean }): StackNavigationOptions =>
  reduceMotion
    ? {
        gestureEnabled: true,
        gestureDirection: "horizontal",
        cardOverlayEnabled: false,
        cardStyleInterpolator: forCrossfade,
        transitionSpec: { open: timed(CROSSFADE_MS), close: timed(CROSSFADE_MS) },
      }
    : {
        // On by default only on iOS. On Android with gesture navigation the system's back swipe usually gets the edge first; it still pops with the spring.
        gestureEnabled: true,
        gestureDirection: "horizontal",
        cardOverlayEnabled: true,
        cardShadowEnabled: false,
        cardStyleInterpolator: forSpringPush,
        transitionSpec: { open: SPRING_SPEC, close: SPRING_SPEC },
      };

/** Sign in ↔ the list: a hand-off between flows rather than a step deeper, so it fades instead of sliding. */
export const ROOT_FADE: StackNavigationOptions = {
  animation: "fade",
  gestureEnabled: false,
  cardOverlayEnabled: false,
  cardStyleInterpolator: CardStyleInterpolators.forFadeFromCenter,
  transitionSpec: { open: timed(ROOT_FADE_MS), close: timed(ROOT_FADE_MS) },
};

/** Add item draws its own entrance (FabMorph), so the stack shows and removes it at once and leaves the list untouched beneath. */
export const NO_TRANSITION: StackNavigationOptions = {
  animation: "none",
  gestureEnabled: false,
  cardOverlayEnabled: false,
  cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
};
