// app/(tabs)/loans/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getLoanEligibilityPreview,
  getMyGuaranteeRequests,
  getMyLoans,
  Loan,
  LoanEligibilityPreview,
  LoanGuarantor,
} from "@/services/loans";
import {
  canRequestLoan,
  getMe,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

const UI = {
  page: "#062C49",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.72)",

  mint: "#8CF0C7",
  aqua: "#0CC0B7",
  careGreen: "#197D71",

  glassStrong: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.12)",

  supportCard: "rgba(52, 198, 191, 0.22)",
  supportBorder: "rgba(195, 255, 250, 0.16)",
  supportIconBg: "rgba(236, 255, 252, 0.76)",
  supportIcon: "#148C84",

  successCard: "rgba(98, 192, 98, 0.23)",
  successBorder: "rgba(194, 255, 188, 0.16)",
  successIconBg: "rgba(236, 255, 235, 0.76)",
  successIcon: "#379B4A",

  infoCard: "rgba(49, 180, 217, 0.22)",
  infoBorder: "rgba(189, 244, 255, 0.15)",
  infoIconBg: "rgba(236, 251, 255, 0.76)",
  infoIcon: "#0A6E8A",

  warningCard: "rgba(255, 204, 102, 0.16)",
  warningBorder: "rgba(255, 220, 140, 0.18)",
  warningIconBg: "rgba(255, 247, 224, 0.88)",
  warningIcon: "#B7791F",

  dangerCard: "rgba(220,53,69,0.18)",
};

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getStatusLabel(status?: string | null) {
  if (!status) return "Unknown";
  const value = String(status).replaceAll("_", " ").trim().toLowerCase();
  return value.replace(/\b\w/g, (m) => m.toUpperCase());
}

function getPrimaryLoan(loans: Loan[]) {
  if (!Array.isArray(loans) || loans.length === 0) return null;

  const byStatus = (statuses: string[]) =>
    loans.find((loan) =>
      statuses.includes(String(loan?.status || "").toUpperCase())
    ) || null;

  return (
    byStatus(["PENDING"]) ||
    byStatus(["UNDER_REVIEW"]) ||
    byStatus(["APPROVED", "ACTIVE", "DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"]) ||
    null
  );
}

function getTonePalette(tone: "support" | "success" | "info" | "warning") {
  const map = {
    support: {
      card: UI.supportCard,
      border: UI.supportBorder,
      iconBg: UI.supportIconBg,
      icon: UI.supportIcon,
    },
    success: {
      card: UI.successCard,
      border: UI.successBorder,
      iconBg: UI.successIconBg,
      icon: UI.successIcon,
    },
    info: {
      card: UI.infoCard,
      border: UI.infoBorder,
      iconBg: UI.infoIconBg,
      icon: UI.infoIcon,
    },
    warning: {
      card: UI.warningCard,
      border: UI.warningBorder,
      iconBg: UI.warningIconBg,
      icon: UI.warningIcon,
    },
  };

  return map[tone];
}

function HeroCard({
  title,
  amount,
  subtitle,
  status,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  amount: string;
  subtitle: string;
  status?: string | null;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroOrbOne} />
      <View style={styles.heroOrbTwo} />
      <View style={styles.heroOrbThree} />

      <View style={styles.heroTopRow}>
        <View style={styles.heroBadge}>
          <Ionicons name="heart-outline" size={14} color="#FFFFFF" />
          <Text style={styles.heroBadgeText}>MEMBER SUPPORT</Text>
        </View>

        {status ? (
          <View style={styles.heroStatusChip}>
            <Text style={styles.heroStatusChipText}>
              {getStatusLabel(status).toUpperCase()}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroAmount}>{amount}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>

      <View style={styles.heroActions}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPrimary}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </TouchableOpacity>

        {secondaryLabel && onSecondary ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onSecondary}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  actionLabel,
  onPress,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: "support" | "success" | "info" | "warning";
  actionLabel?: string;
  onPress?: () => void;
}) {
  const palette = getTonePalette(tone);

  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={styles.summaryTopRow}>
        <View style={[styles.summaryIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>

      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summarySubtitle}>{subtitle}</Text>

      {actionLabel && onPress ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPress}
          style={styles.inlineLink}
        >
          <Text style={styles.inlineLinkText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color="#DFFFE8" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ActionItem({
  title,
  subtitle,
  icon,
  onPress,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.actionItem}
    >
      <View style={styles.actionLeft}>
        <View style={styles.actionIconWrap}>
          <Ionicons name={icon} size={18} color={UI.supportIcon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.actionRight}>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={UI.textSoft} />
      </View>
    </TouchableOpacity>
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoanUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState<LoanGuarantor[]>([]);
  const [eligibility, setEligibility] = useState<LoanEligibilityPreview | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, loansRes, guaranteesRes, eligibilityRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyLoans(),
          getMyGuaranteeRequests(),
          getLoanEligibilityPreview(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LoanUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      setLoans(
        loansRes.status === "fulfilled" && Array.isArray(loansRes.value)
          ? loansRes.value
          : []
      );

      setGuaranteeRequests(
        guaranteesRes.status === "fulfilled" && Array.isArray(guaranteesRes.value)
          ? guaranteesRes.value
          : []
      );

      setEligibility(
        eligibilityRes.status === "fulfilled"
          ? eligibilityRes.value ?? null
          : null
      );

      let nextError = "";

      if (meRes.status === "rejected") {
        nextError =
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
      } else if (loansRes.status === "rejected") {
        nextError =
          getApiErrorMessage(loansRes.reason) || getErrorMessage(loansRes.reason);
      } else if (guaranteesRes.status === "rejected") {
        nextError =
          getApiErrorMessage(guaranteesRes.reason) ||
          getErrorMessage(guaranteesRes.reason);
      } else if (eligibilityRes.status === "rejected") {
        nextError =
          getApiErrorMessage(eligibilityRes.reason) ||
          getErrorMessage(eligibilityRes.reason);
      }

      setError(nextError);
    } catch (e: any) {
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openLoanDetail = useCallback((loan?: Loan | null) => {
    const loanId = Number(loan?.id ?? 0);
    if (!loanId) return;

    router.push({
      pathname: "/(tabs)/loans/[id]" as any,
      params: { id: String(loanId) },
    });
  }, []);

  const openLoanDeposit = useCallback((loan?: Loan | null) => {
    const loanId = Number(loan?.id ?? 0);
    const borrowerUserId = Number(loan?.borrower ?? 0);

    if (!loanId || !borrowerUserId) return;

    router.push({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        title: "Support Repayment",
        source: "loan",
        purpose: "LOAN_REPAYMENT",
        loanId: String(loanId),
        borrowerUserId: String(borrowerUserId),
        reference: `loan${borrowerUserId}`,
        narration: `Loan repayment for borrower #${borrowerUserId} (Loan #${loanId})`,
        amount: "",
        editableAmount: "true",
        returnTo: ROUTES.dynamic.loanDetail(loanId),
      },
    });
  }, []);

  const kycComplete = isKycComplete(user);
  const loanAllowed = canRequestLoan(user);
  const primaryLoan = useMemo(() => getPrimaryLoan(loans), [loans]);
  const primaryStatus = String(primaryLoan?.status || "").toUpperCase();

  const guaranteeCount = useMemo(() => {
    return guaranteeRequests.filter((item) => !item.accepted).length;
  }, [guaranteeRequests]);

  const canRequestSupport = Boolean(kycComplete && loanAllowed && eligibility?.eligible);

  const heroState = useMemo(() => {
    if (primaryLoan) {
      if (primaryStatus === "PENDING") {
        return {
          title: "Support request pending",
          amount: fmtKES(primaryLoan.principal || 0),
          subtitle: "Your request has been received and is waiting for review.",
          primaryLabel: "Open request",
          secondaryLabel: "Past activity",
        };
      }

      if (primaryStatus === "UNDER_REVIEW") {
        return {
          title: "Support under review",
          amount: fmtKES(primaryLoan.principal || 0),
          subtitle: "Your request is being reviewed. Check details for updates.",
          primaryLabel: "Open request",
          secondaryLabel: "Past activity",
        };
      }

      return {
        title: "My support",
        amount: fmtKES(primaryLoan.outstanding_balance || 0),
        subtitle: "Your support is active. This is your current remaining balance.",
        primaryLabel: "Pay now",
        secondaryLabel: "View details",
      };
    }

    if (!kycComplete) {
      return {
        title: "Complete profile",
        amount: "Profile required",
        subtitle: "Finish profile verification first before requesting support.",
        primaryLabel: "Complete profile",
        secondaryLabel: "Past activity",
      };
    }

    if (canRequestSupport) {
      return {
        title: "Support available",
        amount: fmtKES(eligibility?.max_allowed || 0),
        subtitle: "You are eligible to request support.",
        primaryLabel: "Ask for support",
        secondaryLabel: "Past activity",
      };
    }

    return {
      title: "Member support",
      amount: "No active support",
      subtitle: eligibility?.reason || "Review your latest support information and continue below.",
      primaryLabel: "Open history",
      secondaryLabel: guaranteeCount > 0 ? "Member requests" : undefined,
    };
  }, [primaryLoan, primaryStatus, kycComplete, canRequestSupport, eligibility, guaranteeCount]);

  const handleHeroPrimary = useCallback(() => {
    if (primaryLoan) {
      if (
        ["APPROVED", "ACTIVE", "DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"].includes(
          primaryStatus
        )
      ) {
        openLoanDeposit(primaryLoan);
        return;
      }

      openLoanDetail(primaryLoan);
      return;
    }

    if (!kycComplete) {
      router.push(ROUTES.tabs.profileKyc as any);
      return;
    }

    if (canRequestSupport) {
      router.push(ROUTES.tabs.loansRequest as any);
      return;
    }

    router.push(ROUTES.tabs.loansHistory as any);
  }, [
    primaryLoan,
    primaryStatus,
    kycComplete,
    canRequestSupport,
    openLoanDeposit,
    openLoanDetail,
  ]);

  const handleHeroSecondary = useCallback(() => {
    if (primaryLoan) {
      if (["PENDING", "UNDER_REVIEW"].includes(primaryStatus)) {
        router.push(ROUTES.tabs.loansHistory as any);
        return;
      }

      openLoanDetail(primaryLoan);
      return;
    }

    if (guaranteeCount > 0) {
      router.push(ROUTES.tabs.loansGuarantees as any);
      return;
    }

    router.push(ROUTES.tabs.loansHistory as any);
  }, [primaryLoan, primaryStatus, guaranteeCount, openLoanDetail]);

  const summaryCards = useMemo(() => {
    const cards: Array<{
      title: string;
      value: string;
      subtitle: string;
      icon: keyof typeof Ionicons.glyphMap;
      tone: "support" | "success" | "info" | "warning";
      actionLabel?: string;
      onPress?: () => void;
    }> = [];

    if (primaryLoan) {
      if (primaryStatus === "PENDING") {
        cards.push({
          title: "Pending request",
          value: fmtKES(primaryLoan.principal || 0),
          subtitle: "Waiting for review.",
          icon: "hourglass-outline",
          tone: "warning",
          actionLabel: "Open",
          onPress: () => openLoanDetail(primaryLoan),
        });
      } else if (primaryStatus === "UNDER_REVIEW") {
        cards.push({
          title: "Under review",
          value: fmtKES(primaryLoan.principal || 0),
          subtitle: "Your request is in progress.",
          icon: "search-outline",
          tone: "info",
          actionLabel: "Open",
          onPress: () => openLoanDetail(primaryLoan),
        });
      } else {
        cards.push({
          title: "Current balance",
          value: fmtKES(primaryLoan.outstanding_balance || 0),
          subtitle: getStatusLabel(primaryLoan.status),
          icon: "wallet-outline",
          tone: "success",
          actionLabel: "Details",
          onPress: () => openLoanDetail(primaryLoan),
        });
      }
    } else {
      cards.push({
        title: "Available support",
        value: canRequestSupport
          ? fmtKES(eligibility?.max_allowed || 0)
          : "Not ready",
        subtitle:
          !kycComplete
            ? "Complete profile first."
            : canRequestSupport
              ? "Ready to request."
              : eligibility?.reason || "Check eligibility.",
        icon: !kycComplete ? "person-circle-outline" : "checkmark-circle-outline",
        tone: !kycComplete ? "info" : "success",
        actionLabel:
          !kycComplete
            ? "Profile"
            : canRequestSupport
              ? "Request"
              : undefined,
        onPress:
          !kycComplete
            ? () => router.push(ROUTES.tabs.profileKyc as any)
            : canRequestSupport
              ? () => router.push(ROUTES.tabs.loansRequest as any)
              : undefined,
      });
    }

    cards.push({
      title: "Member requests",
      value: String(guaranteeCount),
      subtitle: "Waiting for your response.",
      icon: "people-outline",
      tone: "support",
      actionLabel: "Open",
      onPress: () => router.push(ROUTES.tabs.loansGuarantees as any),
    });

    return cards.slice(0, 2);
  }, [
    primaryLoan,
    primaryStatus,
    kycComplete,
    canRequestSupport,
    eligibility,
    guaranteeCount,
    openLoanDetail,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={UI.mint} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please log in to continue."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={UI.mint}
            colors={[UI.mint, UI.aqua]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <HeroCard
          title={heroState.title}
          amount={heroState.amount}
          subtitle={heroState.subtitle}
          status={primaryLoan?.status}
          primaryLabel={heroState.primaryLabel}
          secondaryLabel={heroState.secondaryLabel}
          onPrimary={handleHeroPrimary}
          onSecondary={handleHeroSecondary}
        />

        {error ? (
          <TouchableOpacity activeOpacity={0.92} onPress={onRefresh} style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.summaryGrid}>
          {summaryCards.map((item) => (
            <SummaryCard
              key={item.title}
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              icon={item.icon}
              tone={item.tone}
              actionLabel={item.actionLabel}
              onPress={item.onPress}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>What you can do</Text>
        <View style={styles.actionsWrap}>
          {!primaryLoan ? (
            <ActionItem
              title="Ask for support"
              subtitle={
                canRequestSupport
                  ? "Start a new support request"
                  : !kycComplete
                    ? "Complete your profile first"
                    : eligibility?.reason || "Check your eligibility first"
              }
              icon="create-outline"
              onPress={() =>
                canRequestSupport
                  ? router.push(ROUTES.tabs.loansRequest as any)
                  : router.push(ROUTES.tabs.profileKyc as any)
              }
            />
          ) : (
            <ActionItem
              title="Open current support"
              subtitle="See request, progress, repayments, and notes"
              icon="document-text-outline"
              onPress={() => openLoanDetail(primaryLoan)}
            />
          )}

          <ActionItem
            title="Member requests"
            subtitle="Review requests that need your response"
            icon="people-outline"
            badge={guaranteeCount > 0 ? String(guaranteeCount) : undefined}
            onPress={() => router.push(ROUTES.tabs.loansGuarantees as any)}
          />

          <ActionItem
            title="Past activity"
            subtitle="See earlier support requests and repayments"
            icon="time-outline"
            onPress={() => router.push(ROUTES.tabs.loansHistory as any)}
          />
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },

  page: {
    flex: 1,
    backgroundColor: UI.page,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.page,
    padding: SPACING.lg,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: UI.supportCard,
    borderRadius: 26,
    padding: 20,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: UI.supportBorder,
  },

  heroOrbOne: {
    position: "absolute",
    top: -34,
    right: -14,
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -26,
    left: -16,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroOrbThree: {
    position: "absolute",
    top: 76,
    right: 42,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  heroStatusChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroStatusChipText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    letterSpacing: 0.5,
  },

  heroTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  heroAmount: {
    fontSize: 30,
    lineHeight: 36,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: UI.textSoft,
    fontFamily: FONT.regular,
  },

  heroActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: UI.careGreen,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  errorCard: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: UI.dangerCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.lg,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
  },

  sectionTitle: {
    marginBottom: 12,
    fontSize: 17,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  summaryGrid: {
    gap: 12,
    marginBottom: SPACING.lg,
  },

  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  summaryTitle: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  summarySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: UI.textSoft,
    fontFamily: FONT.regular,
  },

  inlineLink: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  inlineLinkText: {
    color: "#DFFFE8",
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  actionsWrap: {
    gap: 10,
  },

  actionItem: {
    backgroundColor: UI.glassStrong,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.supportIconBg,
  },

  actionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: 2,
  },

  actionSubtitle: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  actionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },

  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },
});