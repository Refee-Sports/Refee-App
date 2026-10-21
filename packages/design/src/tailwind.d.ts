type Steps = { DEFAULT: string; 80: string; 60: string; 40: string; 20: string; 10: string };
export declare function tailwindTheme(): {
  colors: {
    paper: string; "paper-2": string; "paper-3": string; chalk: string;
    "dark-paper": string; "dark-paper-2": string; "dark-chalk": string;
    line: { DEFAULT: string; 2: string; 3: string };
    signal: { DEFAULT: string; dark: string; deep: string; tint: string };
    "hi-vis": { DEFAULT: string; dark: string };
    court: { DEFAULT: string; dark: string };
    whistle: { DEFAULT: string; dark: string; ink: string };
    foul: { DEFAULT: string; dark: string };
    "court-ink": { DEFAULT: string; dark: string };
    "foul-ink": { DEFAULT: string; dark: string };
    ink: Steps;
    "ink-inv": Steps;
    "ink-press": string; "hi-vis-press": string; "foul-ink-press": string;
    "chalk-press": string; "signal-tint-press": string;
  };
  borderRadius: { sm: string; md: string; lg: string; full: string };
  boxShadow: Record<string, string>;
  letterSpacing: Record<string, string>;
};
