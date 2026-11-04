import { monthName, monthYear, type MonthKey } from "@mira/shared";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { useHouseholdState } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { IconButton } from "./Button";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";

/** "Offline · 3 to sync" — only shown when not connected. */
const SyncPill = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useTheme();
  const { status, pending } = useHouseholdState();
  if (status === "online" || status === "connecting") return null;
  const unauthorized = status === "unauthorized";
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={unauthorized ? "Signed out by the server. Tap to sign in again" : `Offline, ${pending.length} changes waiting to sync. Tap to retry`}
        onPress={onPress}
        style={[styles.pill, { backgroundColor: colors.surface2, borderColor: colors.line }]}
      >
        <Icon name="cloud-off" size={14} color={unauthorized ? colors.danger : colors.ink2} />
        <Text variant="label">{unauthorized ? "Password changed" : "Offline"}</Text>
        {!unauthorized && pending.length > 0 ? (
          <Text variant="label" color="ink2" style={styles.pendingLabel}>
            · {pending.length} to sync
          </Text>
        ) : null}
      </Tap>
    </Animated.View>
  );
};

export const ListHeader = ({
  month,
  direction,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
  onSettings,
  onSyncPill,
}: {
  month: MonthKey;
  direction: 1 | -1;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSettings: () => void;
  onSyncPill: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Text variant="wordmark" color="accent">
          ميرة
        </Text>
        <View style={styles.topRight}>
          <SyncPill onPress={onSyncPill} />
          <Tap accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettings} style={styles.settings}>
            <Icon name="settings-2" size={22} color={colors.ink2} />
          </Tap>
        </View>
      </View>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-left" label="Previous month" onPress={onPrevious} disabled={!canGoBack} />
        <Animated.View key={month} entering={direction > 0 ? FadeInDown.duration(220) : FadeInUp.duration(220)} style={styles.monthTitle}>
          <Text variant="display">{monthName(month)}</Text>
          <Text variant="display" color="ink3" style={styles.year}>
            {monthYear(month)}
          </Text>
        </Animated.View>
        <IconButton icon="chevron-right" label="Next month" onPress={onNext} disabled={!canGoForward} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { gap: 14, paddingBottom: 6 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  settings: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  pill: { height: 30, borderRadius: 15, borderWidth: 1, paddingLeft: 10, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  pendingLabel: { fontFamily: FONTS.bodyMedium },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  monthTitle: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  year: { fontFamily: FONTS.displayLight },
});
