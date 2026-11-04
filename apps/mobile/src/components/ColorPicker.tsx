import { GROUP_COLOR_PRESETS, GROUP_GRADIENT_PRESETS, groupTone, hexFromHue, hueOf } from "@mira/shared";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { GroupChip, GroupFill } from "./GroupBadge";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** What a group is painted with: nothing, one colour, or a two-stop gradient. */
export type Appearance = { color?: string; color2?: string };

const TRACK_HEIGHT = 36;
const THUMB = 32;

/** Horizontal 0..1 slider over a gradient track; big thumb, drag or tap anywhere. */
const GradientSlider = ({ colors, value, onChange, label }: { colors: string[]; value: number; onChange: (value: number) => void; label: string }) => {
  const { colors: palette } = useTheme();
  const width = useSharedValue(0);
  const position = useSharedValue(value);
  useEffect(() => {
    position.value = value;
  }, [value, position]);

  const update = (x: number) => {
    "worklet";
    if (width.value <= 0) return;
    const next = Math.min(1, Math.max(0, x / width.value));
    position.value = next;
    scheduleOnRN(onChange, next);
  };
  const gesture = Gesture.Simultaneous(
    Gesture.Pan().onBegin((event) => update(event.x)).onUpdate((event) => update(event.x)),
    Gesture.Tap().onEnd((event) => update(event.x)),
  );
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * width.value - THUMB / 2 }] }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        onLayout={(event: LayoutChangeEvent) => {
          width.value = event.nativeEvent.layout.width;
        }}
        style={styles.track}
      >
        <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient} />
        <Animated.View style={[styles.thumb, { borderColor: palette.surface }, thumbStyle]} />
      </View>
    </GestureDetector>
  );
};

const HUE_STOPS = Array.from({ length: 13 }, (_, i) => hexFromHue({ hue: i * 30, intensity: 1 }));

/** Custom colour, solid only (gradients are curated presets). Hue + intensity; lightness is derived per theme. */
export const CustomColorSheet = forwardRef<SheetRef, { initial: string | undefined; name: string; icon: string | undefined; onPick: (color: string) => void }>(
  ({ initial, name, icon, onPick }, ref) => {
    const [picked, setPicked] = useState(() => (initial ? hueOf(initial) : { hue: 150, intensity: 0.6 }));
    useEffect(() => {
      if (initial) setPicked(hueOf(initial));
    }, [initial]);

    const color = hexFromHue(picked);
    const intensityStops = [hexFromHue({ hue: picked.hue, intensity: 0 }), hexFromHue({ hue: picked.hue, intensity: 1 })];

    return (
      <Sheet ref={ref} title="Custom color" subtitle="Pick a hue. Mira adjusts brightness for light and dark mode.">
        <View style={styles.sheetBody}>
          <View style={styles.previewRow}>
            <GroupChip group={{ color, icon }} name={name || "Group"} />
          </View>
          <Text variant="label" color="ink2">
            Hue
          </Text>
          <GradientSlider label="Hue" colors={HUE_STOPS} value={picked.hue / 360} onChange={(value) => setPicked((previous) => ({ ...previous, hue: value * 360 }))} />
          <Text variant="label" color="ink2">
            Intensity
          </Text>
          <GradientSlider label="Intensity" colors={intensityStops} value={picked.intensity} onChange={(value) => setPicked((previous) => ({ ...previous, intensity: value }))} />
          <Button
            label="Use this color"
            onPress={() => {
              onPick(color);
              if (ref && typeof ref === "object") ref.current?.dismiss();
            }}
          />
        </View>
      </Sheet>
    );
  },
);
CustomColorSheet.displayName = "CustomColorSheet";

const sameAppearance = (a: Appearance, b: Appearance): boolean => a.color === b.color && a.color2 === b.color2;

const Swatch = ({ appearance, selected, label, onPress }: { appearance: Required<Pick<Appearance, "color">> & Appearance; selected: boolean; label: string; onPress: () => void }) => {
  const { colors, scheme } = useTheme();
  const tone = groupTone({ hex: appearance.color, hex2: appearance.color2, scheme, pageBackground: colors.bg });
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      feedback="select"
      pressScale={0.88}
      onPress={onPress}
      style={[styles.ring, { borderColor: selected ? tone.badgeStops[0] : "transparent" }]}
    >
      <GroupFill stops={tone.badgeStops} style={styles.swatch}>
        {selected ? <Icon name="check" size={16} color={tone.onBadge} strokeWidth={3} /> : null}
      </GroupFill>
    </Tap>
  );
};

/** Presets (solid row, gradient row) + "none" + custom. Swatches show theme-derived shades, never raw hexes. */
export const ColorSwatches = ({ value, onChange, onCustom }: { value: Appearance; onChange: (appearance: Appearance) => void; onCustom: () => void }) => {
  const { colors } = useTheme();
  const presets: { appearance: Appearance & { color: string }; label: string }[] = [
    ...GROUP_COLOR_PRESETS.map((preset) => ({ appearance: { color: preset.hex }, label: preset.name })),
    ...GROUP_GRADIENT_PRESETS.map((preset) => ({ appearance: { color: preset.hex, color2: preset.hex2 }, label: `${preset.name} gradient` })),
  ];
  const isPreset = presets.some((preset) => sameAppearance(preset.appearance, value));
  // A gradient this build doesn't list (e.g. a newer seasonal set) is shown as selected but isn't editable here.
  const unknownGradient = value.color && value.color2 && !isPreset ? { color: value.color, color2: value.color2 } : undefined;
  const custom = value.color && !value.color2 && !isPreset ? { color: value.color } : undefined;

  return (
    <View style={styles.block}>
      <View style={styles.swatches}>
        <Tap
          accessibilityRole="radio"
          accessibilityState={{ selected: !value.color }}
          accessibilityLabel="No color"
          onPress={() => onChange({})}
          style={[styles.ring, { borderColor: !value.color ? colors.ink2 : "transparent" }]}
        >
          <View style={[styles.swatch, { borderWidth: 1.5, borderColor: colors.ink3 }]}>
            <Icon name="ban" size={16} color={colors.ink3} />
          </View>
        </Tap>
        {presets
          .filter((preset) => !preset.appearance.color2)
          .map((preset) => (
            <Swatch key={preset.label} appearance={preset.appearance} label={preset.label} selected={sameAppearance(preset.appearance, value)} onPress={() => onChange(preset.appearance)} />
          ))}
      </View>
      <View style={styles.swatches}>
        {presets
          .filter((preset) => preset.appearance.color2)
          .map((preset) => (
            <Swatch key={preset.label} appearance={preset.appearance} label={preset.label} selected={sameAppearance(preset.appearance, value)} onPress={() => onChange(preset.appearance)} />
          ))}
        {unknownGradient ? <Swatch appearance={unknownGradient} label="Gradient from a newer version, kept" selected onPress={() => undefined} /> : null}
        {custom ? (
          <Swatch appearance={custom} label="Custom color" selected onPress={onCustom} />
        ) : (
          <Tap accessibilityRole="button" accessibilityLabel="Custom color" feedback="select" pressScale={0.88} onPress={onCustom} style={[styles.ring, { borderColor: "transparent" }]}>
            <LinearGradient colors={HUE_STOPS.slice(0, 12) as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch}>
              <Icon name="plus" size={16} color="#FFFFFF" strokeWidth={3} />
            </LinearGradient>
          </Tap>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: { gap: 4 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  ring: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sheetBody: { gap: 12, paddingBottom: 8 },
  previewRow: { alignItems: "flex-start", paddingVertical: 4 },
  track: { height: TRACK_HEIGHT + 12, justifyContent: "center" },
  gradient: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2 },
  thumb: { position: "absolute", left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 4, backgroundColor: "transparent", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
});
