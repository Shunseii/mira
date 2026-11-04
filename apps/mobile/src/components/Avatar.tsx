import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ACCENTS, tint } from "@/theme/tokens";
import { Text } from "./Text";

const AVATAR_COLORS = [ACCENTS.terracotta, ACCENTS.olive, ACCENTS.teal, ACCENTS.indigo, ACCENTS.plum, ACCENTS.ochre];

const colorFor = (seed: string): string => {
  let sum = 0;
  for (const char of seed) sum = (sum + (char.codePointAt(0) ?? 0)) % 997;
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? ACCENTS.terracotta;
};

export const Avatar = ({ name, seed, size = 40 }: { name: string; seed: string; size?: number }) => {
  const { scheme } = useTheme();
  const color = colorFor(seed);
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tint({ color, alpha: scheme === "dark" ? 0.3 : 0.16 }) },
      ]}
    >
      <Text variant="title" style={{ color, fontSize: size * 0.45, lineHeight: size * 0.6 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
});
