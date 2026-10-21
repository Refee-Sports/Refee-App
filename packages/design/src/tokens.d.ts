export declare const light: {
  paper: string; paper2: string; paper3: string; chalk: string;
  ink: string; ink80: string; ink60: string; ink40: string; ink20: string; ink10: string;
  inkInv: string; inkInv80: string; inkInv60: string; inkInv40: string; inkInv20: string; inkInv10: string;
  line: string; line2: string; line3: string;
  signal: string; signalDeep: string; signalTint: string; hiVis: string;
  court: string; courtInk: string; whistle: string; whistleInk: string; foul: string; foulInk: string;
  inkPress: string; hiVisPress: string; foulInkPress: string; chalkPress: string; signalTintPress: string;
};
export type ColorKey = keyof typeof light;
export declare const dark: Partial<Record<ColorKey, string>>;
export declare const radius: { none: number; sm: number; md: number; lg: number; full: number };
export declare const shadow: {
  hard: string; hardSignal: string; hardHivis: string;
  ringHover: string; ringHoverSelected: string; ringFocus: string; glowFieldFocus: string;
};
export declare const letterSpacing: Record<"tightest" | "tighter" | "tight" | "wide" | "wider" | "widest", string>;
export declare const motion: { pressOutMs: number };
export declare function camelize(name: string): string;
export declare function kebab(key: string): string;
