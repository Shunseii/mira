import { memo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";

/** Superellipse exponent for the corners; 4 gives a soft, iOS-like curve. */
const EXPONENT = 4;
const STEPS_PER_CORNER = 24;
/** A smooth corner starts curving further from the corner than a circular one of the same radius. */
export const SQUIRCLE_CORNER_EXTENT = 1.5;

/**
 * Rectangle with superellipse corners ("squircle"), as an SVG path, optionally offset to (x, y).
 * Each corner curve spans radius × CORNER_EXTENT, capped at half the shorter side; a square with
 * radius ≥ size / 3 becomes one full superellipse. A worklet, so shapes can morph on the UI thread.
 */
export const squirclePath = ({
  width,
  height,
  radius,
  x = 0,
  y = 0,
  steps = STEPS_PER_CORNER,
}: {
  width: number;
  height: number;
  radius: number;
  x?: number;
  y?: number;
  /** Points per corner: fewer for shapes redrawn every frame. */
  steps?: number;
}): string => {
  "worklet";
  const c = Math.max(0, Math.min(radius * SQUIRCLE_CORNER_EXTENT, width / 2, height / 2));
  const power = 2 / EXPONENT;
  // Corner centres clockwise from top right, with which way each corner's curve bulges.
  const centres = [
    [x + width - c, y + c],
    [x + width - c, y + height - c],
    [x + c, y + height - c],
    [x + c, y + c],
  ];
  let path = "";
  for (let corner = 0; corner < 4; corner++) {
    const [cx, cy] = centres[corner] as [number, number];
    for (let step = 0; step <= steps; step++) {
      const angle = (step / steps) * (Math.PI / 2);
      const cos = Math.cos(angle) ** power;
      const sin = Math.sin(angle) ** power;
      const dx = corner === 0 ? sin : corner === 1 ? cos : corner === 2 ? -sin : -cos;
      const dy = corner === 0 ? -cos : corner === 1 ? sin : corner === 2 ? cos : -sin;
      path += `${path === "" ? "M" : " L"}${(cx + dx * c).toFixed(2)} ${(cy + dy * c).toFixed(2)}`;
    }
  }
  return `${path} Z`;
};

/**
 * A filled (and optionally outlined) squircle behind a view's content; the parent should have
 * no background or border of its own. Pass `size` when it's known up front; otherwise it measures
 * itself, showing a plain rounded rect for that first frame. Android shadows still follow the
 * parent's own outline, so a parent with elevation needs a rounded-rect background slightly inside
 * this shape (see SQUIRCLE_SHADOW_RADIUS).
 */
export const SquircleFill = memo(
  ({
    radius,
    color,
    stroke,
    size,
  }: {
    radius: number;
    color: string;
    stroke?: { color: string; width: number };
    size?: { width: number; height: number };
  }) => {
    const [measured, setMeasured] = useState<{ width: number; height: number }>();
    const frame = size ?? measured;
    const inset = stroke ? stroke.width / 2 : 0;
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          frame ? null : { backgroundColor: color, borderRadius: radius, borderWidth: stroke?.width, borderColor: stroke?.color },
        ]}
        onLayout={size ? undefined : (event) => setMeasured({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      >
        {frame ? (
          <Svg width={frame.width} height={frame.height}>
            <Path
              d={squirclePath({ width: frame.width - inset * 2, height: frame.height - inset * 2, radius: Math.max(0, radius - inset) })}
              transform={inset ? `translate(${inset} ${inset})` : undefined}
              fill={color}
              stroke={stroke?.color}
              strokeWidth={stroke?.width}
            />
          </Svg>
        ) : null}
      </View>
    );
  },
);
SquircleFill.displayName = "SquircleFill";

/** Corner radius (as a share of the size) of a rounded rect that stays inside a square's full superellipse, for casting its shadow. */
export const SQUIRCLE_SHADOW_RADIUS = 0.375;
