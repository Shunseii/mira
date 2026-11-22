import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";

/** Room kept under the last form row so it never ends up behind the pinned footer. */
const FOOTER_SPACE = 88;

/** How far the footer sits above the keyboard: flush when closed, clear of the home indicator when open. */
export const useStickyOffset = () => {
  const insets = useSafeAreaInsets();
  return { closed: 0, opened: insets.bottom };
};

/**
 * A form screen: a header, the fields scrolling clear of the keyboard, and a footer (the main button)
 * pinned to the top of the keyboard while it's open, so the button is always reachable.
 */
export const FormScreen = ({
  header,
  children,
  footer,
  overlay,
  contentContainerStyle,
  onScroll,
  onFooterLayout,
}: {
  header: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  /** Drawn between the fields and the footer, e.g. a snackbar riding the keyboard. */
  overlay?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onScroll?: ComponentProps<typeof KeyboardAwareScrollView>["onScroll"];
  onFooterLayout?: (event: LayoutChangeEvent) => void;
}) => {
  const { colors } = useTheme();
  const stickyOffset = useStickyOffset();
  return (
    <Screen>
      <View style={styles.flex}>
        {header}
        <KeyboardAwareScrollView
          mode="layout"
          bottomOffset={FOOTER_SPACE}
          onScroll={onScroll}
          scrollEventThrottle={onScroll ? 16 : undefined}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </KeyboardAwareScrollView>
        {overlay}
        <KeyboardStickyView offset={stickyOffset} onLayout={onFooterLayout} style={[styles.footer, { backgroundColor: colors.bg }]}>
          {footer}
        </KeyboardStickyView>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
});
