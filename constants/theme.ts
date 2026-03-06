// Enterprise-ready design system for the app
// Exports: COLORS, SPACING, RADIUS, FONT, SHADOW, P, STATUS

/* =========================================================
   COLORS
========================================================= */
export const COLORS = {
  // Brand
  primary: "#0E5E6F",
  accent: "#F28C28",

  // Brand soft (used for icon badges / subtle highlights)
  primarySoft: "rgba(14, 94, 111, 0.12)",
  accentSoft: "rgba(242, 140, 40, 0.14)",

  // Status
  success: "#2E7D32",
  danger: "#D32F2F",
  warning: "#F59E0B",
  info: "#2563EB",

  // Core neutrals
  white: "#FFFFFF",
  black: "#000000",

  dark: "#111827",
  gray: "#6B7280",
  gray50: "#F9FAFB",
  gray200: "#E5E7EB",
  gray600: "#4B5563",

  lightGray: "#E5E7EB",

  /* UI semantic colors */
  background: "#F9FAFB",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#E5E7EB",

  text: "#111827",
  textMuted: "#6B7280",

  // Dividers / subtle lines
  divider: "rgba(17, 24, 39, 0.08)",

  // Overlay
  overlay: "rgba(0,0,0,0.05)",
};

/* =========================================================
   SPACING
========================================================= */
export const SPACING = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

/* =========================================================
   RADIUS
========================================================= */
export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  round: 999,
};

/* =========================================================
   FONT
========================================================= */
export const FONT = {
  /* Font families */
  regular: "System",
  medium: "System",
  semiBold: "System",
  bold: "System",

  /* Font sizes */
  title: 24,
  section: 18,
  subtitle: 14,
  body: 16,
  caption: 12,
};

/* =========================================================
   SHADOWS
========================================================= */
export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  strong: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/* =========================================================
   UI PRESETS
========================================================= */
export const P = {
  page: COLORS.background,
  bg: COLORS.white,
  card: COLORS.card,
  border: COLORS.border,

  text: COLORS.text,
  subtext: COLORS.textMuted,
};

/* =========================================================
   STATUS COLORS
========================================================= */
export const STATUS = {
  PENDING: COLORS.accent,
  UNDER_REVIEW: COLORS.info,
  APPROVED: COLORS.success,
  REJECTED: COLORS.danger,
  COMPLETED: COLORS.success,
  DEFAULTED: COLORS.danger,
};