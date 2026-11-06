import { useNavigation } from "expo-router";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { getExpandOrigin, setExpandOrigin, setOriginHidden } from "@/lib/expandOrigin";
import { SPRING_TRAVEL } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { DISABLED_LABEL_OPACITY } from "./Button";
import { Icon } from "./Icon";
import { SQUIRCLE_CORNER_EXTENT, SquircleFill } from "./Squircle";
import { Text } from "./Text";

/** Opening without a button to morph from (deep link) or with reduced motion on. */
const FADE_MS = 200;
/** The page behind the button rises this far as it fades in. */
const RISE = 16;
/** The + icon fades out over the first half of the morph and the label fades in over the second. */
const SWAP_AT = 0.5;
/** The page starts fading in once the shape has left the button. */
const PAGE_FROM = 0.15;
/** Counts as landed on the button / back on the + from these points, rather than waiting out the spring's tail. */
const LANDED_AT = 0.995;
/** The start and end squircles cross-fade over this much of the morph at each end. */
const SHAPE_FADE = 0.2;
/** The layer holding the + and the label; wide enough for the label. */
const CONTENT_WIDTH = 360;
const CONTENT_HEIGHT = 64;
const CLOSED_AT = 0.01;

type Rect = { x: number; y: number; width: number; height: number };

export type FabMorphTarget = {
  /** Put on the View wrapping the target button, inside its KeyboardStickyView. */
  ref: RefObject<View | null>;
  onLayout: () => void;
  /** Hidden while the morph stands in for it. */
  visible: boolean;
};

/**
 * The list's + button morphs into a screen's main button (Add item's "Add to <month>"),
 * while the page fades in behind it; closing reverses it back into the +.
 *
 * The morph heads for the button's spot with the keyboard closed. The button sits in a
 * KeyboardStickyView, so as the keyboard rises the morph's target follows the same live
 * keyboard offset: the keyboard pushes it up exactly as it pushes the real button.
 */
export const FabMorph = ({
  label,
  labelDimmed,
  radius,
  stickyOffset,
  children,
}: {
  label: string;
  /** Matches a disabled button: the fill stays solid and only the label dims. */
  labelDimmed: boolean;
  /** The target button's corner radius. */
  radius: number;
  /** The same offsets as the button's KeyboardStickyView. */
  stickyOffset: { closed: number; opened: number };
  children: (target: FabMorphTarget) => ReactNode;
}) => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const reduceMotion = useReducedMotion();
  const [origin] = useState(() => (reduceMotion ? undefined : getExpandOrigin()));
  const keyboard = useReanimatedKeyboardAnimation();
  const progress = useSharedValue(0);
  const target = useSharedValue<Rect | null>(null);
  const closing = useSharedValue(false);
  const overlayHidden = useSharedValue(false);
  const [landed, setLanded] = useState(!origin);
  const buttonRef = useRef<View>(null);
  const rootRef = useRef<View>(null);
  const [targetSize, setTargetSize] = useState<{ width: number; height: number }>();
  const finishClosing = useRef<() => void>(undefined);
  const finish = () => finishClosing.current?.();
  const { closed, opened } = stickyOffset;

  const animateTo = (to: 0 | 1) =>
    progress.set(origin ? withSpring(to, SPRING_TRAVEL) : withTiming(to, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }));

  // The morph stands in for the list's + while it's on screen; the real one comes back as the morph lands on it.
  useEffect(() => {
    if (!origin) return undefined;
    setOriginHidden(true);
    return () => setOriginHidden(false);
  }, [origin]);

  useEffect(() => {
    animateTo(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on open
  }, []);

  // The real button takes over once it's rendered; the overlay hides only after that, so there's no gap.
  useEffect(() => {
    overlayHidden.set(landed);
  }, [landed, overlayHidden]);

  // Hand over to the real button once the morph has landed; both follow the same keyboard offset from then on.
  useAnimatedReaction(
    () => !closing.value && progress.value >= LANDED_AT,
    (done, wasDone) => {
      if (done && !wasDone) scheduleOnRN(setLanded, true);
    },
  );
  useAnimatedReaction(
    () => closing.value && progress.value <= CLOSED_AT,
    (done, wasDone) => {
      if (done && !wasDone) scheduleOnRN(finish);
    },
  );

  // Every way out (back button, Android back, closing after Add) morphs back into the + first.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (closing.get()) return;
        event.preventDefault();
        Keyboard.dismiss();
        let done = false;
        finishClosing.current = () => {
          if (done) return;
          done = true;
          setExpandOrigin(undefined);
          setOriginHidden(false);
          navigation.dispatch(event.data.action);
        };
        if (!origin) {
          closing.set(true);
          progress.set(
            withTiming(0, { duration: FADE_MS, reduceMotion: ReduceMotion.Never }, () => {
              "worklet";
              scheduleOnRN(finish);
            }),
          );
          return;
        }
        overlayHidden.set(false);
        setLanded(false);
        closing.set(true);
        animateTo(0);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads values fixed at mount
    [navigation],
  );

  // Where the button sits with the keyboard closed and the page at rest. Its layout position, not its
  // on-screen one: that would include the page's rise and the keyboard lift, and the lift isn't applied
  // yet when the keyboard is already rising as the screen mounts (a quick re-open), which put the target a
  // keyboard's height too low. Measured once; later layouts happen mid-animation.
  const onLayout = () => {
    const root = rootRef.current;
    if (!root || target.get()) return;
    buttonRef.current?.measureLayout(root, (x, y, width, height) => {
      if (target.get()) return;
      target.set({ x, y, width, height });
      setTargetSize({ width, height });
    });
  };

  const pageStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (!origin) return { opacity: p, transform: [{ translateY: 0 }] };
    return {
      opacity: interpolate(p, [PAGE_FROM, 0.9], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(p, [0, 1], [RISE, 0], Extrapolation.CLAMP) }],
    };
  });

  // The morphing shape, recomputed each frame on the UI thread. It's a plain rounded rect, cheap to
  // animate; its corners are kept just inside a squircle's, and static squircles of the + (start) and
  // the button (end) cross-fade over it, so it begins and lands exactly on their shapes. (Redrawing an
  // SVG squircle every frame overloaded the UI thread and made the motion stutter.)
  const shape = useDerivedValue(() => {
    if (!origin) return { x: 0, y: 0, width: 0, height: 0, radius: 0 };
    const p = progress.value;
    const to = target.value;
    const liveLift = keyboard.height.value + interpolate(keyboard.progress.value, [0, 1], [closed, opened]);
    const end = to ? { ...to, y: to.y + liveLift } : origin;
    const mix = (from: number, until: number) => interpolate(p, [0, 1], [from, until], Extrapolation.CLAMP);
    const height = mix(origin.height, end.height);
    // Mid-flight, stay above the keyboard's live top edge: a keyboard that starts early (a quick re-open)
    // rises faster than the shape and would otherwise cover it until the shape caught up.
    const keyboardUp = keyboard.height.value < 0;
    const aboveKeyboard = to && keyboardUp && !closing.value ? to.y + liveLift + to.height - height : Number.POSITIVE_INFINITY;
    return {
      x: mix(origin.x, end.x),
      y: Math.min(mix(origin.y, end.y), aboveKeyboard),
      width: mix(origin.width, end.width),
      height,
      radius: mix(insideSquircle(origin), insideSquircle({ width: end.width, height: end.height, radius })),
      endX: end.x,
      endY: end.y,
    };
  });
  const hideStyle = useAnimatedStyle(() => ({ opacity: overlayHidden.value ? 0 : 1 }));
  const fillStyle = useAnimatedStyle(() => ({
    left: shape.value.x,
    top: shape.value.y,
    width: shape.value.width,
    height: shape.value.height,
    borderRadius: shape.value.radius,
  }));
  const startShapeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, SHAPE_FADE], [1, 0], Extrapolation.CLAMP),
  }));
  const endShapeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [1 - SHAPE_FADE, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: shape.value.endX ?? 0 }, { translateY: shape.value.endY ?? 0 }],
  }));
  // The + and the label sit in a fixed-size layer that only slides with the shape's centre (no per-frame layout).
  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shape.value.x + shape.value.width / 2 - CONTENT_WIDTH / 2 },
      { translateY: shape.value.y + shape.value.height / 2 - CONTENT_HEIGHT / 2 },
    ],
  }));
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, SWAP_AT], [1, 0], Extrapolation.CLAMP),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [SWAP_AT, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View ref={rootRef} style={StyleSheet.absoluteFill}>
      {/* Cached as a texture while it fades, so Android doesn't redraw the whole page every frame. */}
      <Animated.View renderToHardwareTextureAndroid={!landed} style={[StyleSheet.absoluteFill, pageStyle]}>
        {children({ ref: buttonRef, onLayout, visible: landed })}
      </Animated.View>
      {origin ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, hideStyle]}>
          <Animated.View style={[styles.fill, { backgroundColor: colors.accent }, fillStyle]} />
          <Animated.View style={[styles.fill, { left: origin.x, top: origin.y, width: origin.width, height: origin.height }, startShapeStyle]}>
            <SquircleFill size={{ width: origin.width, height: origin.height }} radius={origin.radius} color={colors.accent} />
          </Animated.View>
          {targetSize ? (
            <Animated.View style={[styles.fill, { left: 0, top: 0, ...targetSize }, endShapeStyle]}>
              <SquircleFill size={targetSize} radius={radius} color={colors.accent} />
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.content, contentStyle]}>
            <Animated.View style={[styles.center, plusStyle]}>
              <Icon name="plus" size={28} color={colors.onAccent} />
            </Animated.View>
            <Animated.View style={[styles.center, labelStyle]}>
              <Text variant="bodyStrong" numberOfLines={1} style={{ color: colors.onAccent, opacity: labelDimmed ? DISABLED_LABEL_OPACITY : 1 }}>
                {label}
              </Text>
            </Animated.View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
};

/** A plain corner radius that keeps a rounded rect just inside the squircle of the same size and radius. */
const insideSquircle = ({ width, height, radius }: { width: number; height: number; radius: number }): number => {
  "worklet";
  return 0.75 * Math.min(radius * SQUIRCLE_CORNER_EXTENT, width / 2, height / 2);
};

const styles = StyleSheet.create({
  fill: { position: "absolute" },
  content: { position: "absolute", left: 0, top: 0, width: CONTENT_WIDTH, height: CONTENT_HEIGHT },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
