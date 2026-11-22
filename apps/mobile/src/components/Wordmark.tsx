import type { TextStyle } from "react-native";
import { Text } from "./Text";

export type WordmarkVariant = "wordmark" | "wordmarkHero";

/** The ميرة wordmark. */
export const Wordmark = ({ variant = "wordmark", style }: { variant?: WordmarkVariant; style?: TextStyle }) => (
  <Text variant={variant} color="accent" style={style}>
    ميرة
  </Text>
);
