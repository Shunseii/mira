import { liveGroups, liveUsers, monthName } from "@mira/shared";
import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Avatar } from "@/components/Avatar";
import { Icon, type IconName } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Tap } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useCurrentMonth, useCurrentUser, useStoreQuery } from "@/data/HouseholdProvider";
import { setPrefs, usePrefs } from "@/data/prefs";
import { displayHost } from "@/data/server";
import { updateSession, useSession } from "@/data/session";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";
import { ACCENTS, buildPalette, type AccentName, type ThemeMode } from "@/theme/tokens";

const ThemeTile = ({ mode, label }: { mode: ThemeMode; label: string }) => {
  const { colors } = useTheme();
  const { themeMode, accent } = usePrefs();
  const selected = themeMode === mode;
  const light = buildPalette({ scheme: "light", accent });
  const dark = buildPalette({ scheme: "dark", accent });
  const preview = (palette: typeof light) => (
    <View style={[styles.preview, { backgroundColor: palette.bg }]}>
      <View style={[styles.previewBar, { backgroundColor: palette.accent, width: 26 }]} />
      <View style={[styles.previewBar, { backgroundColor: palette.ink3 }]} />
      <View style={[styles.previewBar, { backgroundColor: palette.ink3, width: 30 }]} />
    </View>
  );
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} theme`}
      feedback="select"
      onPress={() => setPrefs({ themeMode: mode })}
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: selected ? colors.accent : colors.line, borderWidth: selected ? 2 : 1 }]}
    >
      <View style={styles.previewWrap}>
        {mode === "system" ? (
          <View style={styles.split}>
            <View style={styles.half}>{preview(light)}</View>
            <View style={styles.half}>{preview(dark)}</View>
          </View>
        ) : (
          preview(mode === "dark" ? dark : light)
        )}
      </View>
      <View style={styles.tileLabel}>
        {selected ? <Icon name="circle-check" size={14} color={colors.accent} /> : null}
        <Text variant="caption" color={selected ? "accent" : "ink2"}>
          {label}
        </Text>
      </View>
    </Tap>
  );
};

const Swatch = ({ name }: { name: AccentName }) => {
  const { colors } = useTheme();
  const { accent } = usePrefs();
  const selected = accent === name;
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} accent`}
      feedback="select"
      pressScale={0.88}
      onPress={() => setPrefs({ accent: name })}
      style={[styles.swatchRing, { borderColor: selected ? ACCENTS[name] : "transparent" }]}
    >
      <View style={[styles.swatch, { backgroundColor: ACCENTS[name] }]}>
        {selected ? (
          <Animated.View entering={ZoomIn}>
            <Icon name="check" size={18} color={colors.onAccent} strokeWidth={3} />
          </Animated.View>
        ) : null}
      </View>
    </Tap>
  );
};

const HouseholdRow = ({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) => {
  const { colors } = useTheme();
  const content = (
    <>
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.ink2} />
      <Text variant="body" color={danger ? "danger" : "ink"} style={styles.flex}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" color="ink2" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {onPress && !danger ? <Icon name="chevron-right" size={18} color={colors.ink3} /> : null}
    </>
  );
  const rowStyle = [styles.householdRow, { borderBottomColor: colors.line }];
  return onPress ? (
    <Tap accessibilityRole="button" pressScale={0.99} onPress={onPress} style={rowStyle}>
      {content}
    </Tap>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
};

export default function Settings() {
  const { colors } = useTheme();
  const current = useCurrentMonth();
  const user = useCurrentUser();
  const { serverUrl } = useSession();
  const people = useStoreQuery((store) => liveUsers({ store }).map((person) => person.name), []);
  const groupCount = useStoreQuery((store) => liveGroups({ store }).length, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Tap accessibilityRole="button" onPress={() => goBack()} style={styles.back}>
          <Icon name="chevron-left" size={20} color={colors.accent} />
          <Text variant="bodyStrong" color="accent" style={styles.backLabel}>
            {monthName(current)}
          </Text>
        </Tap>
        <Text variant="heading" style={styles.title}>
          Settings
        </Text>

        <View style={styles.userRow}>
          <Avatar name={user?.name ?? "?"} seed={user?.id ?? "?"} size={44} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{user?.name ?? "Unknown"}</Text>
            <Text variant="caption" color="ink2">
              Signed in on this phone
            </Text>
          </View>
          <Tap accessibilityRole="button" onPress={() => updateSession({ userId: null })} style={[styles.switch, { backgroundColor: colors.surface2 }]}>
            <Text variant="label">Switch</Text>
          </Tap>
        </View>

        <View style={styles.section}>
          <Text variant="eyebrow" color="ink2">
            Customization
          </Text>
          <Text variant="caption" color="ink3">
            Just for you, on this phone. Others keep their own.
          </Text>
        </View>
        <Text variant="label">Appearance</Text>
        <View style={styles.tiles}>
          <ThemeTile mode="light" label="Light" />
          <ThemeTile mode="dark" label="Dark" />
          <ThemeTile mode="system" label="System" />
        </View>
        <Text variant="label">Accent color</Text>
        <View style={styles.swatches}>
          {(Object.keys(ACCENTS) as AccentName[]).map((name) => (
            <Swatch key={name} name={name} />
          ))}
        </View>

        <Text variant="eyebrow" color="ink2" style={styles.section}>
          Household
        </Text>
        <View>
          <HouseholdRow icon="server" label="Server" value={displayHost(serverUrl)} />
          <HouseholdRow icon="users-round" label="People" value={people.join(", ")} />
          <HouseholdRow icon="tags" label="Groups" value={`${groupCount} group${groupCount === 1 ? "" : "s"}`} onPress={() => router.push("/groups")} />
          <HouseholdRow icon="log-out" label="Sign out of this phone" danger onPress={() => updateSession({ password: null, userId: null })} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 14 },
  back: { height: 44, flexDirection: "row", alignItems: "center", gap: 2, marginLeft: -8, alignSelf: "flex-start", paddingRight: 12 },
  backLabel: { fontSize: 15 },
  title: { marginBottom: 6 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  switch: { height: 40, borderRadius: 20, paddingHorizontal: 16, justifyContent: "center" },
  section: { marginTop: 14, gap: 4 },
  tiles: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, borderRadius: 14, padding: 8, gap: 8 },
  previewWrap: { height: 64, borderRadius: 8, overflow: "hidden" },
  preview: { flex: 1, padding: 10, gap: 6 },
  previewBar: { height: 5, width: 40, borderRadius: 3 },
  split: { flex: 1, flexDirection: "row" },
  half: { flex: 1, overflow: "hidden" },
  tileLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 20 },
  swatches: { flexDirection: "row", justifyContent: "space-between" },
  swatchRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  householdRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowValue: { maxWidth: "50%" },
});
