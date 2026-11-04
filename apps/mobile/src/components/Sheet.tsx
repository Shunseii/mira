import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useEffect, useRef, useState, type ForwardedRef, type ReactNode } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPRING_SNAPPY } from "@/theme/motion";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

export type SheetRef = BottomSheetModal;

const assignRef = <T,>(ref: ForwardedRef<T>, value: T | null) => {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
};

/** Bottom sheet matching the design: rounded surface, grabber, Fraunces title, optional action link. */
export const Sheet = forwardRef<
  BottomSheetModal,
  {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    /** Replaces the default title row (e.g. Cancel · Title · Done). */
    header?: ReactNode;
    children: ReactNode;
    onDismiss?: () => void;
  }
>(({ title, subtitle, action, header, children, onDismiss }, ref) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheetModal | null>(null);
  const [open, setOpen] = useState(false);
  // Android Back closes the sheet rather than the screen under it. Registered only while open, so it
  // runs before the screen's own Back handling (the newest listener runs first).
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      sheet.current?.dismiss();
      return true;
    });
    return () => subscription.remove();
  }, [open]);
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
    [],
  );
  return (
    <BottomSheetModal
      ref={(instance: BottomSheetModal | null) => {
        sheet.current = instance;
        assignRef(ref, instance);
      }}
      onChange={(index) => setOpen(index >= 0)}
      enableDynamicSizing
      maxDynamicContentSize={640}
      backdropComponent={backdrop}
      // Android defaults to a 250 ms timed slide; a spring carries the swipe's release velocity.
      animationConfigs={SPRING_SNAPPY}
      onDismiss={() => {
        setOpen(false);
        onDismiss?.();
      }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: colors.line, width: 36, height: 5 }}
    >
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        {header ?? (
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text variant="heading">{title}</Text>
            {subtitle ? (
              <Text variant="caption" color="ink2">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
        )}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
Sheet.displayName = "Sheet";

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 6, paddingBottom: 12, gap: 12 },
  titles: { flex: 1, gap: 2 },
});
