import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

export type SheetRef = BottomSheetModal;

/** Bottom sheet matching the design: rounded surface, grabber, Fraunces title, optional action link. */
export const Sheet = forwardRef<
  BottomSheetModal,
  { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; onDismiss?: () => void }
>(({ title, subtitle, action, children, onDismiss }, ref) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />,
    [],
  );
  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      maxDynamicContentSize={640}
      backdropComponent={backdrop}
      onDismiss={onDismiss}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: colors.line, width: 36, height: 5 }}
    >
      <BottomSheetScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
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
