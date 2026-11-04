import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Image, Platform, StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { captureScreen } from "react-native-view-shot";
import { scheduleOnRN } from "react-native-worklets";

const FADE_MS = 320;

type Transition = (apply: () => void) => void;

const AppearanceTransitionContext = createContext<Transition>((apply) => apply());

/**
 * Cross-fades theme and accent changes. Colours are plain styles everywhere,
 * so instead of animating each one: snapshot the screen, lay the snapshot on
 * top, apply the change underneath, then fade the snapshot away.
 */
export const AppearanceTransitionProvider = ({ children }: { children: ReactNode }) => {
  const [snapshot, setSnapshot] = useState<string>();
  const busy = useRef(false);
  const pendingApply = useRef<(() => void) | null>(null);
  const opacity = useSharedValue(0);

  const clear = useCallback(() => {
    setSnapshot(undefined);
    busy.current = false;
  }, []);

  const transition = useCallback<Transition>(
    (apply) => {
      if (Platform.OS === "web" || busy.current) {
        apply();
        return;
      }
      busy.current = true;
      pendingApply.current = apply;
      captureScreen({ format: "jpg", quality: 0.9 })
        .then((uri) => {
          opacity.value = 1;
          setSnapshot(uri);
        })
        .catch(() => {
          pendingApply.current = null;
          apply();
          busy.current = false;
        });
    },
    [opacity],
  );

  // Once the snapshot is on screen, change the theme underneath it and fade the snapshot out.
  const onSnapshotShown = useCallback(() => {
    // onLoad fires before the image is drawn; wait a frame so the swap happens under it.
    requestAnimationFrame(() => {
      pendingApply.current?.();
      pendingApply.current = null;
      opacity.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(clear);
      });
    });
  }, [clear, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <AppearanceTransitionContext.Provider value={transition}>
      {children}
      {snapshot ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
          <Image source={{ uri: snapshot }} style={StyleSheet.absoluteFill} fadeDuration={0} onLoad={onSnapshotShown} />
        </Animated.View>
      ) : null}
    </AppearanceTransitionContext.Provider>
  );
};

/** Wrap a theme or accent change to cross-fade it. */
export const useAppearanceTransition = (): Transition => useContext(AppearanceTransitionContext);
