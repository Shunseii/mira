import { router, type Href } from "expo-router";

/** Back if there's history (deep link, PWA reload, quick action), else to a sensible parent. */
export const goBack = (fallback: Href = "/"): void => {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
};
