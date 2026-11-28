import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";

/** In case the transition-end event never comes (e.g. no animation). */
const SETTLE_FALLBACK_MS = 600;

/**
 * False until this screen has finished sliding in. Content behind it mounts after the slide, so a pushed
 * screen's first render stays small and the slide starts sooner (and doesn't stall partway).
 */
export const useTransitionSettled = (): boolean => {
  const navigation = useNavigation();
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const settle = () => setSettled(true);
    const unsubscribe = navigation.addListener("transitionEnd" as never, settle);
    const fallback = setTimeout(settle, SETTLE_FALLBACK_MS);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);
  return settled;
};
