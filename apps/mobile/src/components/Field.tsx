import { forwardRef, useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS, TAP } from "@/theme/tokens";
import { Icon, type IconName } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";

type FieldProps = TextInputProps & {
  label?: string;
  icon?: IconName;
  error?: string;
  secret?: boolean;
};

export const Field = forwardRef<TextInput, FieldProps>(({ label, icon, error, secret, style, onFocus, onBlur, ...input }, ref) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.line;
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" color="ink2">
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor, borderWidth: focused || error ? 1.5 : 1 }]}>
        {icon ? <Icon name={icon} size={20} color={colors.ink3} /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.ink3}
          selectionColor={colors.accent}
          secureTextEntry={secret && !revealed}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: colors.ink }, style]}
          {...input}
        />
        {secret ? (
          <Tap accessibilityLabel={revealed ? "Hide password" : "Show password"} onPress={() => setRevealed((value) => !value)} style={styles.eye}>
            <Icon name={revealed ? "eye-off" : "eye"} size={20} color={colors.ink2} />
          </Tap>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
});
Field.displayName = "Field";

const styles = StyleSheet.create({
  wrap: { gap: 8, alignSelf: "stretch" },
  box: { height: TAP.row, borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, fontFamily: FONTS.body, fontSize: 17, height: "100%", outlineWidth: 0 },
  eye: { width: TAP.min, height: TAP.min, alignItems: "center", justifyContent: "center", marginRight: -10 },
});
