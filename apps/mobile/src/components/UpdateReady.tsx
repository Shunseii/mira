import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useAppUpdate } from "@/data/appUpdate";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Sheet, type SheetRef } from "./Sheet";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** "Update ready" in the list header, once a new version has downloaded. */
export const UpdatePill = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel="Update ready. Tap to restart Mira"
        onPress={onPress}
        style={[styles.pill, { backgroundColor: colors.accentSoft }]}
      >
        <Icon name="refresh-cw" size={14} color={colors.accent} />
        <Text variant="label">Update ready</Text>
      </Tap>
    </Animated.View>
  );
};

/** Offers to restart into the downloaded update now, or leave it for the next launch. */
export const UpdateSheet = forwardRef<SheetRef>((_, ref) => {
  const { colors } = useTheme();
  const { restart, restarting } = useAppUpdate();
  const sheet = useRef<SheetRef>(null);
  useImperativeHandle(ref, () => sheet.current as SheetRef);
  return (
    <Sheet
      ref={sheet}
      title="A new version is ready"
      header={
        <View style={styles.body}>
          <View style={[styles.iconTile, { backgroundColor: colors.accentSoft }]}>
            <Icon name="refresh-cw" size={24} color={colors.accent} />
          </View>
          <View style={styles.text}>
            <Text variant="heading" style={styles.title}>
              A new version is ready
            </Text>
            <Text variant="option" color="ink2" style={styles.bodyText}>
              Restart Mira to start using it. Your list is saved, so nothing will be lost.
            </Text>
          </View>
          <View style={[styles.note, { borderTopColor: colors.line }]}>
            <Icon name="clock-3" size={16} color={colors.ink2} />
            <Text variant="caption" color="ink2" style={styles.flex}>
              Not a good time? Mira updates by itself the next time you open it.
            </Text>
          </View>
        </View>
      }
    >
      <View style={styles.actions}>
        <Button label="Restart now" onPress={() => void restart()} busy={restarting} />
        <Tap accessibilityRole="button" onPress={() => sheet.current?.dismiss()} style={styles.later}>
          <Text variant="bodyStrong">Later</Text>
        </Tap>
      </View>
    </Sheet>
  );
});
UpdateSheet.displayName = "UpdateSheet";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pill: { height: 30, borderRadius: 15, paddingLeft: 10, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  body: { gap: 16, paddingTop: 10, paddingBottom: 24 },
  iconTile: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  text: { gap: 8 },
  title: { fontSize: 26, lineHeight: 32 },
  bodyText: { lineHeight: 22 },
  note: { flexDirection: "row", gap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  actions: { gap: 6 },
  later: { height: 52, alignItems: "center", justifyContent: "center" },
});
