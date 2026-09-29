import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { qrModules } from "@/lib/assignor/qr";

/** A QR code drawn with react-native-svg — no image to host, works offline. */
export function RosterQr({ value, size = 220 }: { value: string; size?: number }) {
  const { path, count } = useMemo(() => {
    const rows = qrModules(value);
    let d = "";
    rows.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, count: rows.length };
  }, [value]);

  const quiet = 2; // quiet zone, in modules
  const box = count + quiet * 2;

  return (
    <View
      accessible
      accessibilityLabel="QR code to join this roster"
      style={{ width: size, height: size, backgroundColor: "#FFFFFF", padding: 0 }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${box} ${box}`}>
        <Rect x={0} y={0} width={box} height={box} fill="#FFFFFF" />
        <Path d={path} transform={`translate(${quiet} ${quiet})`} fill="#08111C" />
      </Svg>
    </View>
  );
}
