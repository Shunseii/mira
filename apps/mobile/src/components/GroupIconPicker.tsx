import { groupIconLabel, isGroupIcon, searchGroupIcons, type GroupIcon, type GroupTone } from "@mira/shared";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, PixelRatio, Pressable, Text as RNText, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { FONTS } from "@/theme/tokens";
import { BAN_GLYPH, GROUP_ICON_FONT, GROUP_ICON_GLYPHS } from "./groupIconGlyphs";
import { Icon } from "./Icon";
import { SquircleFill } from "./Squircle";
import { PRESS_DELAY_MS, Tap } from "./Tap";
import { Text } from "./Text";

const GRID_COLUMNS = 6;
const CELL_HEIGHT = 48;
const GRID_GAP = 8;
const ICON_SIZE = 20;
const SEARCH_RADIUS = 12;

type Cell = GroupIcon | "none" | "kept";

/**
 * A grid icon as one character of the Lucide icon font. About 100 of these mount at once,
 * and a single Text is far cheaper than an SVG with several paths each.
 */
const Glyph = ({ glyph, color }: { glyph: string; color: string }) => (
  <RNText allowFontScaling={false} style={[styles.glyph, { color }]}>
    {glyph}
  </RNText>
);

const ALL_ICONS = searchGroupIcons("");

const IconCell = memo(
  ({
    cell,
    width,
    selected,
    tone,
    onChoose,
  }: {
    cell: Cell;
    width: number;
    selected: boolean;
    tone: GroupTone;
    onChoose: (cell: Cell) => void;
  }) => {
    const { colors } = useTheme();
    const isIcon = cell !== "none" && cell !== "kept";
    const label = cell === "none" ? "No icon" : cell === "kept" ? "Icon from a newer version of Mira, kept" : `Icon ${groupIconLabel(cell)}`;
    // A plain Pressable: ~100 of these mount at once, too many for an animated Tap each.
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        unstable_pressDelay={PRESS_DELAY_MS}
        onPress={() => onChoose(cell)}
        style={({ pressed }) => [
          styles.cell,
          { width, backgroundColor: selected && cell !== "none" ? tone.tintStops[0] : colors.surface2 },
          selected ? { borderColor: cell === "none" ? colors.ink2 : tone.icon, borderWidth: 1.5 } : null,
          pressed ? styles.pressed : null,
        ]}
      >
        {cell === "none" ? <Glyph glyph={BAN_GLYPH} color={colors.ink3} /> : null}
        {cell === "kept" ? <View style={[styles.dot, { backgroundColor: tone.icon }]} /> : null}
        {isIcon ? <Glyph glyph={GROUP_ICON_GLYPHS[cell]} color={selected ? tone.icon : colors.ink2} /> : null}
      </Pressable>
    );
  },
);
IconCell.displayName = "IconCell";

/**
 * Searchable grid of group icons (design frames 9 and 9c). `value` is the raw
 * stored key: one from a newer build is shown as kept, and saved back
 * unchanged, until someone picks a different icon.
 */

export const GroupIconPicker = memo(
  ({
    value,
    tone,
    onChange,
    onSearchFocusChange,
    scrollable = true,
    iconsReady = true,
  }: {
    value: string | undefined;
    tone: GroupTone;
    onChange: (icon: string | undefined) => void;
    /** Lets the screen give the grid more room while the search keyboard is up. */
    onSearchFocusChange?: (focused: boolean) => void;
    /** false: the grid takes its full height and the screen scrolls instead. */
    scrollable?: boolean;
    /**
     * false while the screen is still sliding in: tiles are drawn as plain placeholders
     * (only the current icon is real), because mounting ~100 SVG icons stalls the slide.
     */
    iconsReady?: boolean;
  }) => {
    const { colors } = useTheme();
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const scroller = useRef<ScrollView>(null);
    const scrolledToSelection = useRef(false);
    const input = useRef<TextInput>(null);

    // Closing the keyboard (Back, swipe down) ends searching, even though
    // Android leaves the field focused; blur it so the screen restores itself.
    useEffect(() => {
      const subscription = Keyboard.addListener("keyboardDidHide", () => input.current?.blur());
      return () => subscription.remove();
    }, []);
    // Typing stays responsive while the results catch up.
    const deferredQuery = useDeferredValue(query);
    const searching = deferredQuery.trim() !== "";
    const unknown = value !== undefined && !isGroupIcon(value);
    const results = useMemo(() => searchGroupIcons(deferredQuery), [deferredQuery]);
    const browseCells = useMemo<Cell[]>(() => ["none", ...(unknown ? (["kept"] as const) : []), ...ALL_ICONS], [unknown]);
    const isSelected = (cell: Cell) => (cell === "none" ? value === undefined : cell === "kept" ? unknown : value === cell);
    const choose = useCallback(
      (cell: Cell) => {
        if (cell === "kept") return;
        onChange(cell === "none" ? undefined : cell);
      },
      [onChange],
    );

    const [gridWidth, setGridWidth] = useState(0);
    // Rounded down to whole pixels, or six fractional widths can add up to just over the row and wrap the last cell.
    const pixel = PixelRatio.get();
    const cellWidth = gridWidth > 0 ? Math.floor(((gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS) * pixel) / pixel : 0;
    const selectedIndex = browseCells.findIndex((cell) => cell !== "none" && isSelected(cell));

    // Bring the current icon into view once, when the grid first has a size.
    useEffect(() => {
      if (!scrollable || cellWidth === 0 || scrolledToSelection.current) return;
      scrolledToSelection.current = true;
      if (selectedIndex < 0) return;
      const y = Math.floor(selectedIndex / GRID_COLUMNS) * (CELL_HEIGHT + GRID_GAP);
      scroller.current?.scrollTo({ y: Math.max(0, y - 56), animated: false });
    }, [cellWidth, scrollable, selectedIndex]);

    const renderCell = (cell: Cell) => (
      <IconCell key={cell} cell={cell} width={cellWidth} selected={isSelected(cell)} tone={tone} onChoose={choose} />
    );

    return (
      <View style={[styles.wrap, scrollable ? styles.flex : null]}>
        <View style={styles.search}>
          <SquircleFill radius={SEARCH_RADIUS} color={colors.surface} stroke={{ color: focused ? colors.accent : colors.line, width: 1 }} />
          <Icon name="search" size={18} color={colors.ink3} />
          <TextInput
            ref={input}
            value={query}
            onChangeText={setQuery}
            onFocus={() => {
              setFocused(true);
              onSearchFocusChange?.(true);
            }}
            onBlur={() => {
              setFocused(false);
              onSearchFocusChange?.(false);
            }}
            placeholder="Search icons, e.g. milk, bread"
            placeholderTextColor={colors.ink3}
            selectionColor={colors.accent}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.ink }]}
          />
          {searching ? (
            <Tap accessibilityLabel="Clear icon search" onPress={() => setQuery("")} style={styles.clear}>
              <Icon name="x" size={18} color={colors.ink3} />
            </Tap>
          ) : null}
        </View>
        {searching ? (
          <Text variant="caption" color="ink2">
            {results.length === 0
              ? `No icons match “${query.trim()}”`
              : `${results.length} icon${results.length === 1 ? "" : "s"} match “${query.trim()}”`}
          </Text>
        ) : null}
        {unknown && !searching ? (
          <Text variant="caption" color="ink2">
            {"This group's icon was set on a newer version of Mira. It's kept as is; update the app to see it."}
          </Text>
        ) : null}
        <ScrollView
          ref={scroller}
          scrollEnabled={scrollable}
          style={scrollable ? styles.flex : null}
                    keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}>
            {cellWidth > 0 ? (
              <>
                {/* The full grid stays mounted (just hidden) while searching, so clearing the search is instant. */}
                <View style={[styles.grid, searching ? styles.hidden : null]}>
                  {browseCells.map((cell) =>
                    iconsReady || isSelected(cell) ? (
                      renderCell(cell)
                    ) : (
                      <View key={cell} style={[styles.cell, { width: cellWidth, backgroundColor: colors.surface2 }]} />
                    ),
                  )}
                </View>
                {/* Keyed by icon in one wrapping grid, so cells that still match survive each keystroke. */}
                {searching ? <View style={styles.grid}>{results.map(renderCell)}</View> : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </View>
    );
  },
);
GroupIconPicker.displayName = "GroupIconPicker";

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 10 },
  search: { height: 44, paddingLeft: 13, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, height: "100%", fontFamily: FONTS.body, fontSize: 15, outlineWidth: 0 },
  clear: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, paddingBottom: 8 },
  hidden: { display: "none" },
  pressed: { opacity: 0.6 },
  cell: { height: CELL_HEIGHT, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  glyph: { fontFamily: GROUP_ICON_FONT, fontSize: ICON_SIZE, lineHeight: ICON_SIZE, includeFontPadding: false, textAlign: "center" },
});
