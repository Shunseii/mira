import { Easing, LinearTransition, ReduceMotion, type WithTimingConfig } from "react-native-reanimated";

/**
 * Motion rules: anything the finger drives (or that answers a tap with a
 * physical move) uses a spring, so it can be interrupted mid-flight and keeps
 * its velocity. Timed easing is only for fades and colour changes.
 *
 * Springs are in physics form (not `duration`), because @gorhom/bottom-sheet
 * treats any config with a `duration` as a timing animation. Reanimated's
 * default `ReduceMotion.System` makes them jump straight to the end when the
 * device asks for reduced motion.
 */

/** Settles in about 250 ms with almost no overshoot (damping ratio ≈ 0.9). */
export const SPRING_SNAPPY = { mass: 1, stiffness: 500, damping: 40 } as const;

/** For long moves (the + morphing into Add item's button): stiffer, so a big distance still settles in about 250 ms. */
export const SPRING_TRAVEL = { mass: 1, stiffness: 750, damping: 52 } as const;

/** A little bounce (≈ 4% past the target on a 0.6 → 1 scale), settles in about 300 ms. */
export const SPRING_POP = { mass: 1, stiffness: 520, damping: 26 } as const;

/**
 * A screen pushing in (and a cancelled swipe back springing home): damping ratio ≈ 0.79, so it reaches its place
 * in about 215 ms, runs ≈ 1.6% past (6 pt on a phone), and is at rest by about 460 ms.
 * Drives React Navigation's Animated.spring, not Reanimated.
 */
export const SPRING_SCREEN = { mass: 1, stiffness: 360, damping: 30 } as const;

/**
 * A screen going back (button, system back, or a swipe released past halfway): critically damped, so the
 * screen underneath grows back to full size without bobbing, in about 480 ms.
 */
export const SPRING_SCREEN_BACK = { mass: 1, stiffness: 320, damping: 36 } as const;

/** Rows moving to a new place in a list: checked items sinking, neighbours closing the gap. */
export const ROW_LAYOUT = LinearTransition.springify().mass(SPRING_SNAPPY.mass).stiffness(SPRING_SNAPPY.stiffness).damping(SPRING_SNAPPY.damping);

/**
 * Icon buttons' press wash and icon tint: quick in so the press reads at once, slower out. Never skipped,
 * since a fade is fine under reduced motion (it's the scale that goes).
 */
export const PRESS_FADE_IN: WithTimingConfig = { duration: 90, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
export const PRESS_FADE_OUT: WithTimingConfig = { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
