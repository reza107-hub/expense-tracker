/**
 * Every colour in the app. Screens never write a colour themselves: they read this file
 * through `useColors()`. Values match the web app's theme variables (globals.css).
 */
export const palette = {
  light: {
    background: "#f9fafb",
    foreground: "#121921",
    card: "#ffffff",
    cardForeground: "#121921",
    muted: "#eef0f3",
    mutedForeground: "#5c646f",
    border: "#dbdee2",
    input: "#dbdee2",
    ring: "#009b69",
    primary: "#007f56",
    primaryForeground: "#f9fafb",
    accent: "#e0f0e8",
    accentForeground: "#043726",
    success: "#1c8742",
    successForeground: "#f9fafb",
    warning: "#da950b",
    warningForeground: "#2f1e02",
    destructive: "#d42325",
    destructiveForeground: "#f9fafb",
    chart1: "#00996b",
    chart2: "#288dd4",
    chart3: "#da950b",
    chart4: "#bb4cb5",
    chart5: "#d73431",
    overlay: "#00000066",
  },
  dark: {
    background: "#0a0e12",
    foreground: "#eff2f5",
    card: "#12161c",
    cardForeground: "#eff2f5",
    muted: "#1d2228",
    mutedForeground: "#989fa8",
    border: "#282e36",
    input: "#282e36",
    ring: "#22b988",
    primary: "#0bc18d",
    primaryForeground: "#04160e",
    accent: "#142f24",
    accentForeground: "#c7f0dc",
    success: "#51c672",
    successForeground: "#041608",
    warning: "#f0b135",
    warningForeground: "#271700",
    destructive: "#fc5855",
    destructiveForeground: "#fff6f5",
    chart1: "#0bc18d",
    chart2: "#56acf0",
    chart3: "#f0b135",
    chart4: "#de79d7",
    chart5: "#ff645f",
    overlay: "#000000aa",
  },
} as const;

export type Colors = { [K in keyof typeof palette.dark]: string };

/** Version one ships dark only, like the website. Switching is one line here. */
const ACTIVE: keyof typeof palette = "dark";

export const colors: Colors = palette[ACTIVE];

export function useColors(): Colors {
  return colors;
}

export const radius = 12;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
