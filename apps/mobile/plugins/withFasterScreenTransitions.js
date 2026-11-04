// @ts-check
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * react-native-screens animates Android stack transitions with resource files
 * set to the system "medium" duration (400ms), and the native stack has no
 * duration option on Android. An app resource with the same name overrides the
 * library's, so we ship faster copies of the slide animations we use.
 */
const DURATION_MS = 260;
const INTERPOLATOR = "@android:interpolator/fast_out_slow_in";

/** @param {{ axis: "X" | "Y"; from: string; to: string }} args */
const translate = ({ axis, from, to }) => `<?xml version="1.0" encoding="utf-8"?>
<translate xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="${DURATION_MS}"
    android:interpolator="${INTERPOLATOR}"
    android:from${axis}Delta="${from}"
    android:to${axis}Delta="${to}" />
`;

/** @type {Record<string, string>} */
const ANIMATIONS = {
  rns_slide_in_from_right: translate({ axis: "X", from: "100%", to: "0%" }),
  rns_slide_out_to_left: translate({ axis: "X", from: "0%", to: "-100%" }),
  rns_slide_in_from_left: translate({ axis: "X", from: "-100%", to: "0%" }),
  rns_slide_out_to_right: translate({ axis: "X", from: "0%", to: "100%" }),
  rns_slide_in_from_bottom: translate({ axis: "Y", from: "100%", to: "0%" }),
  rns_slide_out_to_bottom: translate({ axis: "Y", from: "0%", to: "100%" }),
  // Paired with the bottom slide for the screen underneath; must match its length.
  rns_no_animation_medium: `<?xml version="1.0" encoding="utf-8"?>
<alpha xmlns:android="http://schemas.android.com/apk/res/android"
    android:duration="${DURATION_MS}"
    android:fromAlpha="1.0"
    android:toAlpha="1.0" />
`,
};

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withFasterScreenTransitions = (config) =>
  withDangerousMod(config, [
    "android",
    (modConfig) => {
      const animDir = join(modConfig.modRequest.platformProjectRoot, "app/src/main/res/anim");
      mkdirSync(animDir, { recursive: true });
      for (const [name, xml] of Object.entries(ANIMATIONS)) writeFileSync(join(animDir, `${name}.xml`), xml);
      return modConfig;
    },
  ]);

module.exports = { withFasterScreenTransitions };
