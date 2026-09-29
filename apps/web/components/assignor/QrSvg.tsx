"use client";

import { useMemo } from "react";
import { qrModules } from "@/lib/assignor/qr";

/** A QR code drawn as an inline SVG — nothing to host, prints crisply. */
export function QrSvg({ value, size = 200 }: { value: string; size?: number }) {
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

  const quiet = 2;
  const box = count + quiet * 2;

  return (
    <svg
      role="img"
      aria-label="QR code to join this roster"
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      shapeRendering="crispEdges"
      style={{ background: "#fff" }}
    >
      <rect width={box} height={box} fill="#fff" />
      <path d={path} transform={`translate(${quiet} ${quiet})`} fill="#08111C" />
    </svg>
  );
}
