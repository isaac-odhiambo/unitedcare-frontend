/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

/**
 * Brand colors (UNITED CARE)
 * Use these everywhere in the app
 */
export const COLORS = {
  primary: "#0A6E8A",   // Blue (trust)
  success: "#2E7D32",   // Green (savings)
  accent: "#F57C00",    // Orange (loans/actions)
  gold: "#FBC02D",      // Money
  white: "#FFFFFF",
  dark: "#1F2937",
  gray: "#9CA3AF",
};

/**
 * Theme-based colors (Light / Dark mode)
 * Used mainly by tabs, backgrounds, text
 */
const tintColorLight = COLORS.primary;
const tintColorDark = COLORS.white;

export const Colors = {
  light: {
    text: "#11181C",
    background: COLORS.white,
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

/**
 * Fonts (cross-platform safe)
 */
export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
