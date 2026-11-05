import { PixelRatio } from "react-native";

export type ThemeMode = "light" | "dark" | "system";

export const ACCENTS = {
  terracotta: "#B4502B",
  olive: "#6B7A2E",
  teal: "#2D6E68",
  indigo: "#4A57A3",
  plum: "#8A3D68",
  ochre: "#C48716",
} as const;

export type AccentName = keyof typeof ACCENTS;

export const isAccentName = (value: string | null | undefined): value is AccentName =>
  value !== null && value !== undefined && value in ACCENTS;

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  danger: string;
  /** Large destructive fills (the swipe-to-delete panel): calmer than `danger` text in dark mode. */
  dangerFill: string;
  onDangerFill: string;
  scrim: string;
};

const LIGHT_BASE = {
  bg: "#F5F1E8",
  surface: "#FFFDF8",
  surface2: "#ECE5D7",
  ink: "#221E19",
  ink2: "#6B6358",
  ink3: "#A39A8C",
  line: "#E2D9C9",
  onAccent: "#FFF8F1",
  danger: "#B4502B",
  dangerFill: "#B4502B",
  onDangerFill: "#FFF8F1",
  scrim: "rgba(34,30,25,0.35)",
};

const DARK_BASE = {
  bg: "#1E1A16",
  surface: "#27221D",
  surface2: "#3A332B",
  ink: "#F2EBDD",
  ink2: "#B9AE9E",
  ink3: "#7E7468",
  line: "#352E27",
  onAccent: "#FFF8F1",
  danger: "#E07A52",
  dangerFill: "#6E3220",
  onDangerFill: "#F6DCCD",
  scrim: "rgba(0,0,0,0.55)",
};

const hexToRgb = (hex: string): [number, number, number] => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Blends `color` over `base`; amount 0 = base, 1 = color. */
export const mix = ({ color, base, amount }: { color: string; base: string; amount: number }): string => {
  const [r1, g1, b1] = hexToRgb(color);
  const [r2, g2, b2] = hexToRgb(base);
  const channel = (a: number, b: number) => Math.round(b + (a - b) * amount).toString(16).padStart(2, "0");
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
};

/** Translucent tint, e.g. group icon backgrounds (design uses ~12% alpha). */
export const tint = ({ color, alpha }: { color: string; alpha: number }): string => {
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const buildPalette = ({ scheme, accent }: { scheme: "light" | "dark"; accent: AccentName }): Palette => {
  const base = scheme === "dark" ? DARK_BASE : LIGHT_BASE;
  const accentHex = ACCENTS[accent];
  const accentColor = scheme === "dark" ? mix({ color: "#FFFFFF", base: accentHex, amount: 0.12 }) : accentHex;
  return {
    ...base,
    accent: accentColor,
    accentSoft: mix({ color: accentHex, base: base.bg, amount: scheme === "dark" ? 0.28 : 0.16 }),
  };
};

export const FONTS = {
  display: "Fraunces_500Medium",
  displayLight: "Fraunces_300Light",
  displayBold: "Fraunces_600SemiBold",
  body: "InstrumentSans_400Regular",
  bodyMedium: "InstrumentSans_500Medium",
  bodyBold: "InstrumentSans_600SemiBold",
  arabic: "NotoNaskhArabic_700Bold",
} as const;

/** Minimum touch target; the design uses 44pt circles and 56pt rows/buttons. */
export const TAP = { min: 44, row: 56, button: 56 } as const;

/**
 * Height for list separators drawn as absolutely positioned views. Exactly one physical pixel can round
 * to zero when a row ends on a half pixel (60 dp is 157.5 px at 2.625x), which made lines vanish at
 * random; 1.5 px always rounds to one or two.
 */
export const SEPARATOR_HEIGHT = 1.5 / PixelRatio.get();
