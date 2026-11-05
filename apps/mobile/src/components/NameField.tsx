import { useRef, type ReactNode, type Ref } from "react";
import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { SquircleFill } from "./Squircle";
import { Tap } from "./Tap";
import { Text } from "./Text";

/**
 * The item name as a big tinted card (Add item and editing an item). The whole card is the
 * tap target, so tapping its empty space focuses the input.
 */
export const NameField = ({
  ref,
  children,
  ...input
}: Omit<TextInputProps, "style"> & {
  ref?: Ref<TextInput>;
  /** Shown under the input, inside the card (e.g. Add item's "Added … ✓"). */
  children?: ReactNode;
}) => {
  const { colors } = useTheme();
  const own = useRef<TextInput>(null);
  const setInput = (node: TextInput | null) => {
    own.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <Tap accessibilityRole="none" pressScale={1} onPress={() => own.current?.focus()} style={styles.card}>
      <SquircleFill radius={20} color={colors.accentSoft} />
      <Text variant="label" color="accent">
        Item name
      </Text>
      <TextInput
        ref={setInput}
        accessibilityLabel="Item name"
        numberOfLines={1}
        placeholderTextColor={colors.ink3}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        autoCapitalize="sentences"
        {...input}
        style={[styles.input, { color: colors.ink }]}
      />
      {children}
    </Tap>
  );
};

const styles = StyleSheet.create({
  card: { paddingHorizontal: 20, paddingVertical: 16, gap: 2 },
  input: { fontFamily: FONTS.displayBold, fontSize: 36, lineHeight: 44, minHeight: 48, padding: 0, outlineWidth: 0 },
});
