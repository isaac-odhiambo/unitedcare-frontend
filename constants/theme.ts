// constants/theme.ts
// Enterprise-ready design system for the app
// Exports: COLORS, SPACING, RADIUS, FONT, TYPE, SHADOW, P, STATUS, getStatusColors, getMpesaMethodColors

/* =========================================================
   COLORS
========================================================= */
export const COLORS = {
  /* Brand */
  primary: "#0E5E6F",
  primaryDark: "#0A4B59",
  primaryLight: "#D8EEF2",

  /* Added: reusable green secondary for savings / growth / success flows */
  secondary: "#16A34A",
  secondaryDark: "#15803D",
  secondaryLight: "#DCFCE7",
  secondarySoft: "rgba(22, 163, 74, 0.12)",

  accent: "#F28C28",
  accentDark: "#D97706",
  accentLight: "#FFF2E2",

  /* Soft brand backgrounds */
  primarySoft: "rgba(14, 94, 111, 0.12)",
  accentSoft: "rgba(242, 140, 40, 0.14)",

  /* Dashboard helpers */
  dashboardHero: "#0E5E6F",
  dashboardHeroSoft: "#EAF6F8",
  statCardBlue: "#EEF4FF",
  statCardGreen: "#ECFDF3",
  statCardOrange: "#FFF7ED",
  statCardNeutral: "#F8FAFC",

  /* Status */
  success: "#2E7D32",
  successSoft: "rgba(46, 125, 50, 0.12)",

  danger: "#D32F2F",
  dangerSoft: "rgba(211, 47, 47, 0.12)",

  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.14)",

  info: "#2563EB",
  infoSoft: "rgba(37, 99, 235, 0.12)",

  /* M-Pesa */
  mpesa: "#16A34A",
  mpesaDark: "#15803D",
  mpesaLight: "#DCFCE7",
  mpesaSoft: "rgba(22, 163, 74, 0.12)",

  /* Core neutrals */
  white: "#FFFFFF",
  black: "#000000",

  error: "#DC2626",
  errorSoft: "rgba(220, 38, 38, 0.10)",

  dark: "#111827",
  darkSoft: "#1F2937",

  gray: "#6B7280",
  gray600: "#4B5563",
  gray500: "#6B7280",
  gray400: "#9CA3AF",
  gray300: "#D1D5DB",
  gray200: "#E5E7EB",
  gray100: "#F3F4F6",
  gray50: "#F9FAFB",

  lightGray: "#E5E7EB",

  /* UI semantic colors */
  background: "#F8FAFC",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  surfaceAlt: "#F5F7FA",
  surfaceSoft: "#EEF2F6",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  cardBorder: "rgba(15, 23, 42, 0.06)",

  text: "#111827",
  textMuted: "#6B7280",
  textSoft: "#4B5563",
  textInverse: "#FFFFFF",

  placeholder: "#9CA3AF",

  /* Dividers / subtle lines */
  divider: "rgba(17, 24, 39, 0.08)",

  /* Overlay */
  overlay: "rgba(15, 23, 42, 0.06)",
  overlayStrong: "rgba(15, 23, 42, 0.16)",

  /* Payment helper tones */
  paymentSuccessBg: "#F1FAF2",
  paymentWarningBg: "#FFF7E8",
  paymentDangerBg: "#FFF1F2",
};

/* =========================================================
   SPACING
========================================================= */
export const SPACING = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

/* =========================================================
   RADIUS
========================================================= */
export const RADIUS = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
};

/* =========================================================
   FONT
========================================================= */
export const FONT = {
  regular: "System",
  medium: "System",
  semiBold: "System",
  bold: "System",

  title: 24,
  section: 18,
  subtitle: 14,
  body: 16,
  caption: 12,
};

/* =========================================================
   TYPOGRAPHY SCALE
========================================================= */
export const TYPE = {
  h1: {
    fontFamily: FONT.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.text,
  },

  h2: {
    fontFamily: FONT.bold,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.text,
  },

  h3: {
    fontFamily: FONT.semiBold,
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.text,
  },

  title: {
    fontFamily: FONT.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.text,
  },

  body: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.text,
  },

  bodyStrong: {
    fontFamily: FONT.semiBold,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.text,
  },

  subtext: {
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted,
  },

  label: {
    fontFamily: FONT.medium,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textMuted,
    letterSpacing: 0.2,
  },

  caption: {
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.textMuted,
  },

  button: {
    fontFamily: FONT.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.textInverse,
  },

  tab: {
    fontFamily: FONT.medium,
    fontSize: 11,
    lineHeight: 14,
  },

  amountLg: {
    fontFamily: FONT.bold,
    fontSize: 24,
    lineHeight: 30,
    color: COLORS.text,
  },

  amountMd: {
    fontFamily: FONT.bold,
    fontSize: 18,
    lineHeight: 24,
    color: COLORS.text,
  },

  amountSm: {
    fontFamily: FONT.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
};

/* =========================================================
   SHADOWS
========================================================= */
export const SHADOW = {
  card: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  soft: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  strong: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  /* Added: richer shadow for dashboard hero / premium cards */
  hero: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
};

/* =========================================================
   UI PRESETS
========================================================= */
export const P = {
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
  },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  cardSoft: {
    backgroundColor: COLORS.surfaceMuted,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  cardAlt: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  /* Added: dashboard hero preset */
  dashboardHero: {
    backgroundColor: COLORS.dashboardHero,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.hero,
  },

  /* Added: stat card presets for summary tiles */
  statCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  statCardBlue: {
    backgroundColor: COLORS.statCardBlue,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.10)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  statCardGreen: {
    backgroundColor: COLORS.statCardGreen,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.10)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  statCardOrange: {
    backgroundColor: COLORS.statCardOrange,
    borderWidth: 1,
    borderColor: "rgba(242, 140, 40, 0.12)",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  statCardNeutral: {
    backgroundColor: COLORS.statCardNeutral,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  paymentCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  paymentHero: {
    backgroundColor: COLORS.mpesa,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.strong,
  },

  paymentNotice: {
    backgroundColor: COLORS.paymentWarningBg,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.18)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  paymentSuccess: {
    backgroundColor: COLORS.paymentSuccessBg,
    borderWidth: 1,
    borderColor: "rgba(46, 125, 50, 0.18)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  paymentError: {
    backgroundColor: COLORS.paymentDangerBg,
    borderWidth: 1,
    borderColor: "rgba(211, 47, 47, 0.18)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  sectionGap: {
    marginTop: SPACING.lg,
  },

  rowBetween: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },

  rowStart: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },

  /* Added: reusable chips / pills */
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
  },

  chipPrimary: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
  },

  chipSecondary: {
    backgroundColor: COLORS.secondarySoft,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
  },

  chipAccent: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(242, 140, 40, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
  },

  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.text,
  },

  inputError: {
    borderColor: COLORS.danger,
  },

  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...SHADOW.soft,
  },

  /* Added: positive/green action button */
  buttonSuccess: {
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...SHADOW.soft,
  },

  buttonSecondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  buttonMpesa: {
    backgroundColor: COLORS.mpesa,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    ...SHADOW.soft,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  methodCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },

  methodCardActive: {
    backgroundColor: COLORS.mpesaLight,
    borderColor: COLORS.mpesaSoft,
  },
};

/* =========================================================
   STATUS COLORS
========================================================= */
export const STATUS = {
  PENDING: {
    text: COLORS.warning,
    bg: COLORS.warningSoft,
  },
  UNDER_REVIEW: {
    text: COLORS.info,
    bg: COLORS.infoSoft,
  },
  APPROVED: {
    text: COLORS.success,
    bg: COLORS.successSoft,
  },
  REJECTED: {
    text: COLORS.danger,
    bg: COLORS.dangerSoft,
  },
  COMPLETED: {
    text: COLORS.success,
    bg: COLORS.successSoft,
  },
  DEFAULTED: {
    text: COLORS.danger,
    bg: COLORS.dangerSoft,
  },
  CANCELLED: {
    text: COLORS.gray600,
    bg: "rgba(107, 114, 128, 0.12)",
  },
  ACTIVE: {
    text: COLORS.primary,
    bg: COLORS.primarySoft,
  },
  OPEN: {
    text: COLORS.primary,
    bg: COLORS.primarySoft,
  },
  CLOSED: {
    text: COLORS.gray600,
    bg: "rgba(107, 114, 128, 0.12)",
  },
  SUCCESS: {
    text: COLORS.success,
    bg: COLORS.successSoft,
  },
  FAILED: {
    text: COLORS.danger,
    bg: COLORS.dangerSoft,
  },
  PROCESSING: {
    text: COLORS.warning,
    bg: COLORS.warningSoft,
  },
  PAID: {
    text: COLORS.success,
    bg: COLORS.successSoft,
  },
};

/* =========================================================
   OPTIONAL HELPERS
========================================================= */
export function getStatusColors(status?: string) {
  const key = String(status || "").toUpperCase() as keyof typeof STATUS;
  return (
    STATUS[key] || {
      text: COLORS.gray600,
      bg: "rgba(107, 114, 128, 0.12)",
    }
  );
}

export function getMpesaMethodColors(active?: boolean) {
  if (active) {
    return {
      bg: COLORS.mpesaLight,
      border: COLORS.mpesaSoft,
      iconBg: "rgba(22, 163, 74, 0.10)",
      icon: COLORS.mpesa,
      title: COLORS.mpesaDark,
      subtitle: COLORS.textMuted,
    };
  }

  return {
    bg: COLORS.card,
    border: COLORS.cardBorder,
    iconBg: COLORS.gray100,
    icon: COLORS.gray500,
    title: COLORS.text,
    subtitle: COLORS.textMuted,
  };
}

/* =========================================================
   FLAT TYPOGRAPHY / TOKEN ALIASES
========================================================= */
export const FONT_SIZE = {
  h1: TYPE.h1.fontSize,
  h2: TYPE.h2.fontSize,
  h3: TYPE.h3.fontSize,
  title: TYPE.title.fontSize,
  body: TYPE.body.fontSize,
  bodyStrong: TYPE.bodyStrong.fontSize,
  subtext: TYPE.subtext.fontSize,
  label: TYPE.label.fontSize,
  caption: TYPE.caption.fontSize,
  button: TYPE.button.fontSize,
  tab: TYPE.tab.fontSize,
  amountLg: TYPE.amountLg.fontSize,
  amountMd: TYPE.amountMd.fontSize,
  amountSm: TYPE.amountSm.fontSize,
};

export const LINE_HEIGHT = {
  h1: TYPE.h1.lineHeight,
  h2: TYPE.h2.lineHeight,
  h3: TYPE.h3.lineHeight,
  title: TYPE.title.lineHeight,
  body: TYPE.body.lineHeight,
  bodyStrong: TYPE.bodyStrong.lineHeight,
  subtext: TYPE.subtext.lineHeight,
  label: TYPE.label.lineHeight,
  caption: TYPE.caption.lineHeight,
  button: TYPE.button.lineHeight,
  tab: TYPE.tab.lineHeight,
  amountLg: TYPE.amountLg.lineHeight,
  amountMd: TYPE.amountMd.lineHeight,
  amountSm: TYPE.amountSm.lineHeight,
};

export const TEXT_COLOR = {
  h1: TYPE.h1.color,
  h2: TYPE.h2.color,
  h3: TYPE.h3.color,
  title: TYPE.title.color,
  body: TYPE.body.color,
  bodyStrong: TYPE.bodyStrong.color,
  subtext: TYPE.subtext.color,
  label: TYPE.label.color,
  caption: TYPE.caption.color,
  button: TYPE.button.color,
  amountLg: TYPE.amountLg.color,
  amountMd: TYPE.amountMd.color,
  amountSm: TYPE.amountSm.color,
};

/* Flat shadow aliases */
export const CARD_SHADOW = SHADOW.card;
export const SOFT_SHADOW = SHADOW.soft;
export const STRONG_SHADOW = SHADOW.strong;
export const HERO_SHADOW = SHADOW.hero;