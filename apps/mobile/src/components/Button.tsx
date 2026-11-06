import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { TAP } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { SquircleFill } from "./Squircle";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** A disabled button keeps its solid fill and dims only its label (so the + can morph into it). */
export const DISABLED_LABEL_OPACITY = 0.5;
export const BUTTON_RADIUS = 16;

type ButtonProps = {
  label: string;
  onPress: () => void;
  kind?: "primary" | "dark" | "soft";
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Button = ({ label, onPress, kind = "primary", icon, busy, disabled, compact, style }: ButtonProps) => {
  const { colors } = useTheme();
  const background = kind === "primary" ? colors.accent : kind === "dark" ? colors.ink : colors.surface2;
  const foreground = kind === "primary" ? colors.onAccent : kind === "dark" ? colors.bg : colors.ink;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      dimWhenDisabled={false}
      feedback="light"
      style={[styles.base, compact ? styles.compact : styles.full, style]}
    >
      <SquircleFill radius={BUTTON_RADIUS} color={background} />
      {busy ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={[styles.row, disabled ? { opacity: DISABLED_LABEL_OPACITY } : null]}>
          {icon ? <Icon name={icon} size={18} color={foreground} /> : null}
          <Text variant="bodyStrong" style={{ color: foreground }}>
            {label}
          </Text>
        </View>
      )}
    </Tap>
  );
};

/** 44pt round icon button (month arrows, back, settings). */
export const IconButton = ({
  icon,
  onPress,
  label,
  filled = true,
  disabled,
  feedback = "select",
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  filled?: boolean;
  disabled?: boolean;
  feedback?: "select" | "none";
}) => {
  const { colors } = useTheme();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      feedback={feedback}
      pressScale={0.9}
      style={[styles.icon, filled ? { backgroundColor: colors.surface2 } : null]}
    >
      <Icon name={icon} size={20} color={filled ? colors.ink : colors.ink2} />
    </Tap>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  full: { height: TAP.button, alignSelf: "stretch" },
  compact: { height: 48, paddingHorizontal: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  icon: { width: TAP.min, height: TAP.min, borderRadius: TAP.min / 2, alignItems: "center", justifyContent: "center" },
});
