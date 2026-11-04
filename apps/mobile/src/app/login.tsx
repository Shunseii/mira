import { createUser, liveUsers, type User } from "@mira/shared";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInRight, FadeOutLeft, LinearTransition } from "react-native-reanimated";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Icon } from "@/components/Icon";
import { Screen } from "@/components/Screen";
import { Tap, haptic } from "@/components/Tap";
import { Text } from "@/components/Text";
import { useHouseholdState, useOptionalHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { checkPassword, displayHost, findServer } from "@/data/server";
import { loginStep, updateSession, useSession } from "@/data/session";
import { useTheme } from "@/theme/ThemeProvider";
import { SquircleFill } from "@/components/Squircle";

const defaultServerInput = (): string =>
  Platform.OS === "web" && typeof window !== "undefined" && window.location.protocol.startsWith("http") ? window.location.host : "";

const StepDots = ({ index }: { index: 0 | 1 }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.dots}>
      {[0, 1].map((dot) => (
        <Animated.View
          key={dot}
          layout={LinearTransition.springify()}
          style={[styles.dot, dot === index ? { width: 20, backgroundColor: colors.accent } : { backgroundColor: colors.ink3 }]}
        />
      ))}
    </View>
  );
};

const Hero = ({ step, title }: { step: 0 | 1; title: string }) => (
  <View style={styles.hero}>
    <Text variant="wordmarkHero" color="accent" style={styles.wordmarkEnd}>
      ميرة
    </Text>
    <View style={styles.heroBottom}>
      <StepDots index={step} />
      <Text variant="heading">{title}</Text>
    </View>
  </View>
);

/**
 * Login steps scroll when the keyboard leaves too little room, so the button is
 * always reachable; on tall screens the hero and spacer stretch to fill.
 */
const StepFrame = ({ children }: { children: ReactNode }) => (
  <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.flex}>
    <ScrollView contentContainerStyle={styles.step} keyboardShouldPersistTaps="handled" bounces={false}>
      {children}
    </ScrollView>
  </Animated.View>
);

const ServerStep = () => {
  const [input, setInput] = useState(defaultServerInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const connect = async () => {
    if (!input.trim()) return setError("Enter your server's address");
    setBusy(true);
    setError(undefined);
    const serverUrl = await findServer(input);
    setBusy(false);
    if (!serverUrl) {
      haptic("medium");
      return setError("No Mira server answered there. Check the address and that you're on the same network.");
    }
    updateSession({ serverUrl });
  };

  return (
    <StepFrame>
      <Hero step={0} title="Your server" />
      <Field
        label="Server address"
        icon="server"
        placeholder="mira.home.arpa"
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={connect}
        error={error}
      />
      <View style={styles.spacer} />
      <Button label="Connect" onPress={connect} busy={busy} />
    </StepFrame>
  );
};

const PasswordStep = ({ serverUrl }: { serverUrl: string }) => {
  const { colors } = useTheme();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const unlock = async () => {
    if (!password) return setError("Enter the household password");
    setBusy(true);
    setError(undefined);
    const result = await checkPassword({ serverUrl, password });
    setBusy(false);
    if (result === "ok") {
      haptic("success");
      updateSession({ password });
      return;
    }
    haptic("medium");
    setError(
      result === "wrong"
        ? "That's not the household password"
        : result === "rate_limited"
          ? "Too many tries. Wait a minute and try again."
          : "Can't reach the server right now",
    );
  };

  return (
    <StepFrame>
      <Hero step={1} title="Household password" />
      <View style={styles.hostChip}>
        <SquircleFill radius={14} color={colors.surface2} />
        <Icon name="circle-check" size={16} color={colors.accent} />
        <Text variant="secondary" style={styles.flex} numberOfLines={1}>
          {displayHost(serverUrl)}
        </Text>
        <Tap accessibilityRole="button" onPress={() => updateSession({ serverUrl: null })} style={styles.changeButton}>
          <Text variant="label" color="accent">
            Change
          </Text>
        </Tap>
      </View>
      <Field
        label="Password"
        icon="lock-keyhole"
        secret
        value={password}
        onChangeText={setPassword}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={unlock}
        error={error}
      />
      <View style={styles.spacer} />
      <Button label="Unlock" onPress={unlock} busy={busy} />
    </StepFrame>
  );
};

const lastHere = (user: User): string => {
  if (!user.lastSeenAt) return "New here";
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(user.lastSeenAt).setHours(0, 0, 0, 0)) / 86_400_000);
  return days <= 0 ? "Last here today" : days === 1 ? "Last here yesterday" : `Last here ${days} days ago`;
};

const UserList = () => {
  const { colors } = useTheme();
  const users = useStoreQuery((store) => liveUsers({ store }), []);
  if (users.length === 0) return null;
  return (
    <View style={styles.users}>
      {users.map((user, index) => (
        <Animated.View key={user.id} entering={FadeIn.delay(index * 40)}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`I'm ${user.name}`}
            feedback="select"
            pressScale={0.98}
            onPress={() => updateSession({ userId: user.id })}
            style={styles.userCard}
          >
            <SquircleFill radius={14} color={colors.surface} stroke={{ color: colors.line, width: 1 }} />
            <Avatar name={user.name} seed={user.id} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{user.name}</Text>
              <Text variant="caption" color="ink2">
                {lastHere(user)}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.ink3} />
          </Tap>
        </Animated.View>
      ))}
    </View>
  );
};

const WhoStep = () => {
  const { colors } = useTheme();
  const household = useOptionalHousehold();
  const { ready, hasSynced, status } = useHouseholdState();
  const [name, setName] = useState("");

  const create = () => {
    if (!household || !name.trim()) return;
    let userId = "";
    household.write((store) => {
      userId = createUser({ store, name });
    });
    haptic("success");
    updateSession({ userId });
  };

  const waiting = !ready || (!hasSynced && status === "connecting");

  return (
    <Animated.View entering={FadeInRight} exiting={FadeOutLeft} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.whoContent} keyboardShouldPersistTaps="handled">
        <Text variant="wordmark" color="accent" style={styles.wordmarkEnd}>
          ميرة
        </Text>
        <Text variant="heading">Who's this?</Text>
        {waiting ? (
          <View style={styles.waiting}>
            <ActivityIndicator color={colors.accent} />
            <Text variant="secondary" color="ink2">
              Fetching your household…
            </Text>
          </View>
        ) : household ? (
          <UserList />
        ) : null}
        {!waiting && !hasSynced && status !== "online" ? (
          <Text variant="caption" color="ink2">
            Can't reach the server yet. You can still create yourself; it'll sync later.
          </Text>
        ) : null}
        <View style={[styles.divider, { backgroundColor: colors.line }]} />
        <Text variant="label" color="ink2">
          Someone new
        </Text>
        <View style={styles.newRow}>
          <View style={styles.flex}>
            <Field
              icon="user-round-plus"
              placeholder="Your name"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={create}
              autoCapitalize="words"
            />
          </View>
          <Button label="Create" kind="dark" compact onPress={create} disabled={!household || !name.trim()} style={styles.createButton} />
        </View>
      </ScrollView>
    </Animated.View>
  );
};

export default function Login() {
  const session = useSession();
  const step = loginStep(session);
  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        {step === "server" ? <ServerStep key="server" /> : null}
        {step === "password" && session.serverUrl ? <PasswordStep key="password" serverUrl={session.serverUrl} /> : null}
        {step === "who" ? <WhoStep key="who" /> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  step: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24, gap: 18 },
  hero: { flexGrow: 1, maxHeight: 260, justifyContent: "space-between", gap: 12, marginBottom: 8 },
  heroBottom: { gap: 16 },
  wordmarkEnd: { alignSelf: "flex-end", textAlign: "right" },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  spacer: { flexGrow: 1, minHeight: 12 },
  hostChip: { height: 48, paddingLeft: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  changeButton: { height: 48, paddingHorizontal: 14, justifyContent: "center" },
  whoContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 14 },
  waiting: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16 },
  users: { gap: 10, marginTop: 8 },
  userCard: { minHeight: 72, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 14 },
  divider: { height: 1, marginVertical: 8 },
  newRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  createButton: { height: 56 },
});
