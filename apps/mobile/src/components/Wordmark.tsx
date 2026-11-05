import { useRef } from "react";
import { StyleSheet, type Text as RNText, type TextLayoutLine, type TextStyle } from "react-native";
import { splashHandoff, useSplashHandoff, type WordmarkVariant } from "@/lib/splashHandoff";
import { Text } from "./Text";

/**
 * Where the ink of "ميرة" (Noto Naskh Arabic Bold) sits, as fractions of the
 * line's advance width: left from the line start, top from the baseline.
 * Font metrics, measured once, so they hold at any size and font scale.
 */
const INK = { left: 0.0327, top: -0.3843, width: 0.9402, height: 0.5069 };

/**
 * The ميرة wordmark. On launch it stays hidden while SplashOverlay glides the
 * splash wordmark onto it, and tells the overlay where its ink is on screen.
 */
export const Wordmark = ({ variant = "wordmark", style }: { variant?: WordmarkVariant; style?: TextStyle }) => {
  const { done } = useSplashHandoff();
  const text = useRef<RNText>(null);
  const line = useRef<TextLayoutLine>(undefined);

  const publish = () => {
    const measured = line.current;
    if (done || !measured) return;
    text.current?.measureInWindow((x, y, width, height) => {
      const advance = measured.width;
      const baseline = y + measured.y + measured.ascender;
      splashHandoff.setTarget({
        variant,
        box: { x, y, width, height },
        ink: {
          x: x + measured.x + INK.left * advance,
          y: baseline + INK.top * advance,
          width: INK.width * advance,
          height: INK.height * advance,
        },
        textAlign: StyleSheet.flatten(style)?.textAlign === "right" ? "right" : "left",
      });
    });
  };

  return (
    <Text
      ref={text}
      variant={variant}
      color="accent"
      onTextLayout={(event) => {
        line.current = event.nativeEvent.lines[0];
        publish();
      }}
      onLayout={publish}
      style={[style, done ? undefined : styles.hidden]}
    >
      ميرة
    </Text>
  );
};

const styles = StyleSheet.create({ hidden: { opacity: 0 } });
