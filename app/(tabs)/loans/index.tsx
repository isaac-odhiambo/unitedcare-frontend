import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
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
  getLoanBorrowerId,
  getLoanDetail,
  getMyLoans,
  Loan,
  toNumber,
} from "@/services/loans";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, saveSessionUser, SessionUser } from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

const UI = {
  page: "#062C49",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.70)",
  supportCard: "rgba(255,255,255,0.07)",
  supportBorder: "rgba(255,255,255,0.10)",
  glass: "rgba(255,255,255,0.08)",
  glassSoft: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  whiteButton: "#FFFFFF",
  whiteButtonText: "#0C6A80",
  greenButton: "#197D71",
  greenButtonText: "#FFFFFF",
  iconChipBg: "rgba(236,255,252,0.76)",
  iconChipColor: "#148C84",
};

const ACTIVE_SUPPORT_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "DISBURSED",
  "UNDER_REPAYMENT",
  "DEFAULTED",
];

const REPAYABLE_STATUSES = ["APPROVED", "DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"];

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

  return (
    loans.find((loan) =>
      ACTIVE_SUPPORT_STATUSES.includes(String(loan?.status || "").toUpperCase())
    ) || null
  );
}

function getLoanRate(loan?: Loan | null): number {
  if (!loan) return 0;

  const raw =
    loan.product_detail?.annual_interest_rate ??
    (typeof loan.product === "object" ? loan.product?.annual_interest_rate : 0);

  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getLoanInterestType(loan?: Loan | null): string {
  return String(
    loan?.product_detail?.interest_type ??
      (typeof loan?.product === "object" ? loan.product?.interest_type : "") ??
      ""
  ).toUpperCase();
}

function computeEstimatedTotalPayable(loan?: Loan | null): number {
  if (!loan) return 0;

  const principal = toNumber(loan.principal);
  const termWeeks = Math.max(0, Number(loan.term_weeks || 0));
  const rate = getLoanRate(loan) / 100;

  if (principal <= 0 || termWeeks <= 0) return principal;

  const backendTotal = toNumber(loan.total_payable);
  if (backendTotal > 0) return backendTotal;

  const interestType = getLoanInterestType(loan);

  if (interestType === "REDUCING") {
    const weeklyRate = rate / 52;
    const weeklyPrincipal = principal / termWeeks;
    let totalInterest = 0;
    let balance = principal;

    for (let i = 0; i < termWeeks; i += 1) {
      totalInterest += balance * weeklyRate;
      balance -= weeklyPrincipal;
    }

    return Math.max(0, principal + totalInterest);
  }

  const flatInterest = principal * rate * (termWeeks / 52);
  return Math.max(0, principal + flatInterest);
}

function computeDisplayOutstanding(loan?: Loan | null): number {
  if (!loan) return 0;

  const backendOutstanding = toNumber(loan.outstanding_balance);
  if (backendOutstanding > 0) return backendOutstanding;

  const status = String(loan.status || "").toUpperCase();
  const totalPaid = toNumber(loan.total_paid);
  const estimatedTotal = computeEstimatedTotalPayable(loan);

  if (REPAYABLE_STATUSES.includes(status)) {
    return Math.max(0, estimatedTotal - totalPaid);
  }

  return Math.max(0, backendOutstanding);
}

function getCurrentStepAmount(loan?: Loan | null) {
  if (!loan) return 0;

  const installments = Array.isArray(loan.installments) ? loan.installments : [];
  const current = installments.find((item: any) => {
    const planned = toNumber(item.total_due);
    const lateFee = toNumber(item.late_fee);
    const paid = toNumber(item.paid_amount);
    const remaining = planned + lateFee - paid;
    const isPaid = !!item?.is_paid || !!item?.isPaid || remaining <= 0;
    return !isPaid && remaining > 0;
  });

  if (current) {
    const remaining =
      toNumber(current.total_due) +
      toNumber(current.late_fee) -
      toNumber(current.paid_amount);
    return Math.max(0, remaining);
  }

  const weeks = Math.max(0, Number(loan.term_weeks || 0));
  const totalPayable = computeEstimatedTotalPayable(loan);
  const totalPaid = toNumber(loan.total_paid);

  if (weeks > 0 && totalPayable > 0) {
    const weekly = totalPayable / weeks;
    const balance = Math.max(0, totalPayable - totalPaid);
    return Math.min(weekly, balance);
  }

  return 0;
}

function openLoanDetail(loan?: Loan | null) {
  const loanId = Number(loan?.id ?? 0);
  if (!loanId) return;

  router.push({
    pathname: "/(tabs)/loans/[id]" as any,
    params: { id: String(loanId) },
  });
}

function openLoanDeposit(loan?: Loan | null, amount?: number) {
  const loanId = Number(loan?.id ?? 0);
  const borrowerUserId = getLoanBorrowerId(loan);
  const payAmount = Math.max(amount ?? 0, 0);

  if (!loanId || !borrowerUserId) return;

  router.push({
    pathname: "/(tabs)/payments/deposit" as any,
    params: {
      title: "Community Support Payment",
      source: "loan",
      purpose: "LOAN_REPAYMENT",
      loanId: String(loanId),
      borrowerUserId: String(borrowerUserId),
      reference: `LOAN${borrowerUserId}`,
      narration: `Community support repayment for member #${borrowerUserId} (Support #${loanId})`,
      amount: payAmount > 0 ? String(payAmount) : "",
      editableAmount: "true",
      returnTo: ROUTES.dynamic.loanDetail(loanId),
    },
  });
}

function MetricChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metricChip}>
      <Ionicons name={icon} size={14} color="#FFFFFF" />
      <Text style={styles.metricChipText}>{label}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.actionCard}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={20} color={UI.iconChipColor} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function LoansIndexScreen() {
  const [user, setUser] = useState<LoanUser | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [activeLoanDetail, setActiveLoanDetail] = useState<Loan | null>(null);

  const [loading, setLoading] = useState(true);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, loansRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLoans(),
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

      const nextLoans =
        loansRes.status === "fulfilled" && Array.isArray(loansRes.value)
          ? loansRes.value
          : [];

      setLoans(nextLoans);

      const primaryFromList = getPrimaryLoan(nextLoans);

      if (primaryFromList?.id) {
        try {
          const detailed = await getLoanDetail(primaryFromList.id);
          setActiveLoanDetail(detailed);
        } catch (detailError: any) {
          setActiveLoanDetail(primaryFromList);
          setError(getApiErrorMessage(detailError) || getErrorMessage(detailError));
        }
      } else {
        setActiveLoanDetail(null);
      }

      let nextError = "";

      if (meRes.status === "rejected") {
        nextError =
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
      } else if (loansRes.status === "rejected") {
        nextError =
          getApiErrorMessage(loansRes.reason) || getErrorMessage(loansRes.reason);
      }

      if (nextError) setError(nextError);
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
          setHasBootstrapped(true);
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

  const primaryLoan = useMemo(
    () => activeLoanDetail || getPrimaryLoan(loans),
    [activeLoanDetail, loans]
  );

  const primaryStatus = String(primaryLoan?.status || "").toUpperCase();
  const hasSupport = !!primaryLoan;

  const currentStepAmount = useMemo(
    () => getCurrentStepAmount(primaryLoan),
    [primaryLoan]
  );

  const balanceAmount = useMemo(
    () => computeDisplayOutstanding(primaryLoan),
    [primaryLoan]
  );

  const canPay =
    !!primaryLoan &&
    REPAYABLE_STATUSES.includes(primaryStatus) &&
    balanceAmount > 0;

  if (!hasBootstrapped && loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView style={styles.page} contentContainerStyle={styles.content}>
          <View style={styles.backgroundBlobTop} />
          <View style={styles.backgroundBlobMiddle} />
          <View style={styles.backgroundBlobBottom} />
          <View style={styles.backgroundGlowOne} />
          <View style={styles.backgroundGlowTwo} />

          <View style={styles.skeletonHero} />
          <View style={styles.skeletonCard} />
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonSmallCard} />
            <View style={styles.skeletonSmallCard} />
            <View style={styles.skeletonSmallCard} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centerWrap}>
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
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <Text style={styles.heroTag}>COMMUNITY SUPPORT</Text>
          <Text style={styles.heroTitle}>
            {hasSupport ? "Stay on track with your support" : "Community support when needed"}
          </Text>
          <Text style={styles.heroCaption}>
            {hasSupport
              ? "See your balance, open your support details, and make your next contribution with ease."
              : "Start a support request and continue the journey with your community."}
          </Text>

          {hasSupport ? (
            <View style={styles.heroMetaRow}>
              <View style={styles.heroPill}>
                <Ionicons name="ellipse" size={8} color="#DFFFE8" />
                <Text style={styles.heroPillText}>
                  {getStatusLabel(primaryLoan?.status)}
                </Text>
              </View>

              <View style={styles.heroPill}>
                <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
                <Text style={styles.heroPillText}>{fmtKES(balanceAmount)}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {error ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onRefresh}
            style={styles.errorCard}
          >
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {hasSupport ? (
          <>
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="heart-outline" size={22} color={UI.iconChipColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>My community support</Text>
                    <Text style={styles.cardSubtitle}>Your remaining balance</Text>
                  </View>
                </View>

                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {getStatusLabel(primaryLoan?.status).toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.mainAmount}>{fmtKES(balanceAmount)}</Text>

              <View style={styles.metricsRow}>
                <MetricChip
                  icon="cash-outline"
                  label={`Support received ${fmtKES(primaryLoan?.principal)}`}
                />
                {canPay && currentStepAmount > 0 ? (
                  <MetricChip
                    icon="calendar-outline"
                    label={`This round ${fmtKES(currentStepAmount)}`}
                  />
                ) : null}
              </View>

              <View style={styles.primaryButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => openLoanDetail(primaryLoan)}
                  style={[styles.primaryButton, styles.primaryButtonLight]}
                >
                  <Ionicons name="eye-outline" size={18} color={UI.whiteButtonText} />
                  <Text style={[styles.primaryButtonText, styles.primaryButtonTextLight]}>
                    View Support Details
                  </Text>
                </TouchableOpacity>

                {canPay ? (
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => openLoanDeposit(primaryLoan)}
                    style={[styles.primaryButton, styles.primaryButtonGreen]}
                  >
                    <Ionicons name="card-outline" size={18} color={UI.greenButtonText} />
                    <Text style={[styles.primaryButtonText, styles.primaryButtonTextGreen]}>
                      Contribute
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {canPay ? (
              <>
                <Text style={styles.sectionTitle}>Choose how to contribute</Text>

                <View style={styles.actionsGrid}>
                  <ActionCard
                    icon="flash-outline"
                    label="Clear Full Balance"
                    onPress={() => openLoanDeposit(primaryLoan, balanceAmount)}
                  />
                  <ActionCard
                    icon="calendar-outline"
                    label="Contribute This Round"
                    onPress={() =>
                      openLoanDeposit(
                        primaryLoan,
                        currentStepAmount > 0 ? currentStepAmount : undefined
                      )
                    }
                  />
                  <ActionCard
                    icon="create-outline"
                    label="Choose My Amount"
                    onPress={() => openLoanDeposit(primaryLoan)}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="heart-outline" size={22} color={UI.iconChipColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>No active community support</Text>
                  <Text style={styles.cardSubtitle}>
                    You do not have an open support record at the moment
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.emptySub}>
              Start a support request and continue with the next simple step.
            </Text>

            <View style={styles.singleButtonWrap}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push(ROUTES.tabs.loansRequest as any)}
                style={[styles.primaryButton, styles.primaryButtonGreen, styles.fullWidthButton]}
              >
                <Ionicons name="add-circle-outline" size={18} color={UI.greenButtonText} />
                <Text style={[styles.primaryButtonText, styles.primaryButtonTextGreen]}>
                  Request Community Support
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
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

  centerWrap: {
    flex: 1,
    backgroundColor: UI.page,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -55,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 250,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -35,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 10,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 140,
    left: 8,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: 16,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(52, 198, 191, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(195, 255, 250, 0.12)",
  },

  heroOrbOne: {
    position: "absolute",
    top: -24,
    right: -12,
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -18,
    right: 42,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  heroOrbThree: {
    position: "absolute",
    top: 42,
    right: 78,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  heroTag: {
    color: "#DFFFE8",
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  heroTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  heroCaption: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginBottom: 12,
    maxWidth: "94%",
  },

  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  heroPill: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  errorCard: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.lg,
  },

  errorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
  },

  mainCard: {
    backgroundColor: UI.supportCard,
    borderColor: UI.supportBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },

  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: UI.iconChipBg,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    color: UI.text,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: FONT.bold,
    marginBottom: 2,
  },

  cardSubtitle: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  badge: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 0.6,
  },

  mainAmount: {
    color: UI.text,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  metricChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  primaryButtonsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },

  primaryButtonLight: {
    backgroundColor: UI.whiteButton,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    flex: 1,
    minWidth: 160,
  },

  primaryButtonGreen: {
    backgroundColor: UI.greenButton,
    borderWidth: 1,
    borderColor: UI.greenButton,
    minWidth: 108,
  },

  primaryButtonText: {
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  primaryButtonTextLight: {
    color: UI.whiteButtonText,
  },

  primaryButtonTextGreen: {
    color: UI.greenButtonText,
  },

  fullWidthButton: {
    width: "100%",
  },

  sectionTitle: {
    color: UI.text,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    marginTop: SPACING.md,
    marginBottom: 10,
  },

  actionsGrid: {
    flexDirection: "row",
    gap: 10,
  },

  actionCard: {
    flex: 1,
    backgroundColor: UI.glassSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
  },

  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: UI.iconChipBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  actionLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.bold,
    textAlign: "center",
  },

  emptySub: {
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.regular,
    marginTop: 4,
  },

  singleButtonWrap: {
    marginTop: SPACING.lg,
  },

  skeletonHero: {
    height: 140,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: SPACING.md,
  },

  skeletonCard: {
    height: 200,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: SPACING.md,
  },

  skeletonRow: {
    flexDirection: "row",
    gap: 10,
  },

  skeletonSmallCard: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
});