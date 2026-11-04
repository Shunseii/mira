import { Text as RNText, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, type Palette } from "@/theme/tokens";

const VARIANTS = {
  hero: { fontFamily: FONTS.displayBold, fontSize: 36, lineHeight: 44 },
  display: { fontFamily: FONTS.display, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: FONTS.displayBold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: FONTS.display, fontSize: 24, lineHeight: 30 },
  body: { fontFamily: FONTS.body, fontSize: 17, lineHeight: 22 },
  bodyStrong: { fontFamily: FONTS.bodyBold, fontSize: 17, lineHeight: 22 },
  secondary: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 20 },
  option: { fontFamily: FONTS.body, fontSize: 16, lineHeight: 21 },
  label: { fontFamily: FONTS.bodyBold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 17 },
  tag: { fontFamily: FONTS.bodyMedium, fontSize: 12, lineHeight: 15 },
  eyebrow: { fontFamily: FONTS.bodyBold, fontSize: 12, lineHeight: 15, letterSpacing: 1.4, textTransform: "uppercase" },
  wordmark: { fontFamily: FONTS.arabic, fontSize: 28, lineHeight: 48, textAlign: "left", alignSelf: "flex-start" },
  wordmarkHero: { fontFamily: FONTS.arabic, fontSize: 60, lineHeight: 104, textAlign: "left", alignSelf: "flex-start" },
} satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof VARIANTS;

export type MiraTextProps = TextProps & {
  variant?: TextVariant;
  color?: keyof Palette;
};

export const Text = ({ variant = "body", color = "ink", style, ...rest }: MiraTextProps) => {
  const { colors } = useTheme();
  return <RNText {...rest} style={[VARIANTS[variant], { color: colors[color] }, style]} />;
};
