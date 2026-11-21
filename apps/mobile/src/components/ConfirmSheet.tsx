import { forwardRef, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { Sheet, type SheetRef } from "./Sheet";
import { PRESS_DELAY_MS } from "./Tap";
import { Text } from "./Text";

/**
 * Asks before an action that's a nuisance to undo (signing out, switching person). The action runs once
 * the sheet has slid away, so the screen change that follows doesn't cut the sheet off mid-slide.
 */
export const ConfirmSheet = forwardRef<
  SheetRef,
  { title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void }
>(({ title, message, confirmLabel, destructive, onConfirm }, ref) => {
  const sheet = useRef<SheetRef | null>(null);
  const confirmed = useRef(false);
  return (
    <Sheet
      ref={(instance: SheetRef | null) => {
        sheet.current = instance;
        if (typeof ref === "function") ref(instance);
        else if (ref) ref.current = instance;
      }}
      title={title}
      onDismiss={() => {
        if (!confirmed.current) return;
        confirmed.current = false;
        onConfirm();
      }}
    >
      <Text variant="secondary" color="ink2" style={styles.message}>
        {message}
      </Text>
      <View style={styles.actions}>
        <Button
          label={confirmLabel}
          kind={destructive ? "danger" : "dark"}
          pressDelay={PRESS_DELAY_MS}
          onPress={() => {
            confirmed.current = true;
            sheet.current?.dismiss();
          }}
        />
        <Button label="Cancel" kind="soft" pressDelay={PRESS_DELAY_MS} onPress={() => sheet.current?.dismiss()} />
      </View>
    </Sheet>
  );
});
ConfirmSheet.displayName = "ConfirmSheet";

const styles = StyleSheet.create({
  message: { marginTop: -4, marginBottom: 20 },
  actions: { gap: 10 },
});
