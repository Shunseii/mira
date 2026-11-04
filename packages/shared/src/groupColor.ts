import {
  clampChroma,
  converter,
  differenceEuclidean,
  formatHex,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  parseHex,
  useMode,
  wcagContrast,
  type Oklch,
} from "culori/fn";

useMode(modeRgb);
useMode(modeLrgb);
useMode(modeOklab);
useMode(modeOklch);
const toOklch = converter("oklch");
const oklabDistance = differenceEuclidean("oklab");

/** Solid swatches in the Edit group colour row, in design order. Users can also pick a custom solid. */
export const GROUP_COLOR_PRESETS = [
  { name: "Olive", hex: "#5D7627" },
  { name: "Ochre", hex: "#8D6300" },
  { name: "Teal", hex: "#087C77" },
  { name: "Terracotta", hex: "#AC4A1E" },
  { name: "Indigo", hex: "#5264B6" },
  { name: "Slate", hex: "#5B6F7B" },
  { name: "Plum", hex: "#9E497D" },
  { name: "Forest", hex: "#2A7E4F" },
  { name: "Sky", hex: "#1D73A5" },
  { name: "Rose", hex: "#AD4251" },
  { name: "Cocoa", hex: "#87634A" },
] as const;

/**
 * Gradients are curated only (no custom gradients). They come in sets so
 * seasonal sets can be added later. A group stores the two hexes, not a preset
 * id, so a build that doesn't know a newer set still renders it correctly.
 */
export const GROUP_GRADIENT_SETS = [
  {
    id: "core",
    label: "Gradients",
    presets: [
      { name: "Lagoon", hex: "#087C77", hex2: "#316CB5" },
      { name: "Berry", hex: "#AF3679", hex2: "#A35303" },
      { name: "Meadow", hex: "#547925", hex2: "#087C77" },
      { name: "Dusk", hex: "#5264B6", hex2: "#AD4251" },
      { name: "Ember", hex: "#AC4A1E", hex2: "#8D6300" },
      { name: "Orchid", hex: "#9E497D", hex2: "#5264B6" },
      { name: "Harbor", hex: "#5B6F7B", hex2: "#1D73A5" },
      { name: "Fig", hex: "#87634A", hex2: "#9E497D" },
    ],
  },
] as const;

export type GradientPreset = { name: string; hex: string; hex2: string };

export const GROUP_GRADIENT_PRESETS: readonly GradientPreset[] = GROUP_GRADIENT_SETS.flatMap((set) => set.presets);

/** Token names stored by early builds, before groups stored a hex. */
const LEGACY_TOKENS: Record<string, string> = {
  olive: "#6B7A2E",
  ochre: "#B07D1F",
  teal: "#2D6E68",
  terracotta: "#B4502B",
  indigo: "#4A57A3",
  slate: "#5F6B73",
  plum: "#8E3B6B",
};

const HEX = /^#[0-9a-f]{6}$/i;

/** The stored value as a canonical "#rrggbb", or undefined if absent/unusable. */
export const normalizeGroupColor = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  if (HEX.test(value)) return value.toUpperCase();
  return LEGACY_TOKENS[value];
};

export type Scheme = "light" | "dark";

/**
 * Everything a group colour is drawn with, for one theme. Stored hexes are
 * never rendered directly: each stop keeps its hue (and roughly its chroma),
 * lightness is set per role, and text/icons are nudged until they meet WCAG
 * against every stop they sit on. Solid colours have one stop, gradients two.
 */
export type GroupTone = {
  /** Header chip / value chip background, left to right. */
  tintStops: string[];
  /** Group name drawn on the tint (and on the page background). >= 4.5:1 against every stop. */
  text: string;
  /** Icon drawn on the tint. >= 3:1 against every stop. */
  icon: string;
  /** Round badge (group picker, Groups page) and swatches. */
  badgeStops: string[];
  /** Icon/dot drawn on the badge: white-ish or near-black, whichever reads better on the worse stop. */
  onBadge: string;
};

const LIGHT_ON = "#FFFFFF";
const DARK_ON = "#1A1714";

/**
 * OKLCH lightness/chroma per role, calibrated to the design file's group
 * tokens (e.g. Produce: tint L.93, text L.42, badge L.53 in light; tint L.30,
 * text L.86, badge L.70 in dark). Chroma follows the stored colour, capped.
 */
const ROLE = {
  light: { tintL: 0.935, tintScale: 0.32, tintMax: 0.036, textL: 0.42, textScale: 0.85, textMax: 0.11, iconL: 0.5, iconMax: 0.14, badgeL: 0.53 },
  dark: { tintL: 0.3, tintScale: 0.45, tintMax: 0.05, textL: 0.86, textScale: 0.62, textMax: 0.085, iconL: 0.78, iconMax: 0.12, badgeL: 0.7 },
} as const;

/**
 * Gradients whose two colours sit close in hue (Ember, Harbor) barely read as gradients once both ends
 * share one lightness, so their ends are spread apart in lightness until they differ by at least this
 * much (OKLab distance), and their tints may be a little more colourful than a solid's.
 */
const GRADIENT = {
  light: { tintMinDistance: 0.06, badgeMinDistance: 0.15, tintMax: 0.05 },
  dark: { tintMinDistance: 0.07, badgeMinDistance: 0.15, tintMax: 0.065 },
} as const;
const MAX_GRADIENT_SPREAD = 0.16;

const toHex = ({ l, c, h }: { l: number; c: number; h: number }): string => {
  const color: Oklch = { mode: "oklch", l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h };
  return formatHex(clampChroma(color, "oklch")) ?? "#808080";
};

/** Moves lightness away from `against` until contrast >= `min` (or lightness runs out). */
const nudge = ({
  l,
  c,
  h,
  against,
  min,
  direction,
}: {
  l: number;
  c: number;
  h: number;
  against: string[];
  min: number;
  direction: 1 | -1;
}): string => {
  let lightness = l;
  let hex = toHex({ l: lightness, c, h });
  for (let step = 0; step < 60; step++) {
    if (against.every((other) => wcagContrast(hex, other) >= min)) return hex;
    lightness += direction * 0.01;
    if (lightness <= 0 || lightness >= 1) break;
    hex = toHex({ l: lightness, c, h });
  }
  return hex;
};

type Stop = { l: number; c: number; h: number };

const stopOf = (hex: string): Stop => {
  const parsed = parseHex(hex);
  const color = parsed ? toOklch(parsed) : undefined;
  return { l: color?.l ?? 0.55, c: color?.c ?? 0, h: color?.h ?? 0 };
};

/** Hue to draw text/icons in for a gradient: the circular midpoint of the two stops. */
const midHue = (a: Stop, b: Stop): number => {
  if (a.c < 0.02) return b.h;
  if (b.c < 0.02) return a.h;
  const x = Math.cos((a.h * Math.PI) / 180) + Math.cos((b.h * Math.PI) / 180);
  const y = Math.sin((a.h * Math.PI) / 180) + Math.sin((b.h * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

/**
 * One hex per stop at lightness `l`; for a two-stop gradient the first end gets darker and the last
 * lighter until the ends are at least `minDistance` apart.
 */
const spreadStops = ({ stops, l, chroma, minDistance }: { stops: Stop[]; l: number; chroma: (stop: Stop) => number; minDistance: number }): string[] => {
  const draw = (spread: number) => stops.map((stop, index) => toHex({ l: l + (index === 0 ? -spread : spread) / 2, c: chroma(stop), h: stop.h }));
  let hexes = draw(0);
  if (stops.length < 2) return hexes;
  for (let spread = 0.01; spread <= MAX_GRADIENT_SPREAD; spread += 0.01) {
    if (oklabDistance(hexes[0] as string, hexes[1] as string) >= minDistance) break;
    hexes = draw(spread);
  }
  return hexes;
};

const minContrast = (color: string, others: string[]): number => Math.min(...others.map((other) => wcagContrast(color, other)));

const toneCache = new Map<string, GroupTone>();

/** Cached: tones are pure functions of their inputs and get requested on every render. */
export const groupTone = (args: { hex: string; hex2?: string; scheme: Scheme; pageBackground: string }): GroupTone => {
  const key = `${args.hex}|${args.hex2 ?? ""}|${args.scheme}|${args.pageBackground}`;
  const cached = toneCache.get(key);
  if (cached) return cached;
  const tone = computeGroupTone(args);
  if (toneCache.size > 500) toneCache.clear();
  toneCache.set(key, tone);
  return tone;
};

const computeGroupTone = ({
  hex,
  hex2,
  scheme,
  pageBackground,
}: {
  hex: string;
  /** Second stop; present means the group is a gradient. */
  hex2?: string;
  scheme: Scheme;
  /** The surface group text also appears on directly (e.g. the list background). */
  pageBackground: string;
}): GroupTone => {
  const stops = [stopOf(hex), ...(hex2 ? [stopOf(hex2)] : [])];
  const first = stops[0] as Stop;
  const last = stops[stops.length - 1] as Stop;
  const role = ROLE[scheme];
  const toward = scheme === "light" ? -1 : 1;
  const inkHue = stops.length > 1 ? midHue(first, last) : first.h;
  const inkChroma = Math.min(...stops.map((stop) => stop.c));

  const gradient = GRADIENT[scheme];
  const isGradient = stops.length > 1;
  const tintMax = isGradient ? gradient.tintMax : role.tintMax;
  const tintStops = spreadStops({
    stops,
    l: role.tintL,
    chroma: (stop) => Math.min(stop.c * role.tintScale, tintMax),
    minDistance: gradient.tintMinDistance,
  });
  const text = nudge({
    l: role.textL,
    c: Math.min(inkChroma * role.textScale, role.textMax),
    h: inkHue,
    against: [...tintStops, pageBackground],
    min: 4.5,
    direction: toward,
  });
  const icon = nudge({ l: role.iconL, c: Math.min(inkChroma, role.iconMax), h: inkHue, against: tintStops, min: 3, direction: toward });
  const badgeStops = spreadStops({ stops, l: role.badgeL, chroma: (stop) => stop.c, minDistance: gradient.badgeMinDistance });
  const onBadge = minContrast(LIGHT_ON, badgeStops) >= minContrast(DARK_ON, badgeStops) ? LIGHT_ON : DARK_ON;

  return { tintStops, text, icon, badgeStops, onBadge };
};

export const contrastRatio = (a: string, b: string): number => wcagContrast(a, b);

/** Hex from hue (0-360) and a 0-1 intensity, for the custom colour picker. */
export const hexFromHue = ({ hue, intensity }: { hue: number; intensity: number }): string =>
  toHex({ l: 0.56, c: 0.02 + intensity * 0.16, h: hue });

/** Inverse of hexFromHue, to place the picker handles for an existing colour. */
export const hueOf = (hex: string): { hue: number; intensity: number } => {
  const parsed = parseHex(hex);
  const color = parsed ? toOklch(parsed) : undefined;
  return {
    hue: color?.h ?? 0,
    intensity: Math.min(1, Math.max(0, ((color?.c ?? 0.1) - 0.02) / 0.16)),
  };
};
