import { monthName, monthYear, type MonthKey } from "@mira/shared";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useAppUpdate } from "@/data/appUpdate";
import { useHouseholdState } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Tap } from "./Tap";
import { Text } from "./Text";
import { UpdatePill } from "./UpdateReady";

/** "Offline · 3 to sync", for when not connected. */
const SyncPill = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useTheme();
  const { status, pending } = useHouseholdState();
  const unauthorized = status === "unauthorized";
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <Tap
        accessibilityRole="button"
        accessibilityLabel={
          unauthorized ? "Signed out by the server. Tap to sign in again" : `Offline, ${pending.length} changes waiting to sync. Tap to retry`
        }
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

/** Wordmark, sync status or a ready update (sync wins), and settings. Sits above the month title. */
export const ListTopBar = ({
  onSettings,
  onSyncPill,
  onUpdatePill,
}: {
  onSettings: () => void;
  onSyncPill: () => void;
  onUpdatePill: () => void;
}) => {
  const { colors } = useTheme();
  const { status } = useHouseholdState();
  const { ready: updateReady } = useAppUpdate();
  const syncProblem = status !== "online" && status !== "connecting";
  return (
    <View style={styles.topRow}>
      <Text variant="wordmark" color="accent">
        ميرة
      </Text>
      <View style={styles.topRight}>
        {syncProblem ? <SyncPill onPress={onSyncPill} /> : updateReady ? <UpdatePill onPress={onUpdatePill} /> : null}
        <Tap accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettings} style={styles.settings}>
          <Icon name="settings-2" size={22} color={colors.ink2} />
        </Tap>
      </View>
    </View>
  );
};

/**
 * "November 2026". Tapping the title opens the
 * month picker, and screen readers get previous/next actions.
 */
export const MonthTitle = ({
  month,
  canGoBack,
  canGoForward,
  onStep,
  onOpenPicker,
}: {
  month: MonthKey;
  canGoBack: boolean;
  canGoForward: boolean;
  onStep: (direction: 1 | -1) => void;
  onOpenPicker: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <Tap
      accessibilityRole="adjustable"
      accessibilityLabel={`${monthName(month)} ${monthYear(month)}`}
      accessibilityHint="Double tap to pick a month"
      accessibilityActions={[
        ...(canGoForward ? [{ name: "increment", label: "Next month" }] : []),
        ...(canGoBack ? [{ name: "decrement", label: "Previous month" }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onStep(1);
        if (event.nativeEvent.actionName === "decrement") onStep(-1);
      }}
      pressScale={0.98}
      onPress={onOpenPicker}
      style={styles.monthTitle}
    >
      <Text variant="display">{monthName(month)}</Text>
      <Text variant="display" color="ink3" style={styles.year}>
        {monthYear(month)}
      </Text>
      <View style={styles.chevron}>
        <Icon name="chevrons-up-down" size={18} color={colors.ink3} />
      </View>
    </Tap>
  );
};

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  topRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  settings: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  pill: { height: 30, borderRadius: 15, borderWidth: 1, paddingLeft: 10, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  pendingLabel: { fontFamily: FONTS.bodyMedium },
  monthTitle: { flexDirection: "row", alignItems: "flex-end", gap: 8, alignSelf: "flex-start", minHeight: 44, paddingTop: 10, paddingBottom: 6 },
  year: { fontFamily: FONTS.displayLight },
  chevron: { paddingBottom: 9 },
});
