import "@/lib/polyfills";
import { NotoNaskhArabic_700Bold } from "@expo-google-fonts/noto-naskh-arabic/700Bold";
import { Fraunces_300Light } from "@expo-google-fonts/fraunces/300Light";
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans/400Regular";
import { InstrumentSans_500Medium } from "@expo-google-fonts/instrument-sans/500Medium";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans/600SemiBold";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useFonts } from "expo-font";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { Stack } from "expo-router";
import { GROUP_ICON_FONT } from "@/components/groupIconGlyphs";
import { SplashOverlay } from "@/components/SplashOverlay";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HouseholdProvider, useOptionalHousehold } from "@/data/HouseholdProvider";
import { loginStep, useSession } from "@/data/session";
import { splashHandoff } from "@/lib/splashHandoff";
import { AppearanceTransitionProvider } from "@/theme/AppearanceTransition";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

void SplashScreen.preventAutoHideAsync();

const Navigation = () => {
  const { colors, scheme } = useTheme();
  const signedIn = loginStep(useSession()) === "done";
  const household = useOptionalHousehold();
  // Signed-in screens read the local store, which loads asynchronously from disk.
  // Keep the splash up until it has (a few ms), instead of rendering without data.
  const ready = !signedIn || household !== undefined;

  // SplashOverlay hides the native splash itself once it can stand in for it; without one (web), hide here.
  useEffect(() => {
    if (ready && splashHandoff.get().done) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  useQuickActionRouting();
  useEffect(() => {
    if (Platform.OS === "web") return;
    void QuickActions.setItems(
      signedIn ? [{ id: "add", title: "Add item", icon: Platform.OS === "ios" ? "symbol:plus" : undefined, params: { href: "/add" } }] : [],
    );
  }, [signedIn]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ animation: "fade" }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          {/* The list's + button morphs into this screen's Add button (FabMorph), so no native animation. */}
          <Stack.Screen
            name="add"
            options={{ presentation: "transparentModal", animation: "none", gestureEnabled: false, contentStyle: { backgroundColor: "transparent" } }}
          />
          <Stack.Screen name="item/[id]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="groups/index" />
          <Stack.Screen name="groups/[id]" />
        </Stack.Protected>
      </Stack>
      <SplashOverlay />
    </>
  );
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_300Light,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    NotoNaskhArabic_700Bold,
    [GROUP_ICON_FONT]: require("../../assets/fonts/lucide-group-icons.ttf"),
  });
  if (!fontsLoaded && fontError === null) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <ThemeProvider>
            <HouseholdProvider>
              <AppearanceTransitionProvider>
                <BottomSheetModalProvider>
                  <Navigation />
                </BottomSheetModalProvider>
              </AppearanceTransitionProvider>
            </HouseholdProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
