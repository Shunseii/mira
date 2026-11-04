import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { usePrefs } from "@/data/prefs";
import { buildPalette, type Palette } from "./tokens";

type Theme = { colors: Palette; scheme: "light" | "dark" };

const ThemeContext = createContext<Theme | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const system = useColorScheme();
  const { themeMode, accent } = usePrefs();
  const scheme = themeMode === "system" ? (system === "dark" ? "dark" : "light") : themeMode;
  const value = useMemo(() => ({ scheme, colors: buildPalette({ scheme, accent }) }), [scheme, accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error("useTheme outside ThemeProvider");
  return theme;
};
