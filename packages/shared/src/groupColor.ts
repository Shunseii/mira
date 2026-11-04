import {
  clampChroma,
  converter,
  formatHex,
  modeLrgb,
  modeOklch,
  modeRgb,
  parseHex,
  useMode,
  wcagContrast,
  type Oklch,
} from "culori/fn";

useMode(modeRgb);
useMode(modeLrgb);
useMode(modeOklch);
const toOklch = converter("oklch");

/** Starting palette in the Edit group picker. Users can also pick any custom hex. */
export const GROUP_COLOR_PRESETS = [
  { name: "Terracotta", hex: "#B4502B" },
  { name: "Ochre", hex: "#B07D1F" },
  { name: "Olive", hex: "#6B7A2E" },
  { name: "Green", hex: "#3E7B4F" },
  { name: "Teal", hex: "#2D6E68" },
  { name: "Sky", hex: "#2F6E9E" },
  { name: "Indigo", hex: "#4A57A3" },
  { name: "Violet", hex: "#6E4A9E" },
  { name: "Plum", hex: "#8E3B6B" },
  { name: "Rose", hex: "#B04A5A" },
  { name: "Brown", hex: "#7A5A3C" },
  { name: "Slate", hex: "#5F6B73" },
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
      { name: "Sunset", hex: "#B4502B", hex2: "#B07D1F" },
      { name: "Orchard", hex: "#B07D1F", hex2: "#6B7A2E" },
      { name: "Garden", hex: "#6B7A2E", hex2: "#2D6E68" },
      { name: "Lagoon", hex: "#2D6E68", hex2: "#2F6E9E" },
      { name: "Dusk", hex: "#4A57A3", hex2: "#8E3B6B" },
      { name: "Berry", hex: "#8E3B6B", hex2: "#B04A5A" },
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

const LIGHT_ON = "#FFF8F1";
const DARK_ON = "#1E1A16";

const ROLE = {
  light: { tintL: 0.925, tintC: 0.045, textL: 0.47, textC: 0.13, iconL: 0.56, iconC: 0.15, badgeMin: 0.46, badgeMax: 0.62 },
  dark: { tintL: 0.31, tintC: 0.06, textL: 0.86, textC: 0.09, iconL: 0.78, iconC: 0.12, badgeMin: 0.56, badgeMax: 0.7 },
} as const;

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

const minContrast = (color: string, others: string[]): number => Math.min(...others.map((other) => wcagContrast(color, other)));

export const groupTone = ({
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

  const tintStops = stops.map((stop) => toHex({ l: role.tintL, c: Math.min(stop.c * 0.4, role.tintC), h: stop.h }));
  const text = nudge({
    l: role.textL,
    c: Math.min(inkChroma, role.textC),
    h: inkHue,
    against: [...tintStops, pageBackground],
    min: 4.5,
    direction: toward,
  });
  const icon = nudge({ l: role.iconL, c: Math.min(inkChroma, role.iconC), h: inkHue, against: tintStops, min: 3, direction: toward });
  const badgeStops = stops.map((stop) => toHex({ l: Math.min(role.badgeMax, Math.max(role.badgeMin, stop.l)), c: stop.c, h: stop.h }));
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
