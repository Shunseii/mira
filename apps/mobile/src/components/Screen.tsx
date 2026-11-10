import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

// Pads with the provider's insets instead of a native SafeAreaView: on iOS the native view
// measures its own on-screen frame, which reads zero top inset inside Add's morphing modal.
export const Screen = ({
  children,
  edges = ["top", "bottom"],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };
  return (
    <View style={[styles.screen, padding, { backgroundColor: colors.bg }]}>
      <View style={[styles.content, style]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
});
