import {
  GROUP_COLOR_PRESETS,
  GROUP_GRADIENT_PRESETS,
  groupTone,
  hexFromHue,
  hueOf,
  isGroupIcon,
  normalizeGroupColor,
  type GroupTone,
} from "@mira/shared";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, memo, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { usePrefs } from "@/data/prefs";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, buildPalette, tint } from "@/theme/tokens";
import { GroupChip, GroupFill } from "./GroupBadge";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";
import { SquircleFill } from "./Squircle";

/** What a group is painted with: nothing, one colour, or a curated two-stop gradient. */
export type Appearance = { color?: string; color2?: string };

const SWATCH = 40;
const RING_OUTSET = 3;
const TRACK_HEIGHT = 28;
const THUMB = 24;

const sameAppearance = (a: Appearance, b: Appearance): boolean => a.color === b.color && (a.color2 ?? undefined) === (b.color2 ?? undefined);

const Divider = () => {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
};

const Swatch = ({
  appearance,
  selected,
  label,
  onPress,
  onSelectedLayout,
}: {
  appearance: Appearance & { color: string };
  selected: boolean;
  label: string;
  onPress: () => void;
  onSelectedLayout?: (x: number) => void;
}) => {
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
      onLayout={selected && onSelectedLayout ? (event) => onSelectedLayout(event.nativeEvent.layout.x) : undefined}
    >
      <GroupFill stops={tone.badgeStops} style={styles.swatch}>
        {selected ? <Icon name="check" size={18} color={tone.onBadge} strokeWidth={3} /> : null}
      </GroupFill>
      {/* An overlay, not a border on the swatch: taking a border off a clipping view on Android blanks its fill. */}
      {selected ? <View pointerEvents="none" style={[styles.selectedGap, { borderColor: colors.bg }]} /> : null}
      {selected ? <View pointerEvents="none" style={[styles.selectedRing, { borderColor: tone.badgeStops[0] }]} /> : null}
    </Tap>
  );
};

/**
 * One horizontally scrolling row (design frame 9): No colour | solids |
 * curated gradients | custom. Swatches show theme-derived shades, never raw hexes.
 */
export const ColorRow = memo(
  ({ value, onChange, onCustom }: { value: Appearance; onChange: (appearance: Appearance) => void; onCustom: () => void }) => {
    const { colors } = useTheme();
    const solids = GROUP_COLOR_PRESETS.map((preset) => ({ appearance: { color: preset.hex as string }, label: preset.name }));
    const gradients = GROUP_GRADIENT_PRESETS.map((preset) => ({
      appearance: { color: preset.hex, color2: preset.hex2 },
      label: `${preset.name} gradient`,
    }));
    const isPreset = [...solids, ...gradients].some((preset) => sameAppearance(preset.appearance, value));
    // A gradient from a newer build's preset list still renders from its two hexes; it's kept, not editable here.
    const keptGradient = value.color && value.color2 && !isPreset ? { color: value.color, color2: value.color2 } : undefined;
    const custom = value.color && !value.color2 && !isPreset ? { color: value.color } : undefined;
    const scroller = useRef<ScrollView>(null);
    const scrolledToSelection = useRef(false);
    // Bring the current colour into view once, when the screen opens.
    const revealSelected = (x: number) => {
      if (scrolledToSelection.current) return;
      scrolledToSelection.current = true;
      scroller.current?.scrollTo({ x: Math.max(0, x - SWATCH * 2), animated: false });
    };

    return (
      <View>
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Room for the selected swatch's ring, which the scroll view would otherwise clip.
          style={styles.ringRoom}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
        >
          <Tap
            accessibilityRole="radio"
            accessibilityState={{ selected: !value.color }}
            accessibilityLabel="No color"
            pressScale={0.88}
            onPress={() => onChange({})}
            style={[styles.swatch, styles.noColor, { borderColor: value.color ? colors.ink3 : colors.ink }]}
          >
            <Icon name="ban" size={18} color={value.color ? colors.ink3 : colors.ink} />
          </Tap>
          <Divider />
          {solids.map((preset) => (
            <Swatch
              key={preset.label}
              appearance={preset.appearance}
              label={preset.label}
              selected={sameAppearance(preset.appearance, value)}
              onPress={() => onChange(preset.appearance)}
              onSelectedLayout={revealSelected}
            />
          ))}
          <Divider />
          {gradients.map((preset) => (
            <Swatch
              key={preset.label}
              appearance={preset.appearance}
              label={preset.label}
              selected={sameAppearance(preset.appearance, value)}
              onPress={() => onChange(preset.appearance)}
              onSelectedLayout={revealSelected}
            />
          ))}
          {keptGradient ? (
            <Swatch
              appearance={keptGradient}
              label="Gradient from a newer version, kept"
              selected
              onPress={() => undefined}
              onSelectedLayout={revealSelected}
            />
          ) : null}
          <Divider />
          {custom ? (
            <Swatch appearance={custom} label="Custom color, tap to edit" selected onPress={onCustom} onSelectedLayout={revealSelected} />
          ) : (
            <Tap
              accessibilityRole="button"
              accessibilityLabel="Custom color"
              feedback="select"
              pressScale={0.88}
              onPress={onCustom}
              style={[styles.swatch, styles.custom, { backgroundColor: colors.surface, borderColor: colors.line }]}
            >
              <Icon name="plus" size={18} color={colors.ink3} />
            </Tap>
          )}
        </ScrollView>
        <LinearGradient
          pointerEvents="none"
          colors={[tint({ color: colors.bg, alpha: 0 }), colors.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.edgeFade}
        />
      </View>
    );
  },
);
ColorRow.displayName = "ColorRow";

/** Horizontal 0..1 slider over a gradient track; drag or tap anywhere. */
const GradientSlider = ({
  colors: stops,
  thumbColor,
  value,
  onChange,
  label,
  valueLabel,
}: {
  colors: string[];
  thumbColor: string;
  value: number;
  onChange: (value: number) => void;
  label: string;
  valueLabel: string;
}) => {
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
    Gesture.Pan()
      .onBegin((event) => update(event.x))
      .onUpdate((event) => update(event.x)),
    Gesture.Tap().onEnd((event) => update(event.x)),
  );
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.value * (width.value - THUMB) }] }));

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderLabels}>
        <Text variant="label" color="ink2">
          {label}
        </Text>
        <Text variant="caption" color="ink3">
          {valueLabel}
        </Text>
      </View>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: valueLabel }}
          onLayout={(event: LayoutChangeEvent) => {
            width.value = event.nativeEvent.layout.width;
          }}
          style={styles.track}
        >
          <LinearGradient
            colors={stops as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View style={[styles.thumb, { backgroundColor: thumbColor }, thumbStyle]} />
        </View>
      </GestureDetector>
    </View>
  );
};

const HUE_STOPS = Array.from({ length: 13 }, (_, i) => hexFromHue({ hue: i * 30, intensity: 0.85 }));

/** How the colour looks in one theme: the list header chip and a group-picker row. */
const ThemePreview = ({ scheme, hex, icon, name }: { scheme: "light" | "dark"; hex: string; icon: string | undefined; name: string }) => {
  const { accent } = usePrefs();
  const palette = buildPalette({ scheme, accent });
  const tone: GroupTone = groupTone({ hex, scheme, pageBackground: palette.bg });
  return (
    <View style={[styles.preview, { backgroundColor: palette.bg, borderColor: palette.line }]}>
      <Text variant="tag" style={{ color: palette.ink3, fontFamily: FONTS.bodyBold }}>
        {scheme === "light" ? "Light" : "Dark"}
      </Text>
      <View style={styles.previewChip}>
        <GroupChip group={{ color: hex, icon }} name={name} tone={tone} />
      </View>
      <GroupFill stops={tone.tintStops} style={styles.previewRow}>
        <GroupFill stops={tone.badgeStops} style={styles.previewBadge}>
          {isGroupIcon(icon) ? (
            <Icon name={icon} size={14} color={tone.onBadge} />
          ) : (
            <View style={[styles.previewDot, { backgroundColor: tone.onBadge }]} />
          )}
        </GroupFill>
        <Text variant="secondary" numberOfLines={1} style={{ color: tone.text, fontFamily: FONTS.bodyBold }}>
          {name}
        </Text>
      </GroupFill>
    </View>
  );
};

/**
 * Custom colour (design frame 9b): solid only. Hue + intensity pick the colour;
 * lightness is always derived per theme, shown live for light and dark.
 */
export const CustomColorSheet = forwardRef<
  SheetRef,
  { initial: string | undefined; name: string; icon: string | undefined; onPick: (color: string) => void }
>(({ initial, name, icon, onPick }, ref) => {
  const { colors } = useTheme();
  const start = useMemo(() => (initial ? hueOf(initial) : { hue: 150, intensity: 0.7 }), [initial]);
  const [hue, setHue] = useState(start.hue);
  const [intensity, setIntensity] = useState(start.intensity);
  const [hexText, setHexText] = useState((initial ?? hexFromHue(start)).toUpperCase());
  useEffect(() => {
    setHue(start.hue);
    setIntensity(start.intensity);
    setHexText((initial ?? hexFromHue(start)).toUpperCase());
  }, [initial, start]);

  const color = normalizeGroupColor(hexText) ?? hexFromHue({ hue, intensity });
  const fromSliders = (next: { hue: number; intensity: number }) => {
    setHue(next.hue);
    setIntensity(next.intensity);
    setHexText(hexFromHue(next).toUpperCase());
  };
  const close = () => {
    if (ref && typeof ref === "object") ref.current?.dismiss();
  };

  return (
    <Sheet
      ref={ref}
      title="Custom color"
      header={
        <View style={styles.sheetHeader}>
          <Tap accessibilityRole="button" onPress={close} style={styles.headerButton}>
            <Text variant="secondary" color="ink2">
              Cancel
            </Text>
          </Tap>
          <Text variant="title" style={styles.sheetTitle}>
            Custom color
          </Text>
          <Tap
            accessibilityRole="button"
            onPress={() => {
              onPick(color);
              close();
            }}
            style={[styles.headerButton, styles.headerEnd]}
          >
            <Text variant="secondary" color="accent" style={{ fontFamily: FONTS.bodyBold }}>
              Done
            </Text>
          </Tap>
        </View>
      }
    >
      <View style={styles.sheetBody}>
        <View style={styles.previews}>
          <ThemePreview scheme="light" hex={color} icon={icon} name={name || "Group"} />
          <ThemePreview scheme="dark" hex={color} icon={icon} name={name || "Group"} />
        </View>
        <View style={styles.hexField}>
          <SquircleFill radius={12} color={colors.surface} stroke={{ color: colors.line, width: 1 }} />
          <View style={[styles.hexDot, { backgroundColor: color }]} />
          <BottomSheetTextInput
            value={hexText}
            onChangeText={(text) => {
              setHexText(text.toUpperCase());
              const parsed = normalizeGroupColor(text.startsWith("#") ? text : `#${text}`);
              if (parsed) {
                const next = hueOf(parsed);
                setHue(next.hue);
                setIntensity(next.intensity);
              }
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            accessibilityLabel="Hex color"
            style={[styles.hexInput, { color: colors.ink }]}
          />
        </View>
        <GradientSlider
          label="Hue"
          valueLabel={`${Math.round(hue)}°`}
          colors={HUE_STOPS}
          thumbColor={color}
          value={hue / 360}
          onChange={(value) => fromSliders({ hue: value * 360, intensity })}
        />
        <GradientSlider
          label="Intensity"
          valueLabel={`${Math.round(intensity * 100)}%`}
          colors={[hexFromHue({ hue, intensity: 0 }), hexFromHue({ hue, intensity: 1 })]}
          thumbColor={color}
          value={intensity}
          onChange={(value) => fromSliders({ hue, intensity: value })}
        />
        <Text variant="caption" color="ink3">
          You pick hue and intensity. Mira sets the lightness for light and dark mode so names stay readable.
        </Text>
      </View>
    </Sheet>
  );
});
CustomColorSheet.displayName = "CustomColorSheet";

const styles = StyleSheet.create({
  row: { alignItems: "center", gap: 12, paddingRight: 32, paddingVertical: RING_OUTSET },
  ringRoom: { marginVertical: -RING_OUTSET },
  swatch: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  selectedRing: {
    position: "absolute",
    top: -RING_OUTSET,
    left: -RING_OUTSET,
    right: -RING_OUTSET,
    bottom: -RING_OUTSET,
    borderRadius: SWATCH / 2 + RING_OUTSET,
    borderWidth: 2,
  },
  selectedGap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: SWATCH / 2, borderWidth: 2.5 },
  noColor: { borderWidth: 1.5 },
  custom: { borderWidth: 1.5, borderStyle: "dashed" },
  divider: { width: 1.5, height: 24, borderRadius: 1 },
  edgeFade: { position: "absolute", right: 0, top: 0, bottom: 0, width: 32 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, paddingBottom: 14 },
  headerButton: { minWidth: 64, height: 44, justifyContent: "center" },
  headerEnd: { alignItems: "flex-end" },
  sheetTitle: { fontSize: 20 },
  sheetBody: { gap: 18, paddingBottom: 8 },
  previews: { flexDirection: "row", gap: 10 },
  preview: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, paddingTop: 10, gap: 10 },
  previewChip: { alignItems: "flex-start", paddingBottom: 8 },
  previewRow: { height: 40, borderRadius: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8, overflow: "hidden" },
  previewBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  hexField: { height: 44, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  hexDot: { width: 18, height: 18, borderRadius: 9 },
  hexInput: { flex: 1, height: "100%", fontFamily: FONTS.bodyBold, fontSize: 14 },
  sliderBlock: { gap: 8 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: "hidden", justifyContent: "center", paddingHorizontal: 2 },
  thumb: { position: "absolute", left: 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, borderWidth: 2.5, borderColor: "#FFFFFF" },
});
