import { monthName, monthYear, type MonthKey } from "@mira/shared";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useAppUpdate } from "@/data/appUpdate";
import { useHouseholdState } from "@/data/HouseholdProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Tap, PRESS_DELAY_MS } from "./Tap";
import { Text } from "./Text";
import { Wordmark } from "./Wordmark";
import { UpdatePill } from "./UpdateReady";

/** How long "Synced" stays up after a sync sends this phone's changes. */
const SYNCED_MS = 2000;
const SPIN_MS = 900;

/** True until `ms` after `at`, then false (re-renders once when it runs out). */
const useStillRecent = ({ at, ms }: { at: number | undefined; ms: number }): boolean => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (at === undefined) return undefined;
    const left = at + ms - Date.now();
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), left);
    return () => clearTimeout(timer);
  }, [at, ms]);
  return at !== undefined && now < at + ms;
};

const Spinner = ({ color }: { color: string }) => {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false));
  }, [turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="refresh-cw" size={14} color={color} />
    </Animated.View>
  );
};

type SyncPillState = "unauthorized" | "offline" | "syncing" | "synced";

/** What the header says about sync, if anything: a problem, a sync you asked for, or a brief "Synced". */
const useSyncPillState = ({ syncing }: { syncing: boolean }): SyncPillState | undefined => {
  const { status, pending, sentAt } = useHouseholdState();
  const justSent = useStillRecent({ at: sentAt, ms: SYNCED_MS });
  const [last, setLast] = useState<SyncPillState>();
  const next = ((): SyncPillState | undefined => {
    if (status === "unauthorized") return "unauthorized";
    if (syncing && pending.length > 0) return "syncing";
    if (status === "offline") return "offline";
    if (status === "online" && justSent) return "synced";
    // Reconnecting (on resume, or a quick retry): keep saying what it said, so the pill doesn't blink.
    if (status === "connecting") return last === "synced" && !justSent ? undefined : last;
    return undefined;
  })();
  if (next !== last) setLast(next);
  return next;
};

const SyncPill = ({ state, onPress }: { state: SyncPillState; onPress: () => void }) => {
  const { colors } = useTheme();
  const { pending } = useHouseholdState();
  const synced = state === "synced";
  const label = {
    unauthorized: "Password changed",
    offline: "Offline",
    syncing: "Syncing",
    synced: "Synced",
  }[state];
  const accessibilityLabel = {
    unauthorized: "Signed out by the server. Tap to sign in again",
    offline: `Offline, ${pending.length} changes waiting to sync. Tap to retry`,
    syncing: `Syncing, ${pending.length} left`,
    synced: "Synced",
  }[state];
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut}>
      <Tap
        unstable_pressDelay={PRESS_DELAY_MS}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
        disabled={state === "syncing" || synced}
        dimWhenDisabled={false}
        onPress={onPress}
        style={[
          styles.pill,
          synced ? { backgroundColor: colors.okSoft, borderColor: colors.okSoft } : { backgroundColor: colors.surface2, borderColor: colors.line },
        ]}
      >
        {state === "syncing" ? (
          <Spinner color={colors.ink2} />
        ) : (
          <Icon
            name={synced ? "check" : "cloud-off"}
            size={14}
            color={synced ? colors.ok : state === "unauthorized" ? colors.danger : colors.ink2}
          />
        )}
        <Text variant="label" style={synced ? { color: colors.ok } : undefined}>
          {label}
        </Text>
        {state === "syncing" ? (
          <Text variant="label" color="ink2" style={styles.pendingLabel}>
            · {pending.length} left
          </Text>
        ) : null}
      </Tap>
    </Animated.View>
  );
};

/** Wordmark, sync status or a ready update (sync wins), and settings. Sits above the month title. */
export const ListTopBar = ({
  syncing,
  onSettings,
  onSyncPill,
  onUpdatePill,
}: {
  /** A sync the person asked for (pull to refresh, tapping the pill) is under way. */
  syncing: boolean;
  onSettings: () => void;
  onSyncPill: () => void;
  onUpdatePill: () => void;
}) => {
  const { colors } = useTheme();
  const { ready: updateReady } = useAppUpdate();
  const syncState = useSyncPillState({ syncing });
  return (
    <View style={styles.topRow}>
      <Wordmark />
      <View style={styles.topRight}>
        {syncState ? <SyncPill key={syncState} state={syncState} onPress={onSyncPill} /> : updateReady ? <UpdatePill onPress={onUpdatePill} /> : null}
        <Tap unstable_pressDelay={PRESS_DELAY_MS} accessibilityRole="button" accessibilityLabel="Settings" onPress={onSettings} style={styles.settings}>
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
      unstable_pressDelay={PRESS_DELAY_MS}
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
      <Text variant="display" color="ink2" style={styles.year}>
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
