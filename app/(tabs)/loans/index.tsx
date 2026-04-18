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
  textSoft: "rgba(255,255,255,0.90)",
  textMuted: "rgba(255,255,255,0.72)",
  supportCard: "rgba(52, 198, 191, 0.18)",
  supportBorder: "rgba(195, 255, 250, 0.14)",
  glass: "rgba(255,255,255,0.08)",
  glassSoft: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  whiteButton: "#FFFFFF",
  whiteButtonText: "#197D71",
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
      title: "Support Payment",
      source: "loan",
      purpose: "LOAN_REPAYMENT",
      loanId: String(loanId),
      borrowerUserId: String(borrowerUserId),
      reference: `LOAN${borrowerUserId}`,
      narration: `Loan repayment for borrower #${borrowerUserId} (Loan #${loanId})`,
      amount: payAmount > 0 ? String(payAmount) : "",
      editableAmount: "true",
      returnTo: ROUTES.dynamic.loanDetail(loanId),
    },
  });
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.quickAction}>
      <View style={styles.quickIconWrap}>
        <Ionicons name={icon} size={18} color={UI.text} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
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
        <View style={styles.page} />
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
        <View style={styles.blobTopRight} />
        <View style={styles.blobMidLeft} />
        <View style={styles.blobBottomRight} />
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <Text style={styles.pageTitle}>SUPPORT</Text>
        <Text style={styles.pageSub}>
          {hasSupport
            ? "Open your support or make a payment."
            : "Ask for support when you need it."}
        </Text>

        {error ? (
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onRefresh}
            style={styles.errorCard}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {hasSupport ? (
          <>
            <View style={styles.mainCard}>
              <View style={styles.topRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {getStatusLabel(primaryLoan?.status).toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.mainTitle}>My support</Text>
              <Text style={styles.mainAmount}>{fmtKES(balanceAmount)}</Text>
              <Text style={styles.mainSub}>Amount left</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Ionicons name="cash-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.metaChipText}>
                    Received: {fmtKES(primaryLoan?.principal)}
                  </Text>
                </View>

                {canPay && currentStepAmount > 0 ? (
                  <View style={styles.metaChip}>
                    <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.metaChipText}>
                      This week: {fmtKES(currentStepAmount)}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.primaryActionWrap}>
                <TouchableOpacity
                  activeOpacity={0.92}
                  onPress={() => openLoanDetail(primaryLoan)}
                  style={styles.primaryAction}
                >
                  <Text style={styles.primaryActionText}>Open Support Details</Text>
                </TouchableOpacity>
              </View>
            </View>

            {canPay ? (
              <View style={styles.quickGrid}>
                <QuickAction
                  icon="flash-outline"
                  label="Pay Full Support"
                  onPress={() => openLoanDeposit(primaryLoan, balanceAmount)}
                />
                <QuickAction
                  icon="calendar-outline"
                  label="Pay This Week"
                  onPress={() =>
                    openLoanDeposit(
                      primaryLoan,
                      currentStepAmount > 0 ? currentStepAmount : undefined
                    )
                  }
                />
                <QuickAction
                  icon="create-outline"
                  label="Pay My Amount"
                  onPress={() => openLoanDeposit(primaryLoan)}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.mainCard}>
            <Text style={styles.mainTitle}>No active support</Text>
            <Text style={styles.emptySub}>
              Start a support request and the request screen will guide the rest.
            </Text>

            <View style={styles.primaryActionWrap}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => router.push(ROUTES.tabs.loansRequest as any)}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionText}>Ask for Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 22 }} />
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

  blobTopRight: {
    position: "absolute",
    top: -110,
    right: -55,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  blobMidLeft: {
    position: "absolute",
    top: 260,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255,255,255,0.035)",
  },

  blobBottomRight: {
    position: "absolute",
    bottom: -110,
    right: -35,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  glowOne: {
    position: "absolute",
    top: 130,
    right: 15,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  glowTwo: {
    position: "absolute",
    bottom: 140,
    left: 8,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  pageTitle: {
    color: UI.text,
    fontSize: 22,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  pageSub: {
    color: UI.textMuted,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.regular,
    marginBottom: SPACING.lg,
  },

  errorCard: {
    minHeight: 56,
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
    borderRadius: 26,
    padding: 20,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 12,
  },

  badge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 0.6,
  },

  mainTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  mainAmount: {
    color: UI.text,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONT.bold,
  },

  mainSub: {
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.regular,
    marginTop: 6,
  },

  emptySub: {
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.regular,
    marginTop: 4,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: SPACING.md,
  },

  metaChip: {
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

  metaChipText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  primaryActionWrap: {
    marginTop: SPACING.lg,
  },

  primaryAction: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: UI.whiteButton,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  primaryActionText: {
    color: UI.whiteButtonText,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  quickGrid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: 10,
  },

  quickAction: {
    flex: 1,
    backgroundColor: UI.glassSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },

  quickLabel: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    textAlign: "center",
  },
});