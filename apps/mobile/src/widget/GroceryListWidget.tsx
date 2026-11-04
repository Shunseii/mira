import { FlexWidget, TextWidget } from "react-native-android-widget";

/**
 * Home-screen widget. Placeholder until the real one (this month's list) is
 * built: it only opens the app. The native side (receiver, sizes, fonts) is
 * already registered, so the full widget can ship as a JS update.
 */
export const GroceryListWidget = () => (
  <FlexWidget
    clickAction="OPEN_APP"
    style={{ height: "match_parent", width: "match_parent", backgroundColor: "#F5F1E8", borderRadius: 24, padding: 16, justifyContent: "center" }}
  >
    <TextWidget text="ميرة" style={{ fontFamily: "NotoNaskhArabic_700Bold", fontSize: 24, color: "#B4502B" }} />
    <TextWidget text="Open your list" style={{ fontFamily: "InstrumentSans_400Regular", fontSize: 14, color: "#6B6358" }} />
  </FlexWidget>
);
