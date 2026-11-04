import type { ConfigContext, ExpoConfig } from "expo/config";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withFasterScreenTransitions } = require("./plugins/withFasterScreenTransitions") as typeof import("./plugins/withFasterScreenTransitions");

/**
 * app.json holds the shared config; this only varies what differs between the
 * daily app (Play internal testing) and the development build, so both can be
 * installed side by side on one phone.
 */
const IS_DEV = process.env.APP_VARIANT === "development";

export default ({ config }: ConfigContext): ExpoConfig =>
  withFasterScreenTransitions({
    ...(config as ExpoConfig),
    name: IS_DEV ? "Mira Dev" : "Mira",
    ios: {
      ...config.ios,
      bundleIdentifier: IS_DEV ? "com.shunseii.mira.dev" : "com.shunseii.mira",
    },
    android: {
      ...config.android,
      package: IS_DEV ? "com.shunseii.mira.dev" : "com.shunseii.mira",
    },
  });
