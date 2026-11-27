import { createContext, use, useMemo, type ReactNode } from "react";
import { StyleSheet, type GestureResponderEvent, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, type GestureType } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from "react-native-reanimated";
import { PRESS_FADE_IN, PRESS_FADE_OUT, SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { SquircleFill } from "./Squircle";
import { Tap, type TapProps } from "./Tap";

/** Where the wash shows: a circle or squircle centred on the button, or a pill inset from its edges (negative grows it). */
export type PressWashShape =
  | { kind: "circle"; size: number }
  | { kind: "squircle"; size: number; radius: number }
  | { kind: "pill"; inset: { top: number; right: number; bottom: number; left: number } };

type PressWashState = {
  /** 0 → 1 timed: the wash's opacity and the icon's shift to ink. */
  fade: SharedValue<number>;
  /** 0 → 1 sprung: the wash blooming to full size and the icon squeezing. Stays 0 under reduced motion. */
  squeeze: SharedValue<number>;
  reduceMotion: boolean;
  pressIn: () => void;
  pressOut: () => void;
};

/** The usual wash: a 40pt circle inside a 44pt target. */
export const ICON_WASH: PressWashShape = { kind: "circle", size: 40 };
/** For small icons in tight spots (the row pencil, a search field's clear button). */
export const SMALL_ICON_WASH: PressWashShape = { kind: "circle", size: 36 };

const WASH_REST_SCALE = 0.7;
const ICON_PRESSED_SCALE = 0.9;

/** Press state for a wash, all on the UI thread: pressing never re-renders. */
export const usePressWash = (): PressWashState => {
  const reduceMotion = useReducedMotion();
  const fade = useSharedValue(0);
  const squeeze = useSharedValue(0);
  return {
    fade,
    squeeze,
    reduceMotion,
    pressIn: () => {
      fade.set(withTiming(1, PRESS_FADE_IN));
      if (!reduceMotion) squeeze.set(withSpring(1, SPRING_SNAPPY));
    },
    pressOut: () => {
      fade.set(withTiming(0, PRESS_FADE_OUT));
      if (!reduceMotion) squeeze.set(withSpring(0, SPRING_SNAPPY));
    },
  };
};

const shapeStyle = (shape: PressWashShape): ViewStyle => {
  if (shape.kind === "pill") return { position: "absolute", ...shape.inset, borderRadius: 999 };
  const centred: ViewStyle = { position: "absolute", top: "50%", left: "50%", width: shape.size, height: shape.size, marginTop: -shape.size / 2, marginLeft: -shape.size / 2 };
  return shape.kind === "circle" ? { ...centred, borderRadius: shape.size / 2 } : centred;
};

/** Translucent ink behind a button's content while pressed. Render it before the content so it sits underneath. */
export const PressWash = ({ shape, press }: { shape: PressWashShape; press: PressWashState }) => {
  const { colors } = useTheme();
  const { fade, squeeze, reduceMotion } = press;
  const animated = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ scale: reduceMotion ? 1 : WASH_REST_SCALE + (1 - WASH_REST_SCALE) * squeeze.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[shapeStyle(shape), shape.kind === "squircle" ? null : { backgroundColor: colors.pressWash }, animated]}
    >
      {shape.kind === "squircle" ? <SquircleFill size={{ width: shape.size, height: shape.size }} radius={shape.radius} color={colors.pressWash} /> : null}
    </Animated.View>
  );
};

/**
 * A gesture around these buttons that takes over a touch held still (the list's drag pan). When any Gesture Handler
 * gesture activates it cancels React Native's touches, which ends a press mid-hold, so an IconTap inside one holds it
 * off until the finger lifts.
 */
export const HeldTouchGestureContext = createContext<GestureType | undefined>(undefined);

/** Never activates (so it never cancels touches); while the finger is down, `heldTouchGesture` waits for it. */
const useHoldOff = (heldTouchGesture: GestureType | undefined) =>
  useMemo(
    () =>
      heldTouchGesture === undefined
        ? undefined
        : Gesture.Manual()
            // Ending, not failing: a gesture left waiting is then cancelled instead of activating as the finger lifts.
            .onTouchesUp((_event, manager) => manager.end())
            .onTouchesCancelled((_event, manager) => manager.end())
            .blocksExternalGesture(heldTouchGesture),
    [heldTouchGesture],
  );

type IconTapProps = Omit<TapProps, "children" | "pressScale"> & {
  icon: IconName;
  iconSize: number;
  color: string;
  wash: PressWashShape;
  /** Drawn under the wash, e.g. the arrange button's squircle fill. */
  backdrop?: ReactNode;
};

/**
 * Icon-only button: pressing blooms a wash behind the icon while only the icon squeezes and darkens to ink,
 * instead of Tap shrinking the whole button. The touch target is the Tap's own style, unchanged.
 */
export const IconTap = ({ icon, iconSize, color, wash, backdrop, onPressIn, onPressOut, ...rest }: IconTapProps) => {
  const { colors } = useTheme();
  const press = usePressWash();
  const holdOff = useHoldOff(use(HeldTouchGestureContext));
  const { fade, squeeze } = press;
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - (1 - ICON_PRESSED_SCALE) * squeeze.get() }] }));
  const inkStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const button = (
    <Tap
      {...rest}
      pressScale={1}
      onPressIn={(event: GestureResponderEvent) => {
        press.pressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        press.pressOut();
        onPressOut?.(event);
      }}
    >
      {backdrop}
      <PressWash shape={wash} press={press} />
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={iconSize} color={color} />
        {color === colors.ink ? null : (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, inkStyle]}>
            <Icon name={icon} size={iconSize} color={colors.ink} />
          </Animated.View>
        )}
      </Animated.View>
    </Tap>
  );
  return holdOff ? <GestureDetector gesture={holdOff}>{button}</GestureDetector> : button;
};
