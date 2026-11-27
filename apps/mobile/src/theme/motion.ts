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

/** Rows moving to a new place in a list: checked items sinking, neighbours closing the gap. */
export const ROW_LAYOUT = LinearTransition.springify().mass(SPRING_SNAPPY.mass).stiffness(SPRING_SNAPPY.stiffness).damping(SPRING_SNAPPY.damping);

/**
 * Icon buttons' press wash and icon tint: quick in so the press reads at once, slower out. Never skipped,
 * since a fade is fine under reduced motion (it's the scale that goes).
 */
export const PRESS_FADE_IN: WithTimingConfig = { duration: 90, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
export const PRESS_FADE_OUT: WithTimingConfig = { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never };
