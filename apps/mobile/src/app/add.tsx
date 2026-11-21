import {
  addItem,
  deleteItems,
  formatQuantity,
  isMonthKey,
  lastItemNamed,
  monthName,
  readGroup,
  suggestUnits,
  usuals,
  type MonthKey,
  type Usual,
} from "@mira/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { KeyboardAwareScrollView, KeyboardController, KeyboardEvents, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { BUTTON_RADIUS, Button, IconButton } from "@/components/Button";
import { FabMorph } from "@/components/FabMorph";
import { NameField } from "@/components/NameField";
import { NavBar, NavTitle, useNavScroll } from "@/components/NavBar";
import { ItemFields } from "@/components/ItemFields";
import { Screen } from "@/components/Screen";
import { Tap, haptic, PRESS_DELAY_MS } from "@/components/Tap";
import { Text } from "@/components/Text";
import { UNDO_MS, UndoSnackbar } from "@/components/UndoSnackbar";
import { useCurrentMonth, useHousehold, useStoreQuery } from "@/data/HouseholdProvider";
import { setPrefs, usePref } from "@/data/prefs";
import { useSession } from "@/data/session";
import { goBack } from "@/lib/navigation";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";

const UsualChip = ({ usual, onPress }: { usual: Usual; onPress: () => void }) => {
  const { colors } = useTheme();
  const showUnits = usePref("showUnits");
  const quantity = formatQuantity({ qty: usual.qty, unit: showUnits ? usual.unit : undefined });
  return (
    <Tap
      unstable_pressDelay={PRESS_DELAY_MS}
      accessibilityRole="button"
      accessibilityLabel={`Use ${usual.name}`}
      feedback="select"
      pressScale={0.94}
      onPress={onPress}
      style={[styles.usual, { backgroundColor: colors.surface2 }]}
    >
      <Text variant="secondary" style={{ fontFamily: FONTS.bodyMedium }}>
        {usual.name}
      </Text>
      {quantity ? (
        <Text variant="caption" color="ink2">
          {quantity}
        </Text>
      ) : null}
    </Tap>
  );
};

/**
 * When to check the keyboard came up after opening, and ask again if it didn't. Late enough that a
 * keyboard still on its way has started (asking again earlier cancels it mid-rise).
 */
const KEYBOARD_RETRY_MS = [600];

export default function AddItem() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const household = useHousehold();
  const { userId } = useSession();
  const current = useCurrentMonth();
  const params = useLocalSearchParams<{ month?: string }>();
  // The month the list was showing: where Back returns to, and where the item goes unless changed below.
  const fromMonth = params.month && isMonthKey(params.month) ? params.month : current;
  const [month, setMonth] = useState<MonthKey>(fromMonth);
  const { scrollY, onScroll } = useNavScroll();
  const [name, setName] = useState("");
  const [qty, setQty] = useState<number | undefined>();
  const [unit, setUnit] = useState<string | undefined>();
  const [unitTouched, setUnitTouched] = useState(false);
  const [groupId, setGroupId] = useState<string | undefined>();
  const [groupTouched, setGroupTouched] = useState(false);
  const [note, setNote] = useState("");
  /** With Add multiple, the group the last item went into: the next item's group until a name remembers another. */
  const [carriedGroupId, setCarriedGroupId] = useState<string | undefined>();
  /** The snackbar: "Added X" with Undo for that item, or a plain note. */
  const [notice, setNotice] = useState<{ message: string; undoItemId?: string }>();
  const [footerHeight, setFooterHeight] = useState(0);
  const nameRef = useRef<TextInput>(null);
  const showUnits = usePref("showUnits");
  const keepAdding = usePref("keepAdding");
  const newItems = usePref("newItems");
  const addLabel = `Add to ${monthName(month)}`;
  const stickyOffset = { closed: 0, opened: insets.bottom };

  // The name field autoFocuses so the keyboard rises while the screen grows out of the + button. Android
  // sometimes drops that first keyboard request while the new screen's window is still taking focus, so ask
  // again, but only if no keyboard has started rising: isVisible() is false until the animation ends, and
  // re-focusing then cancels the keyboard mid-rise and starts it over.
  useEffect(() => {
    let keyboardStarted = KeyboardController.isVisible();
    const started = KeyboardEvents.addListener("keyboardWillShow", () => {
      keyboardStarted = true;
    });
    const retries = KEYBOARD_RETRY_MS.map((delay) =>
      setTimeout(() => {
        if (keyboardStarted || KeyboardController.isVisible()) return;
        nameRef.current?.blur();
        nameRef.current?.focus();
      }, delay),
    );
    return () => {
      started.remove();
      retries.forEach(clearTimeout);
    };
  }, []);

  const chips = useStoreQuery((store) => usuals({ store, month, query: name, limit: 8 }), [month, name]);
  const unitHints = useStoreQuery((store) => suggestUnits({ store, name }), [name]);
  const remembered = useStoreQuery((store) => lastItemNamed({ store, name }), [name]);
  const group = useStoreQuery((store) => (groupId ? readGroup({ store, id: groupId }) : undefined), [groupId]);

  // Typing a name you've bought before brings back its unit and group, unless you've picked them.
  useEffect(() => {
    if (!unitTouched) setUnit(unitHints.remembered);
    if (!groupTouched) setGroupId(remembered?.groupId ?? carriedGroupId);
  }, [unitHints.remembered, remembered?.groupId, carriedGroupId, unitTouched, groupTouched]);

  const reset = () => {
    setName("");
    setQty(undefined);
    setUnit(undefined);
    setUnitTouched(false);
    setNote("");
    setCarriedGroupId(groupId);
    setGroupTouched(false);
  };

  const add = ({ andClose }: { andClose: boolean }) => {
    const trimmed = name.trim();
    if (!trimmed || !userId) {
      nameRef.current?.focus();
      return;
    }
    let itemId: string | undefined;
    household.write((store) => {
      itemId = addItem({
        store,
        month,
        userId,
        item: {
          name: trimmed,
          qty: qty === undefined ? undefined : String(qty),
          unit: showUnits ? unit : undefined,
          groupId: group && !group.deletedAt ? groupId : undefined,
          note,
        },
        placement: newItems,
      });
    });
    haptic("success");
    if (andClose) {
      goBack();
      return;
    }
    if (itemId) setNotice({ undoItemId: itemId, message: `Added ${trimmed} to ${monthName(month)}` });
    reset();
    nameRef.current?.focus();
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), UNDO_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const useUsual = (usual: Usual) => {
    setName(usual.name);
    setQty(usual.qty && Number(usual.qty) > 0 ? Number(usual.qty) : undefined);
    setUnit(usual.unit);
    setUnitTouched(true);
    setGroupId(usual.groupId);
    setGroupTouched(true);
  };

  return (
    <FabMorph label={addLabel} labelDimmed={!name.trim()} radius={BUTTON_RADIUS} stickyOffset={stickyOffset}>
      {(morphTarget) => (
        <Screen>
          <View style={styles.flex}>
            <NavBar
              back={{ label: monthName(fromMonth) }}
              title="Add item"
              scrollY={scrollY}
              right={
                <IconButton
                  icon="list-plus"
                  label="Add multiple"
                  on={keepAdding}
                  onPress={() => {
                    setPrefs({ keepAdding: !keepAdding });
                    setNotice({
                      message: keepAdding ? "Add multiple off: back to the list after adding" : "Add multiple on: stays open for the next item",
                    });
                  }}
                />
              }
            />

            <KeyboardAwareScrollView
              mode="layout"
              bottomOffset={FOOTER_SPACE}
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <NavTitle>Add item</NavTitle>
              <NameField
                ref={nameRef}
                autoFocus
                value={name}
                onChangeText={setName}
                placeholder="e.g. Tomatoes"
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={() => add({ andClose: false })}
              />

              {chips.length > 0 ? (
                <Animated.View entering={FadeIn} layout={LinearTransition} style={styles.usuals}>
                  <Text variant="label" color="ink2">
                    Your usuals
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={styles.usualRow}
                  >
                    {chips.map((usual) => (
                      <UsualChip key={usual.name} usual={usual} onPress={() => useUsual(usual)} />
                    ))}
                  </ScrollView>
                </Animated.View>
              ) : null}

              <ItemFields
                value={{ groupId, qty, unit, month, note }}
                onChange={(patch) => {
                  if ("groupId" in patch) {
                    setGroupId(patch.groupId);
                    setGroupTouched(true);
                  }
                  if ("qty" in patch) setQty(patch.qty);
                  if ("unit" in patch) {
                    setUnit(patch.unit);
                    setUnitTouched(true);
                  }
                  if (patch.month) setMonth(patch.month);
                  if (patch.note !== undefined) setNote(patch.note);
                }}
                unitSuggestions={unitHints.suggestions}
              />
            </KeyboardAwareScrollView>

            {/* Its own layer riding the keyboard just above the footer: as the footer's child it would sit
                outside the footer's bounds, where Android doesn't deliver touches (Undo wouldn't work). */}
            {notice ? (
              <KeyboardStickyView offset={stickyOffset} style={[styles.snackbarLayer, { bottom: footerHeight + 8 }]}>
                <UndoSnackbar
                  message={notice.message}
                  onUndo={
                    notice.undoItemId
                      ? () => {
                          const itemId = notice.undoItemId;
                          if (itemId) household.write((store) => deleteItems({ store, itemIds: [itemId] }));
                          setNotice(undefined);
                        }
                      : undefined
                  }
                  onDismiss={() => setNotice(undefined)}
                  bottom={0}
                />
              </KeyboardStickyView>
            ) : null}

            {/* Pinned to the top of the keyboard while it's open, so Add is always reachable. */}
            <KeyboardStickyView
              offset={stickyOffset}
              onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
              style={[styles.footer, { backgroundColor: colors.bg }]}
            >
              {/* The list's + morphs into this button; it shows once the morph lands on it. */}
              <View ref={morphTarget.ref} onLayout={morphTarget.onLayout} collapsable={false} style={morphTarget.visible ? null : styles.hidden}>
                <Button label={addLabel} onPress={() => add({ andClose: !keepAdding })} disabled={!name.trim()} />
              </View>
            </KeyboardStickyView>
          </View>

        </Screen>
      )}
    </FabMorph>
  );
}

/** Room kept under the last form row so it never ends up behind the pinned button. */
const FOOTER_SPACE = 88;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 18 },
  usuals: { gap: 10 },
  usualRow: { gap: 8, paddingRight: 20 },
  usual: { height: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  snackbarLayer: { position: "absolute", left: 0, right: 0, height: 52 },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  hidden: { opacity: 0 },
});
