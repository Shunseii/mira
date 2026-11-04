import { formatQuantity, type Item } from "@mira/shared";
import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "@/theme/ThemeProvider";
import { TAP } from "@/theme/tokens";
import { Icon } from "./Icon";
import { Tap, haptic } from "./Tap";
import { Text } from "./Text";

const Checkbox = ({ checked }: { checked: boolean }) => {
  const { colors } = useTheme();
  const fill = useSharedValue(checked ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, { duration: 180 });
    if (checked) pop.value = withSequence(withSpring(1.18, { stiffness: 600, damping: 12 }), withSpring(1));
  }, [checked, fill, pop]);
  const boxStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.4 + fill.value * 0.6 }] }));
  return (
    <Animated.View style={[styles.checkbox, { borderColor: checked ? colors.accent : colors.ink3 }, boxStyle]}>
      <Animated.View style={[styles.checkFill, { backgroundColor: colors.accent }, fillStyle]}>
        <Icon name="check" size={16} color={colors.onAccent} strokeWidth={3} />
      </Animated.View>
    </Animated.View>
  );
};

type ItemRowProps = {
  item: Item;
  since?: string;
  pending: boolean;
  onToggle: (item: Item) => void;
  onOpen: (item: Item) => void;
};

export const ItemRow = memo(({ item, since, pending, onToggle, onOpen }: ItemRowProps) => {
  const { colors } = useTheme();
  const checked = item.checkedAt !== undefined;
  const quantity = formatQuantity(item);
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Tap
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={item.name}
        pressScale={0.85}
        onPress={() => {
          haptic(checked ? "light" : "select");
          onToggle(item);
        }}
        style={styles.checkTarget}
      >
        <Checkbox checked={checked} />
      </Tap>
      <Tap accessibilityRole="button" accessibilityHint="Opens item details" pressScale={0.99} onPress={() => onOpen(item)} style={styles.body}>
        <View style={styles.label}>
          <Text variant="body" color={checked ? "ink3" : "ink"} numberOfLines={1} style={styles.name}>
            {item.name}
          </Text>
          {since && !checked ? (
            <View style={[styles.tag, { backgroundColor: colors.surface2 }]}>
              <Text variant="tag" color="ink2">
                since {since}
              </Text>
            </View>
          ) : null}
          {pending ? <Icon name="cloud-upload" size={14} color={colors.accent} /> : null}
        </View>
        {quantity ? (
          <Text variant="secondary" color={checked ? "ink3" : "ink2"}>
            {quantity}
          </Text>
        ) : null}
      </Tap>
    </View>
  );
});
ItemRow.displayName = "ItemRow";

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  checkTarget: { width: TAP.row, height: 60, alignItems: "center", justifyContent: "center", marginLeft: -12 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkFill: { position: "absolute", top: -1.5, left: -1.5, right: -1.5, bottom: -1.5, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 4 },
  label: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flexShrink: 1 },
  tag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
});
