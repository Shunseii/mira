import type { WidgetTaskHandler } from "react-native-android-widget";
import { GroceryListWidget } from "./GroceryListWidget";

/** Runs headlessly when Android asks for the widget to be drawn. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, renderWidget }) => {
  if (widgetAction === "WIDGET_ADDED" || widgetAction === "WIDGET_UPDATE" || widgetAction === "WIDGET_RESIZED") {
    renderWidget(<GroceryListWidget />);
  }
};
