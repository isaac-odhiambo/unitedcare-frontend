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
  getInstallmentDaysOverdue,
  getInstallmentDaysRemaining,
  getInstallmentFullDue,
  getLoanAmountDueNow,
  getLoanBorrowerId,
  getLoanDaysOverdue,
  getLoanDaysRemaining,
  getLoanDetail,
  getLoanProductName,
  getLoanStatusLabel,
  getMyLoans,
  getNextUnpaidInstallment,
  Loan,
  LoanInstallment,
  toNumber,
} from "@/services/loans";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, saveSessionUser, SessionUser } from "@/services/session";

type LoanUser = Partial<MeResponse> & Partial<SessionUser>;

const UI = {
  page: "#062C49",
  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.86)",
  textMuted: "rgba(255,255,255,0.68)",
  card: "rgba(255,255,255,0.07)",
  cardBorder: "rgba(255,255,255,0.10)",
  glass: "rgba(255,255,255,0.08)",
  glassSoft: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  whiteButton: "#FFFFFF",
  whiteButtonText: "#0C6A80",
  greenButton: "#197D71",
  greenButtonText: "#FFFFFF",
  danger: "#FCA5A5",
  dangerBg: "rgba(239,68,68,0.18)",
  warning: "#FEF3C7",
  warningBg: "rgba(245,158,11,0.18)",
  success: "#DCFCE7",
  successBg: "rgba(34,197,94,0.16)",
  info: "#D9F3F9",
  infoBg: "rgba(12,106,128,0.20)",
  iconBg: "rgba(236,255,252,0.76)",
  iconColor: "#148C84",
};

const ACTIVE_LOAN_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "DISBURSED",
  "UNDER_REPAYMENT",
  "DEFAULTED",
];

const REPAYABLE_STATUSES = [
  "APPROVED",
  "DISBURSED",
  "UNDER_REPAYMENT",
  "DEFAULTED",
];

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

function getStatusTone(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s === "COMPLETED") {
    return { bg: UI.successBg, text: UI.success, label: "DONE" };
  }

  if (s === "DEFAULTED" || s === "REJECTED" || s === "CANCELLED") {
    return {
      bg: UI.dangerBg,
      text: UI.danger,
      label: getLoanStatusLabel({ status: s } as Loan).toUpperCase(),
    };
  }

  if (s === "PENDING" || s === "UNDER_REVIEW") {
    return {
      bg: UI.warningBg,
      text: UI.warning,
      label: getLoanStatusLabel({ status: s } as Loan).toUpperCase(),
    };
  }

  return {
    bg: UI.infoBg,
    text: UI.info,
    label: getLoanStatusLabel({ status: s } as Loan).toUpperCase(),
  };
}

function getPrimaryLoan(loans: Loan[]) {
  if (!Array.isArray(loans) || loans.length === 0) return null;

  return (
    loans.find((loan) =>
      ACTIVE_LOAN_STATUSES.includes(String(loan?.status || "").toUpperCase())
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

function getCurrentInstallmentAmount(loan?: Loan | null) {
  if (!loan) return 0;

  const dueNow = getLoanAmountDueNow(loan);
  if (dueNow > 0) return dueNow;

  const current = getNextUnpaidInstallment(loan);
  if (current) return getInstallmentFullDue(current);

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
      title: "Community Support",
      source: "loan",
      purpose: "LOAN_REPAYMENT",
      loanId: String(loanId),
      borrowerUserId: String(borrowerUserId),
      reference: `SUP${borrowerUserId}`,
      narration: `Community support contribution for member #${borrowerUserId} (Support #${loanId})`,
      amount: payAmount > 0 ? String(payAmount) : "",
      editableAmount: "true",
      returnTo: ROUTES.dynamic.loanDetail(loanId),
    },
  });
}

function InfoPill({
  icon,
  label,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  danger?: boolean;
}) {
  return (
    <View style={[styles.infoPill, danger ? styles.infoPillDanger : null]}>
      <Ionicons name={icon} size={14} color="#FFFFFF" />
      <Text style={styles.infoPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = getStatusTone(status);

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.text }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function SmallAction({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.smallAction, danger ? styles.smallActionDanger : null]}
    >
      <Ionicons name={icon} size={18} color={danger ? UI.danger : "#FFFFFF"} />
      <Text style={styles.smallActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function NextStepLine({
  installment,
  canPay,
  onPay,
}: {
  installment: LoanInstallment | null;
  canPay: boolean;
  onPay: () => void;
}) {
  if (!installment) return null;

  const due = getInstallmentFullDue(installment);
  const late = getInstallmentDaysOverdue(installment);
  const remaining = getInstallmentDaysRemaining(installment);

  return (
    <View style={styles.nextLine}>
      <View style={{ flex: 1 }}>
        <Text style={styles.nextLabel}>Next step</Text>
        <Text style={styles.nextText}>
          {fmtKES(due)}
          {late > 0 ? ` • Late ${late}d` : ""}
          {remaining > 0 ? ` • ${remaining}d left` : ""}
        </Text>
      </View>

      {canPay && due > 0 ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPay}
          style={styles.nextButton}
        >
          <Text style={styles.nextButtonText}>Pay</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function SupportRecordRow({ loan }: { loan: Loan }) {
  const outstanding = computeDisplayOutstanding(loan);
  const dueNow = getLoanAmountDueNow(loan);
  const late = getLoanDaysOverdue(loan);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => openLoanDetail(loan)}
      style={styles.recordRow}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.recordTitle}>Support #{loan.id}</Text>

        <Text style={styles.recordSub}>
          Left {fmtKES(outstanding)}
          {dueNow > 0 ? ` • Now ${fmtKES(dueNow)}` : ""}
          {late > 0 ? ` • Late ${late}d` : ""}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.55)" />
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
  const isChecking = loading && !hasBootstrapped;

  const nextInstallment = useMemo(
    () => getNextUnpaidInstallment(primaryLoan),
    [primaryLoan]
  );

  const currentStepAmount = useMemo(
    () => getCurrentInstallmentAmount(primaryLoan),
    [primaryLoan]
  );

  const balanceAmount = useMemo(
    () => computeDisplayOutstanding(primaryLoan),
    [primaryLoan]
  );

  const dueNowAmount = useMemo(
    () => getLoanAmountDueNow(primaryLoan),
    [primaryLoan]
  );

  const daysOverdue = useMemo(
    () => getLoanDaysOverdue(primaryLoan),
    [primaryLoan]
  );

  const daysRemaining = useMemo(
    () => getLoanDaysRemaining(primaryLoan),
    [primaryLoan]
  );

  const canPay =
    !!primaryLoan &&
    REPAYABLE_STATUSES.includes(primaryStatus) &&
    balanceAmount > 0;

  const otherRecords = useMemo(() => {
    if (!Array.isArray(loans)) return [];

    return loans
      .filter((loan) => Number(loan.id) !== Number(primaryLoan?.id || 0))
      .slice(0, 2);
  }, [loans, primaryLoan?.id]);

  if (hasBootstrapped && !user) {
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

          <Text style={styles.heroTag}>COMMUNITY SUPPORT</Text>

          <Text style={styles.heroTitle}>
            {hasSupport ? "Support in progress" : "Need group support?"}
          </Text>

          <Text style={styles.heroCaption} numberOfLines={1}>
            {hasSupport ? "Stay on track with your group support." : "Request support when needed."}
          </Text>
        </View>

        {isChecking ? (
          <View style={styles.silentCard}>
            <Text style={styles.silentText}>Checking support...</Text>
          </View>
        ) : null}

        {error ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onRefresh}
            style={styles.errorCard}
          >
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {!isChecking && hasSupport ? (
          <>
            <View style={styles.mainCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="people-outline" size={22} color={UI.iconColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Active support</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                      {getLoanProductName(primaryLoan)}
                    </Text>
                  </View>
                </View>

                <StatusBadge status={primaryLoan?.status} />
              </View>

              <Text style={styles.amountLabel}>
                {dueNowAmount > 0 ? "Needed now" : "Still needed"}
              </Text>

              <Text style={styles.mainAmount}>
                {fmtKES(dueNowAmount > 0 ? dueNowAmount : balanceAmount)}
              </Text>

              <View style={styles.infoRow}>
                <InfoPill
                  icon="wallet-outline"
                  label={`Left ${fmtKES(balanceAmount)}`}
                  danger={daysOverdue > 0}
                />

                {currentStepAmount > 0 ? (
                  <InfoPill
                    icon="calendar-outline"
                    label={`Step ${fmtKES(currentStepAmount)}`}
                    danger={daysOverdue > 0}
                  />
                ) : null}

                {daysOverdue > 0 ? (
                  <InfoPill
                    icon="alert-circle-outline"
                    label={`Late ${daysOverdue}d`}
                    danger
                  />
                ) : daysRemaining > 0 ? (
                  <InfoPill
                    icon="time-outline"
                    label={`${daysRemaining}d left`}
                  />
                ) : null}
              </View>

              <NextStepLine
                installment={nextInstallment}
                canPay={canPay}
                onPay={() =>
                  openLoanDeposit(
                    primaryLoan,
                    nextInstallment
                      ? getInstallmentFullDue(nextInstallment)
                      : dueNowAmount
                  )
                }
              />

              <View style={styles.primaryButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => openLoanDetail(primaryLoan)}
                  style={[styles.primaryButton, styles.primaryButtonLight]}
                >
                  <Ionicons name="eye-outline" size={18} color={UI.whiteButtonText} />
                  <Text style={[styles.primaryButtonText, styles.primaryButtonTextLight]}>
                    Open
                  </Text>
                </TouchableOpacity>

                {canPay ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() =>
                      openLoanDeposit(
                        primaryLoan,
                        dueNowAmount > 0 ? dueNowAmount : currentStepAmount
                      )
                    }
                    style={[styles.primaryButton, styles.primaryButtonGreen]}
                  >
                    <Ionicons name="card-outline" size={18} color={UI.greenButtonText} />
                    <Text style={[styles.primaryButtonText, styles.primaryButtonTextGreen]}>
                      Pay Now
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {canPay ? (
              <View style={styles.quickRow}>
                <SmallAction
                  icon="calendar-outline"
                  label="This Step"
                  onPress={() =>
                    openLoanDeposit(
                      primaryLoan,
                      currentStepAmount > 0 ? currentStepAmount : undefined
                    )
                  }
                  danger={daysOverdue > 0}
                />

                <SmallAction
                  icon="create-outline"
                  label="Any Amount"
                  onPress={() => openLoanDeposit(primaryLoan)}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {!isChecking && !hasSupport ? (
          <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.cardIconWrap}>
                  <Ionicons name="people-outline" size={22} color={UI.iconColor} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>No open support</Text>
                  <Text style={styles.cardSubtitle}>
                    You have no active request now
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(ROUTES.tabs.loansRequest as any)}
              style={[styles.primaryButton, styles.primaryButtonGreen, styles.fullWidthButton]}
            >
              <Ionicons name="add-circle-outline" size={18} color={UI.greenButtonText} />
              <Text style={[styles.primaryButtonText, styles.primaryButtonTextGreen]}>
                Request Support
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {otherRecords.length > 0 ? (
          <View style={styles.recordsCard}>
            <Text style={styles.recordsTitle}>Other support</Text>

            {otherRecords.map((item, index) => (
              <View key={item.id || index}>
                <SupportRecordRow loan={item} />

                {index < otherRecords.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 12 }} />
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
    paddingBottom: SPACING.lg,
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
    padding: 14,
    marginBottom: SPACING.sm,
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

  heroTag: {
    color: "#DFFFE8",
    fontSize: 11,
    letterSpacing: 0.8,
    fontFamily: FONT.bold,
    marginBottom: 5,
  },

  heroTitle: {
    color: UI.text,
    fontSize: 20,
    lineHeight: 25,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  heroCaption: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
    maxWidth: "94%",
  },

  silentCard: {
    marginBottom: SPACING.sm,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  silentText: {
    color: UI.textMuted,
    fontSize: 12,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  errorCard: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.sm,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },

  mainCard: {
    backgroundColor: UI.card,
    borderColor: UI.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: SPACING.sm,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  cardIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: UI.iconBg,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    color: UI.text,
    fontSize: 18,
    lineHeight: 23,
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
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  badgeText: {
    fontSize: 11,
    fontFamily: FONT.bold,
    letterSpacing: 0.5,
  },

  amountLabel: {
    color: UI.textMuted,
    fontSize: 13,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  mainAmount: {
    color: UI.text,
    fontSize: 31,
    lineHeight: 37,
    fontFamily: FONT.bold,
    marginBottom: 10,
  },

  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  infoPillDanger: {
    backgroundColor: "rgba(239,68,68,0.22)",
    borderColor: "rgba(239,68,68,0.26)",
  },

  infoPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  nextLine: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  nextLabel: {
    color: UI.textMuted,
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 3,
  },

  nextText: {
    color: UI.text,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  nextButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.greenButton,
  },

  nextButtonText: {
    color: UI.greenButtonText,
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  primaryButtonsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 46,
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
    minWidth: 120,
  },

  primaryButtonGreen: {
    backgroundColor: UI.greenButton,
    borderWidth: 1,
    borderColor: UI.greenButton,
    flex: 1,
    minWidth: 120,
  },

  primaryButtonText: {
    fontSize: 14,
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

  quickRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: SPACING.sm,
  },

  smallAction: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: UI.glassSoft,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  smallActionDanger: {
    backgroundColor: "rgba(239,68,68,0.14)",
    borderColor: "rgba(239,68,68,0.22)",
  },

  smallActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  recordsCard: {
    backgroundColor: UI.glassSoft,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 18,
    padding: 12,
  },

  recordsTitle: {
    color: UI.text,
    fontSize: 15,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },

  recordTitle: {
    color: UI.text,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  recordSub: {
    color: UI.textMuted,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginTop: 3,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
