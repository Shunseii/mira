import { liveGroups, liveUsers, monthName } from "@mira/shared";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Icon, type IconName } from "@/components/Icon";
import { GroupTile } from "@/components/GroupBadge";
import { GroupLine } from "@/components/ItemRow";
import { Screen } from "@/components/Screen";
import { Tap } from "@/components/Tap";
import { Text } from "@/components/Text";
import { TOGGLE_SLIDE_MS, Toggle } from "@/components/Toggle";
import { useCurrentMonth, useCurrentUser, useStoreQuery } from "@/data/HouseholdProvider";
import { useAppUpdate, type UpdateStatus } from "@/data/appUpdate";
import { setPrefs, usePrefs, type CheckedItems, type GroupLabel } from "@/data/prefs";
import { displayHost } from "@/data/server";
import { updateSession, useSession } from "@/data/session";
import { goBack } from "@/lib/navigation";
import { useAppearanceTransition } from "@/theme/AppearanceTransition";
import { useTheme } from "@/theme/ThemeProvider";
import { ACCENTS, buildPalette, FONTS, type AccentName, type ThemeMode } from "@/theme/tokens";
import { SquircleFill } from "@/components/Squircle";

/** Lets the toggle finish sliding before the pref change re-renders the app (e.g. re-sorting the list behind this screen). */
const APPLY_AFTER_MS = TOGGLE_SLIDE_MS + 40;

/** The group shown in the Group labels previews (design: Settings, Group labels tiles). */
const SAMPLE_GROUP = { name: "Produce", icon: "carrot", color: "#5D7627" };

/** One Group labels choice, previewed as a list row would show it. */
const GroupLabelTile = ({ value, label }: { value: GroupLabel; label: string }) => {
  const { colors } = useTheme();
  const { groupLabel } = usePrefs();
  const selected = groupLabel === value;
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Group labels: ${label}`}
      feedback="select"
      onPress={() => {
        if (!selected) setPrefs({ groupLabel: value });
      }}
      style={styles.tile}
    >
      <SquircleFill radius={TILE_RADIUS} color={colors.surface} stroke={{ color: selected ? colors.accent : colors.line, width: selected ? 2 : 1 }} />
      <View style={styles.labelPreview}>
        <SquircleFill radius={8} color={colors.bg} />
        <View style={styles.labelPreviewName}>
          <Text variant="secondary" color="ink">
            Tomatoes
          </Text>
          {value === "icon" ? <GroupTile group={SAMPLE_GROUP} /> : null}
        </View>
        {value === "name" ? <GroupLine group={SAMPLE_GROUP} /> : null}
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

const CHECKED_ITEMS_OPTIONS: { value: CheckedItems; label: string; description: string }[] = [
  { value: "stay", label: "Stay in place", description: "They keep their spot in the list" },
  { value: "end", label: "Move to the end", description: "They sink to the bottom of their group" },
  { value: "section", label: "Move to a Checked section", description: "Collected at the bottom in one section you can fold away" },
];

const CheckedItemsOption = ({ value, label, description }: { value: CheckedItems; label: string; description: string }) => {
  const { colors } = useTheme();
  const { checkedItems } = usePrefs();
  const selected = checkedItems === value;
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={description}
      feedback="select"
      pressScale={0.99}
      onPress={() => {
        if (!selected) setPrefs({ checkedItems: value });
      }}
      style={styles.optionRow}
    >
      <View style={[styles.radio, selected ? { backgroundColor: colors.accent } : { borderColor: colors.ink3, borderWidth: 1.5 }]}>
        {selected ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <View style={styles.flex}>
        <Text variant="body">{label}</Text>
        <Text variant="caption" color="ink2">
          {description}
        </Text>
      </View>
    </Tap>
  );
};

const PrefToggle = ({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => {
  // The toggle flips at once; the pref follows once it has finished sliding.
  const [pending, setPending] = useState<boolean>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const toggle = (next: boolean) => {
    setPending(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange(next);
      setPending(undefined);
    }, APPLY_AFTER_MS);
  };
  return (
    <View style={styles.toggleRow}>
      <View style={styles.flex}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" color="ink2">
          {description}
        </Text>
      </View>
      <Toggle label={label} value={pending ?? value} onChange={toggle} />
    </View>
  );
};

const ThemeTile = ({ mode, label }: { mode: ThemeMode; label: string }) => {
  const { colors } = useTheme();
  const { themeMode, accent } = usePrefs();
  const selected = themeMode === mode;
  const transition = useAppearanceTransition();
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
      onPress={() => {
        if (!selected) transition(() => setPrefs({ themeMode: mode }));
      }}
      style={styles.tile}
    >
      <SquircleFill radius={TILE_RADIUS} color={colors.surface} stroke={{ color: selected ? colors.accent : colors.line, width: selected ? 2 : 1 }} />
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
  const transition = useAppearanceTransition();
  return (
    <Tap
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name} accent`}
      feedback="select"
      pressScale={0.88}
      onPress={() => {
        if (!selected) transition(() => setPrefs({ accent: name }));
      }}
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

type RowTone = "default" | "action" | "danger";

const SettingsRow = ({
  icon,
  label,
  value,
  onPress,
  tone = "default",
  disabled,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: RowTone;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  const toneColor = tone === "danger" ? "danger" : tone === "action" ? "accent" : "ink";
  const content = (
    <>
      <Icon name={icon} size={18} color={tone === "default" ? colors.ink2 : colors[toneColor]} />
      <Text variant={tone === "action" ? "bodyStrong" : "body"} color={toneColor} style={styles.flex}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" color="ink2" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {onPress && tone === "default" ? <Icon name="chevron-right" size={18} color={colors.ink3} /> : null}
    </>
  );
  const rowStyle = [styles.householdRow, { borderBottomColor: colors.line }];
  return onPress ? (
    <Tap accessibilityRole="button" pressScale={0.99} onPress={onPress} disabled={disabled} style={rowStyle}>
      {content}
    </Tap>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
};

const UPDATE_STATUS_ROWS: Record<Exclude<UpdateStatus, "ready">, { icon: IconName; label: string }> = {
  idle: { icon: "circle-check", label: "Up to date" },
  checking: { icon: "refresh-cw", label: "Checking for updates…" },
  downloading: { icon: "refresh-cw", label: "Downloading update…" },
  failed: { icon: "cloud-off", label: "Couldn't check for updates" },
};

/** Downloaded update waiting for a restart; replaces the status rows. */
const UpdateCard = ({ restarting, onRestart }: { restarting: boolean; onRestart: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.updateCard}>
      <SquircleFill radius={16} color={colors.accentSoft} />
      <View style={styles.updateCardTop}>
        <View style={[styles.updateIconTile, { backgroundColor: colors.accent }]}>
          <Icon name="refresh-cw" size={20} color={colors.onAccent} />
        </View>
        <View style={styles.updateCardText}>
          <Text variant="option" style={styles.updateCardTitle}>
            Update ready
          </Text>
          <Text variant="caption" color="ink2" style={styles.updateCardBody}>
            Downloaded in the background. Restart to use it now, or it&apos;ll apply the next time you open Mira.
          </Text>
        </View>
      </View>
      <Button label="Restart now" onPress={onRestart} busy={restarting} style={styles.updateButton} />
    </View>
  );
};

const AppSection = () => {
  const update = useAppUpdate();
  const statusRow = update.status === "ready" ? undefined : UPDATE_STATUS_ROWS[update.status];
  const busy = update.status === "checking" || update.status === "downloading";
  return (
    <>
      <Text variant="eyebrow" color="ink2" style={styles.section}>
        App
      </Text>
      {update.ready ? <UpdateCard restarting={update.restarting} onRestart={() => void update.restart()} /> : null}
      <View>
        <SettingsRow icon="smartphone" label="Version" value={update.version} />
        {update.enabled && statusRow ? (
          <>
            <SettingsRow
              icon={statusRow.icon}
              label={statusRow.label}
              value={update.status === "failed" ? "Try again later" : busy ? undefined : update.lastCheckedLabel}
            />
            <SettingsRow icon="refresh-cw" label="Check for updates" tone="action" disabled={busy} onPress={() => void update.check()} />
          </>
        ) : null}
      </View>
    </>
  );
};

export default function Settings() {
  const { colors } = useTheme();
  const current = useCurrentMonth();
  const user = useCurrentUser();
  const { serverUrl } = useSession();
  const prefs = usePrefs();
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
          <Tap
            accessibilityRole="button"
            onPress={() => updateSession({ userId: null })}
            style={[styles.switch, { backgroundColor: colors.surface2 }]}
          >
            <Text variant="label">Switch</Text>
          </Tap>
        </View>

        <View style={styles.section}>
          <Text variant="eyebrow" color="ink2">
            Customization
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
        <PrefToggle
          label="Units"
          description="Show units like kg or pack on items"
          value={prefs.showUnits}
          onChange={(value) => setPrefs({ showUnits: value })}
        />
        <View style={styles.choiceText}>
          <Text variant="label">Checked items</Text>
          <Text variant="caption" color="ink2">
            Where items go once they&apos;re checked off.
          </Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Checked items">
          {CHECKED_ITEMS_OPTIONS.map((option) => (
            <CheckedItemsOption key={option.value} {...option} />
          ))}
        </View>
        <View style={styles.choiceText}>
          <Text variant="label">Group labels</Text>
          <Text variant="caption" color="ink2">
            How an item&apos;s group shows when the list is sorted by priority.
          </Text>
        </View>
        <View style={styles.tiles}>
          <GroupLabelTile value="name" label="Full name" />
          <GroupLabelTile value="icon" label="Icon only" />
        </View>

        <AppSection />

        <Text variant="eyebrow" color="ink2" style={styles.section}>
          Household
        </Text>
        <View>
          <SettingsRow icon="server" label="Server" value={displayHost(serverUrl)} />
          <SettingsRow icon="users-round" label="People" value={people.join(", ")} />
          <SettingsRow
            icon="tags"
            label="Groups"
            value={`${groupCount} group${groupCount === 1 ? "" : "s"}`}
            onPress={() => router.push("/groups")}
          />
          <SettingsRow icon="log-out" label="Sign out of this phone" tone="danger" onPress={() => updateSession({ password: null, userId: null })} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const TILE_RADIUS = 14;

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
  tile: { flex: 1, padding: 9, gap: 8 },
  previewWrap: { height: 64, borderRadius: 8, overflow: "hidden" },
  preview: { flex: 1, padding: 10, gap: 6 },
  previewBar: { height: 5, width: 40, borderRadius: 3 },
  split: { flex: 1, flexDirection: "row" },
  half: { flex: 1, overflow: "hidden" },
  labelPreview: { height: 64, paddingHorizontal: 12, justifyContent: "center", gap: 6 },
  labelPreviewName: { flexDirection: "row", alignItems: "center", gap: 6 },
  choiceText: { gap: 2 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 6 },
  radio: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tileLabel: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, height: 20 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  swatches: { flexDirection: "row", justifyContent: "space-between" },
  swatchRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  householdRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowValue: { maxWidth: "50%" },
  updateCard: { padding: 16, gap: 14 },
  updateCardTop: { flexDirection: "row", gap: 12 },
  updateIconTile: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  updateCardText: { flex: 1, gap: 3 },
  updateCardTitle: { fontFamily: FONTS.bodyBold },
  updateCardBody: { fontSize: 14, lineHeight: 19 },
  updateButton: { height: 44 },
});
