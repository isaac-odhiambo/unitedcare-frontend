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

  accent: "#F28C28",
  accentDark: "#D97706",
  accentLight: "#FFF2E2",

  /* Soft brand backgrounds */
  primarySoft: "rgba(14, 94, 111, 0.12)",
  accentSoft: "rgba(242, 140, 40, 0.14)",

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
  return STATUS[key] || {
    text: COLORS.gray600,
    bg: "rgba(107, 114, 128, 0.12)",
  };
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