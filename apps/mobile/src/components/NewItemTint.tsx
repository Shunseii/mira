import { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type WithTimingConfig,
} from "react-native-reanimated";

/**
 * The new-item highlight on a row.
 * - `held`: someone else's item, tinted until the row is seen.
 * - `fading`: it was just seen; the tint fades out.
 * - `own`: added on this device; it shows and fades on its own.
 */
export type RowTint = {
  phase: "held" | "fading" | "own";
  /** The row's place in a stagger of rows tinting or fading together. */
  delayMs: number;
  /** When a `held` item arrived this run, so a row landing with it fades its tint in. */
  arrivedAt?: number;
};

const STAGGER_MS = 40;
const STAGGER_CAP_MS = 160;
/** A row that shows its tint this soon after the item arrived is landing with it, so the tint fades in. */
const ARRIVAL_FRESH_MS = 1000;
const OWN_HOLD_MS = 300;
const REDUCED_OWN_HOLD_MS = 1500;

const FADE_IN: WithTimingConfig = { duration: 150, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never };
const FADE_OUT: WithTimingConfig = { duration: 1200, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never };
/** Reduced motion: a short cross-fade instead of the long fade. Never, so Reanimated doesn't skip it outright. */
const REDUCED_FADE_OUT: WithTimingConfig = { duration: 150, easing: Easing.linear, reduceMotion: ReduceMotion.Never };

/** Rows that tint or fade together follow list order, 40 ms apart, all started within 160 ms. */
export const staggerDelay = (index: number): number => Math.min(index * STAGGER_MS, STAGGER_CAP_MS);

const TintFade = ({ tint, cleared, color }: { tint: RowTint | undefined; cleared: boolean; color: string }) => {
  const reduceMotion = useReducedMotion();
  const phase = cleared ? undefined : tint?.phase;
  const [arrivedFresh] = useState(() => tint?.arrivedAt !== undefined && Date.now() - tint.arrivedAt < ARRIVAL_FRESH_MS);
  const opacity = useSharedValue(phase === "own" || (phase === "held" && (!arrivedFresh || reduceMotion)) ? 1 : 0);
  const previousPhase = useRef<RowTint["phase"]>(undefined);
  const delayMs = tint?.delayMs ?? 0;

  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = phase;
    if (phase === previous) return;
    const fadeOut = (afterMs: number) =>
      withDelay(afterMs, withTiming(0, reduceMotion ? REDUCED_FADE_OUT : FADE_OUT), ReduceMotion.Never);
    if (cleared) opacity.set(0);
    else if (phase === "held") opacity.set(previous === undefined && arrivedFresh && !reduceMotion ? withDelay(delayMs, withTiming(1, FADE_IN), ReduceMotion.Never) : 1);
    else if (phase === "fading" && previous === "held") opacity.set(fadeOut(delayMs));
    else if (phase === "own") opacity.set(withSequence(withTiming(1, { duration: 0 }), fadeOut(delayMs + (reduceMotion ? REDUCED_OWN_HOLD_MS : OWN_HOLD_MS))));
    else if (phase === undefined && previous === "held") opacity.set(0);
  }, [arrivedFresh, cleared, delayMs, opacity, phase, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]} />;
};

/**
 * Drawn on the row's fill, under the press highlight: accent-soft over bg, so fading its opacity blends
 * the two colours. Mounted the first time the row gets a tint, not with every row. `cleared` (the item was
 * checked off) drops the tint at once.
 */
export const NewItemTint = ({ tint, cleared, color }: { tint: RowTint | undefined; cleared: boolean; color: string }) => {
  const [used, setUsed] = useState(tint !== undefined && !cleared);
  if (tint && !cleared && !used) setUsed(true);
  return used ? <TintFade tint={tint} cleared={cleared} color={color} /> : null;
};
