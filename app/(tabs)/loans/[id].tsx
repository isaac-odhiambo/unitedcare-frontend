import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import {
  approveLoan,
  fmtKES,
  getApiErrorMessage,
  getLoanBorrowerId,
  getLoanBorrowerName,
  getLoanDetail,
  getLoanProductName,
  Loan,
  LoanGuarantor,
  LoanInstallment,
  LoanPayment,
  rejectLoan,
  toNumber,
} from "@/services/loans";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type LocalUser = Partial<MeResponse> &
  Partial<SessionUser> & {
    id?: number;
    is_staff?: boolean;
    is_superuser?: boolean;
  };

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT = "rgba(255,255,255,0.92)";
const MUTED = "rgba(255,255,255,0.72)";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const SOFT = "rgba(255,255,255,0.10)";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const DANGER_BG = "rgba(239,68,68,0.18)";
const DANGER_TEXT = "#FECACA";
const INFO_BG = "rgba(12,106,128,0.20)";
const INFO_TEXT = "#D9F3F9";

const REPAYABLE_STATUSES = [
  "APPROVED",
  "DISBURSED",
  "UNDER_REPAYMENT",
  "DEFAULTED",
];

function statusMeta(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
      return { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Completed" };
    case "APPROVED":
      return { bg: INFO_BG, text: INFO_TEXT, label: "Approved" };
    case "DISBURSED":
      return { bg: INFO_BG, text: INFO_TEXT, label: "Ready" };
    case "UNDER_REPAYMENT":
      return { bg: INFO_BG, text: INFO_TEXT, label: "Ongoing" };
    case "DEFAULTED":
      return { bg: DANGER_BG, text: DANGER_TEXT, label: "Overdue" };
    case "REJECTED":
      return { bg: DANGER_BG, text: DANGER_TEXT, label: "Declined" };
    case "UNDER_REVIEW":
      return { bg: WARNING_BG, text: WARNING_TEXT, label: "Under review" };
    case "PENDING":
    default:
      return { bg: WARNING_BG, text: WARNING_TEXT, label: "Pending" };
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return value;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>
        {value == null || value === "" ? "—" : String(value)}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card style={styles.statCard} variant="default">
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={20} color={BRAND} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Card>
  );
}

function PaymentRow({ item }: { item: LoanPayment }) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.listTitle}>
          {item.method || "Payment"} • {fmtKES(item.amount)}
        </Text>
        <Text style={styles.listSub}>
          {item.reference || "No reference"}
          {item.created_at || item.paid_at
            ? ` • ${item.created_at || item.paid_at}`
            : ""}
        </Text>
      </View>
    </View>
  );
}

function getInstallmentPaidFlag(item: LoanInstallment | any) {
  return !!item?.is_paid || !!item?.isPaid;
}

function InstallmentRow({
  item,
  onPay,
  showPayButton,
  highlight,
}: {
  item: LoanInstallment;
  onPay?: () => void;
  showPayButton?: boolean;
  highlight?: boolean;
}) {
  const remaining =
    toNumber(item.total_due) +
    toNumber(item.late_fee) -
    toNumber(item.paid_amount);

  const isPaid = getInstallmentPaidFlag(item) || remaining <= 0;

  const tone = isPaid
    ? { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Paid" }
    : toNumber(item.late_fee) > 0
      ? { bg: DANGER_BG, text: DANGER_TEXT, label: "Due now" }
      : { bg: WARNING_BG, text: WARNING_TEXT, label: "Current" };

  return (
    <View style={[styles.installmentCard, highlight ? styles.currentCard : null]}>
      <View style={styles.rowTop}>
        <Text style={styles.installmentTitle}>
          Current contribution step {item.installment_no}
        </Text>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.text }]}>
            {tone.label}
          </Text>
        </View>
      </View>

      <Text style={styles.installmentAmount}>
        {fmtKES(remaining > 0 ? remaining : 0)}
      </Text>

      <Text style={styles.listSub}>
        {item.due_date || "Current scheduled payment"}
      </Text>

      <Text style={styles.listSub}>
        Planned: {fmtKES(item.total_due)} • Paid: {fmtKES(item.paid_amount)}
      </Text>

      {showPayButton && !isPaid && onPay ? (
        <View style={{ marginTop: SPACING.md }}>
          <Button title="Pay This Step" onPress={onPay} />
        </View>
      ) : null}
    </View>
  );
}

function getGuarantorDisplayName(item?: LoanGuarantor | null) {
  if (!item) return "Member";

  const detail =
    item.guarantor_detail ||
    (typeof item.guarantor === "object" && item.guarantor ? item.guarantor : null);

  if (!detail) return "Member";

  const full =
    detail.full_name?.trim() ||
    `${detail.first_name || ""} ${detail.last_name || ""}`.trim();

  return full || detail.username || detail.email || "Member";
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

function buildEstimatedInstallments(loan?: Loan | null): LoanInstallment[] {
  if (!loan) return [];

  const termWeeks = Math.max(0, Number(loan.term_weeks || 0));
  const totalPaid = toNumber(loan.total_paid);
  const totalPayable = computeEstimatedTotalPayable(loan);

  if (termWeeks <= 0 || totalPayable <= 0) return [];

  const weekly = totalPayable / termWeeks;
  const paidInstallments = weekly > 0 ? Math.floor(totalPaid / weekly) : 0;

  return Array.from({ length: termWeeks }).map((_, index) => {
    const installmentNo = index + 1;
    const isPaid = installmentNo <= paidInstallments;
    const paidAmount = isPaid ? weekly : 0;

    return {
      id: installmentNo,
      installment_no: installmentNo,
      total_due: weekly,
      paid_amount: paidAmount,
      late_fee: 0,
      is_paid: isPaid,
      due_date: null,
    } as LoanInstallment;
  });
}

function getCurrentInstallment(installments: LoanInstallment[]) {
  if (!installments.length) return null;

  const nextOpen = installments.find((item) => {
    const remaining =
      toNumber(item.total_due) +
      toNumber(item.late_fee) -
      toNumber(item.paid_amount);
    return !getInstallmentPaidFlag(item) && remaining > 0;
  });

  return nextOpen || null;
}

function getPreviouslyPaidInstallments(installments: LoanInstallment[]) {
  return installments.filter((item) => getInstallmentPaidFlag(item));
}

export default function LoanDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
  const loanId = Number(params.id);

  const [me, setMe] = useState<LocalUser | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const backToLoans = useCallback(() => {
    const target =
      typeof params.returnTo === "string" && params.returnTo.trim()
        ? params.returnTo
        : ROUTES.tabs.loans;

    router.replace(target as any);
  }, [params.returnTo]);

  const load = useCallback(
    async (silent = false) => {
      if (!loanId || Number.isNaN(loanId)) {
        setLoan(null);
        setError("Invalid item selected.");
        setLoading(false);
        return;
      }

      try {
        if (!silent) setError("");

        const [sessionRes, meRes, loanRes] = await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getLoanDetail(loanId),
        ]);

        const sessionUser =
          sessionRes.status === "fulfilled" ? sessionRes.value : null;
        const meUser = meRes.status === "fulfilled" ? meRes.value : null;

        setMe(
          sessionUser || meUser
            ? {
                ...(sessionUser ?? {}),
                ...(meUser ?? {}),
              }
            : null
        );

        if (loanRes.status !== "fulfilled") {
          if (!loan) {
            setLoan(null);
            setError(getApiErrorMessage(loanRes.reason));
          }
          return;
        }

        setLoan(loanRes.value);
        setError("");
      } catch (e: any) {
        if (!loan) {
          setLoan(null);
          setError(getApiErrorMessage(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [loanId, loan]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          await load(true);
        } finally {
          if (!active) return;
        }
      })();

      return () => {
        active = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const myUserId = Number(me?.id || 0);
  const borrowerId = getLoanBorrowerId(loan);
  const isBorrower = !!myUserId && !!borrowerId && myUserId === borrowerId;
  const isAdmin = !!(me?.is_staff || me?.is_superuser);

  const canApproveOrReject =
    isAdmin &&
    ["PENDING", "UNDER_REVIEW"].includes(String(loan?.status || "").toUpperCase());

  const status = statusMeta(loan?.status);
  const borrowerName = getLoanBorrowerName(loan);
  const productName = getLoanProductName(loan);

  const principalValue = toNumber(loan?.principal);
  const totalPaidValue = toNumber(loan?.total_paid);
  const displayOutstanding = computeDisplayOutstanding(loan);

  const principal = fmtKES(principalValue);
  const totalPaid = fmtKES(totalPaidValue);
  const outstanding = fmtKES(displayOutstanding);

  const repaymentStatus = String(loan?.status || "").toUpperCase();
  const allowPayNow =
    isBorrower &&
    REPAYABLE_STATUSES.includes(repaymentStatus) &&
    displayOutstanding > 0;

  const actualInstallments = loan?.installments ?? [];
  const fallbackInstallments = buildEstimatedInstallments(loan);
  const installments = actualInstallments.length
    ? actualInstallments
    : fallbackInstallments;

  const currentInstallment = getCurrentInstallment(installments);
  const paidInstallments = getPreviouslyPaidInstallments(installments);
  const payments = loan?.payments ?? [];
  const guarantors = loan?.guarantors ?? [];

  const weeklyEstimate = useMemo(() => {
    const termWeeks = Math.max(0, Number(loan?.term_weeks || 0));
    const estimatedTotalPayable = computeEstimatedTotalPayable(loan);
    if (termWeeks <= 0 || estimatedTotalPayable <= 0) return 0;
    return estimatedTotalPayable / termWeeks;
  }, [loan]);

  const payNow = useCallback(
    (amount?: number) => {
      if (!loan?.id) return;

      const borrowerUserId = getLoanBorrowerId(loan);
      if (!borrowerUserId) {
        Alert.alert(
          "Unable to continue",
          "Member details are missing for this record."
        );
        return;
      }

      const payAmount = Math.max(amount ?? displayOutstanding, 0);

      router.push({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          source: "loan",
          loanId: String(loan.id),
          borrowerUserId: String(borrowerUserId),
          amount: String(payAmount),
          editableAmount: "true",
          returnTo: ROUTES.tabs.loans,
          backLabel: "Back",
          landingTitle: "Payment",
        },
      });
    },
    [loan, displayOutstanding]
  );

  const onApprove = useCallback(async () => {
    if (!loan?.id) return;

    try {
      setBusy(true);
      const res = await approveLoan(loan.id);
      if (res?.loan) setLoan(res.loan);
      Alert.alert("Success", res?.message || "Request approved successfully.");
    } catch (e: any) {
      Alert.alert("Unable to approve", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [loan?.id]);

  const onReject = useCallback(async () => {
    if (!loan?.id) return;

    if (!rejectReason.trim()) {
      Alert.alert("Reason required", "Please enter a reason.");
      return;
    }

    try {
      setBusy(true);
      const res = await rejectLoan(loan.id, rejectReason.trim());
      if (res?.loan) setLoan(res.loan);
      Alert.alert("Done", res?.message || "Request updated.");
    } catch (e: any) {
      Alert.alert("Unable to decline", getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [loan?.id, rejectReason]);

  if (loading && !loan) {
    return null;
  }

  if (!loanId || Number.isNaN(loanId)) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Invalid item"
            subtitle="The selected item could not be opened."
            actionLabel="Back"
            onAction={backToLoans}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loan) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Unable to load"
            subtitle={error || "This item could not be loaded."}
            actionLabel="Back"
            onAction={backToLoans}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
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
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Community details</Text>
            <Text style={styles.pageSub}>Simple member information</Text>
          </View>

          <TouchableOpacity style={styles.iconBtn} onPress={backToLoans}>
            <Ionicons name="arrow-back-outline" size={20} color={WHITE} />
          </TouchableOpacity>
        </View>

        {currentInstallment ? (
          <>
            <SectionTitle title="Current payment" />
            <Card style={styles.blockCard} variant="default">
              <InstallmentRow
                item={currentInstallment}
                highlight
                showPayButton={allowPayNow}
                onPay={() => {
                  const remaining =
                    toNumber(currentInstallment.total_due) +
                    toNumber(currentInstallment.late_fee) -
                    toNumber(currentInstallment.paid_amount);

                  payNow(remaining > 0 ? remaining : undefined);
                }}
              />
            </Card>
            <View style={styles.sectionGap} />
          </>
        ) : null}

        <Card style={styles.heroCard} variant="default">
          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroEyebrow}>Record #{loan.id}</Text>
              <Text style={styles.heroTitle}>{borrowerName}</Text>
              <Text style={styles.heroSubtitle}>{productName}</Text>
            </View>

            <View style={[styles.badge, { backgroundColor: status.bg }]}>
              <Text style={[styles.badgeText, { color: status.text }]}>
                {status.label}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={allowPayNow ? 0.92 : 1}
            onPress={allowPayNow ? () => payNow() : undefined}
            style={[styles.amountBox, allowPayNow ? styles.amountBoxActive : null]}
          >
            <View style={styles.amountTop}>
              <Text style={styles.amountLabel}>Amount left</Text>

              {allowPayNow ? (
                <View style={styles.payChip}>
                  <Text style={styles.payChipText}>Pay now</Text>
                  <Ionicons name="chevron-forward" size={15} color={WHITE} />
                </View>
              ) : null}
            </View>

            <Text style={styles.amountValue}>{outstanding}</Text>

            <View style={styles.divider} />

            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Amount received</Text>
              <Text style={styles.miniValue}>{principal}</Text>
            </View>

            <View style={styles.miniRow}>
              <Text style={styles.miniLabel}>Paid so far</Text>
              <Text style={styles.miniValue}>{totalPaid}</Text>
            </View>

            {weeklyEstimate > 0 ? (
              <View style={styles.miniRow}>
                <Text style={styles.miniLabel}>Estimated step amount</Text>
                <Text style={styles.miniValue}>{fmtKES(weeklyEstimate)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {allowPayNow ? (
            <View style={{ marginTop: SPACING.md }}>
              <Button title="Pay now" onPress={() => payNow()} />
            </View>
          ) : null}
        </Card>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons name="alert-circle-outline" size={18} color="#FECACA" />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <View style={styles.statRow}>
          <StatCard
            label="Amount received"
            value={principal}
            icon="cash-outline"
          />
          <View style={{ width: SPACING.sm }} />
          <StatCard
            label="Paid so far"
            value={totalPaid}
            icon="checkmark-circle-outline"
          />
        </View>

        <View style={{ height: SPACING.sm }} />

        <View style={styles.statRow}>
          <StatCard
            label="Amount left"
            value={outstanding}
            icon="wallet-outline"
          />
          <View style={{ width: SPACING.sm }} />
          <StatCard
            label="Weeks"
            value={`${loan.term_weeks || 0}`}
            icon="calendar-outline"
          />
        </View>

        <View style={styles.sectionGap} />

        {guarantors.length > 0 ? (
          <>
            <SectionTitle title="Community members involved" />
            <Card style={styles.blockCard} variant="default">
              {guarantors.map((g, idx) => {
                const accepted = !!g.accepted;

                return (
                  <View key={g.id || idx}>
                    <View style={styles.listRow}>
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <View style={styles.rowTop}>
                          <Text style={styles.listTitle}>
                            {getGuarantorDisplayName(g)}
                          </Text>

                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor: accepted
                                  ? SUCCESS_BG
                                  : WARNING_BG,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color: accepted
                                    ? SUCCESS_TEXT
                                    : WARNING_TEXT,
                                },
                              ]}
                            >
                              {accepted ? "Confirmed" : "Pending"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {idx < guarantors.length - 1 ? (
                      <View style={styles.lineDivider} />
                    ) : null}
                  </View>
                );
              })}
            </Card>
            <View style={styles.sectionGap} />
          </>
        ) : null}

        {paidInstallments.length > 0 ? (
          <>
            <SectionTitle title="Completed payments" />
            <Card style={styles.blockCard} variant="default">
              {paidInstallments.map((item, idx) => (
                <View key={item.id || idx}>
                  <InstallmentRow item={item} />
                  {idx < paidInstallments.length - 1 ? (
                    <View style={styles.lineDivider} />
                  ) : null}
                </View>
              ))}
            </Card>
            <View style={styles.sectionGap} />
          </>
        ) : null}

        {payments.length > 0 ? (
          <>
            <SectionTitle title="Payment history" />
            <Card style={styles.blockCard} variant="default">
              {payments.map((item, idx) => (
                <View key={item.id || idx}>
                  <PaymentRow item={item} />
                  {idx < payments.length - 1 ? (
                    <View style={styles.lineDivider} />
                  ) : null}
                </View>
              ))}
            </Card>
            <View style={styles.sectionGap} />
          </>
        ) : null}

        {isAdmin ? (
          <>
            <SectionTitle title="More details" />
            <Card style={styles.blockCard} variant="default">
              <DetailRow label="Member" value={borrowerName} />
              <DetailRow label="Status" value={status.label} />
              <DetailRow label="Type" value={productName} />
              <DetailRow
                label="Approved on"
                value={formatDateTime(loan.approved_at)}
              />
              <DetailRow
                label="Completed on"
                value={formatDateTime(loan.completed_at)}
              />
              <DetailRow
                label="Reviewed on"
                value={formatDateTime(loan.reviewed_at)}
              />

              {loan.member_note ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteTitle}>Member note</Text>
                  <Text style={styles.noteText}>{loan.member_note}</Text>
                </View>
              ) : null}

              {loan.rejection_reason ? (
                <View
                  style={[
                    styles.noteBox,
                    {
                      backgroundColor: DANGER_BG,
                      borderColor: "rgba(239,68,68,0.18)",
                    },
                  ]}
                >
                  <Text style={styles.noteTitle}>Reason</Text>
                  <Text style={styles.noteText}>{loan.rejection_reason}</Text>
                </View>
              ) : null}
            </Card>

            {canApproveOrReject ? (
              <>
                <View style={styles.sectionGap} />
                <SectionTitle title="Review action" />
                <Card style={styles.blockCard} variant="default">
                  <Button
                    title={busy ? "Please wait..." : "Approve request"}
                    onPress={onApprove}
                    disabled={busy}
                  />

                  <View style={{ height: SPACING.md }} />

                  <TextInput
                    value={rejectReason}
                    onChangeText={setRejectReason}
                    placeholder="Write reason"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    multiline
                    style={styles.input}
                  />

                  <View style={{ height: SPACING.sm }} />

                  <Button
                    title={busy ? "Please wait..." : "Decline request"}
                    variant="secondary"
                    onPress={onReject}
                    disabled={busy}
                  />
                </Card>
              </>
            ) : null}
          </>
        ) : null}

        <View style={styles.bottomActions}>
          <Button
            title="Back"
            variant="secondary"
            onPress={backToLoans}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
    padding: 24,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: SPACING.md,
  },

  pageTitle: {
    color: WHITE,
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  pageSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SOFT,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    fontFamily: FONT.bold,
    marginBottom: SPACING.sm,
    marginTop: 2,
  },

  sectionGap: {
    height: SPACING.lg,
  },

  heroCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  heroEyebrow: {
    color: MUTED,
    fontSize: 12,
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  heroTitle: {
    color: WHITE,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    color: TEXT,
    fontSize: 14,
    marginTop: 6,
    fontFamily: FONT.regular,
  },

  amountBox: {
    marginTop: SPACING.md,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: SPACING.md,
  },

  amountBoxActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  amountTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  amountLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  amountValue: {
    color: WHITE,
    fontSize: 32,
    lineHeight: 38,
    marginTop: 10,
    fontFamily: FONT.bold,
  },

  payChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: BRAND,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  payChipText: {
    color: WHITE,
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 12,
  },

  miniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
  },

  miniLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: FONT.regular,
    flex: 1,
  },

  miniValue: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
    textAlign: "right",
    flexShrink: 1,
  },

  statRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  statCard: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 18,
    padding: SPACING.md,
    minHeight: 118,
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(236,251,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  statLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  statValue: {
    color: WHITE,
    fontSize: 20,
    lineHeight: 26,
    marginTop: 8,
    fontFamily: FONT.bold,
  },

  blockCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
  },

  installmentCard: {
    paddingVertical: 4,
  },

  currentCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  installmentTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  installmentAmount: {
    color: WHITE,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 10,
    fontFamily: FONT.bold,
  },

  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },

  kvLabel: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  noteBox: {
    marginTop: SPACING.md,
    borderRadius: 16,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  noteTitle: {
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  noteText: {
    color: TEXT,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  listRow: {
    paddingVertical: 8,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  listTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  listSub: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    fontFamily: FONT.regular,
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  badgeText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  lineDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 10,
  },

  input: {
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "rgba(255,255,255,0.06)",
    color: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    fontFamily: FONT.regular,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: DANGER_BG,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  errorText: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  bottomActions: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
});


// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// import React, { useCallback, useMemo, useState } from "react";
// import {
//   Alert,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { ROUTES } from "@/constants/routes";
// import { FONT, SPACING } from "@/constants/theme";
// import {
//   approveLoan,
//   fmtKES,
//   getApiErrorMessage,
//   getLoanBorrowerId,
//   getLoanBorrowerName,
//   getLoanDetail,
//   getLoanProductName,
//   Loan,
//   LoanGuarantor,
//   LoanInstallment,
//   LoanPayment,
//   rejectLoan,
//   toNumber,
// } from "@/services/loans";
// import { getMe, MeResponse } from "@/services/profile";
// import { getSessionUser, SessionUser } from "@/services/session";

// type LocalUser = Partial<MeResponse> &
//   Partial<SessionUser> & {
//     id?: number;
//     is_staff?: boolean;
//     is_superuser?: boolean;
//   };

// const PAGE_BG = "#062C49";
// const BRAND = "#0C6A80";
// const WHITE = "#FFFFFF";
// const TEXT = "rgba(255,255,255,0.92)";
// const MUTED = "rgba(255,255,255,0.72)";
// const CARD_BG = "rgba(255,255,255,0.08)";
// const CARD_BORDER = "rgba(255,255,255,0.10)";
// const SOFT = "rgba(255,255,255,0.10)";
// const SUCCESS_BG = "rgba(34,197,94,0.16)";
// const SUCCESS_TEXT = "#DCFCE7";
// const WARNING_BG = "rgba(245,158,11,0.18)";
// const WARNING_TEXT = "#FEF3C7";
// const DANGER_BG = "rgba(239,68,68,0.18)";
// const DANGER_TEXT = "#FECACA";
// const INFO_BG = "rgba(12,106,128,0.20)";
// const INFO_TEXT = "#D9F3F9";

// const REPAYABLE_STATUSES = [
//   "APPROVED",
//   "DISBURSED",
//   "UNDER_REPAYMENT",
//   "DEFAULTED",
// ];

// function statusMeta(status?: string) {
//   switch ((status || "").toUpperCase()) {
//     case "COMPLETED":
//       return { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Completed" };
//     case "APPROVED":
//       return { bg: INFO_BG, text: INFO_TEXT, label: "Approved" };
//     case "DISBURSED":
//       return { bg: INFO_BG, text: INFO_TEXT, label: "Ready" };
//     case "UNDER_REPAYMENT":
//       return { bg: INFO_BG, text: INFO_TEXT, label: "Ongoing" };
//     case "DEFAULTED":
//       return { bg: DANGER_BG, text: DANGER_TEXT, label: "Overdue" };
//     case "REJECTED":
//       return { bg: DANGER_BG, text: DANGER_TEXT, label: "Not approved" };
//     case "UNDER_REVIEW":
//       return { bg: WARNING_BG, text: WARNING_TEXT, label: "Under review" };
//     case "PENDING":
//     default:
//       return { bg: WARNING_BG, text: WARNING_TEXT, label: "Pending" };
//   }
// }

// function formatDateTime(value?: string | null) {
//   if (!value) return "—";
//   return value;
// }

// function DetailRow({
//   label,
//   value,
// }: {
//   label: string;
//   value?: string | number | null;
// }) {
//   return (
//     <View style={styles.kvRow}>
//       <Text style={styles.kvLabel}>{label}</Text>
//       <Text style={styles.kvValue}>
//         {value == null || value === "" ? "—" : String(value)}
//       </Text>
//     </View>
//   );
// }

// function StatCard({
//   label,
//   value,
//   icon,
// }: {
//   label: string;
//   value: string;
//   icon: keyof typeof Ionicons.glyphMap;
// }) {
//   return (
//     <Card style={styles.statCard} variant="default">
//       <View style={styles.statIcon}>
//         <Ionicons name={icon} size={20} color={BRAND} />
//       </View>
//       <Text style={styles.statLabel}>{label}</Text>
//       <Text style={styles.statValue}>{value}</Text>
//     </Card>
//   );
// }

// function PaymentRow({ item }: { item: LoanPayment }) {
//   return (
//     <View style={styles.listRow}>
//       <View style={{ flex: 1, paddingRight: 12 }}>
//         <Text style={styles.listTitle}>
//           {item.method || "Payment"} • {fmtKES(item.amount)}
//         </Text>
//         <Text style={styles.listSub}>
//           {item.reference || "No reference"}
//           {item.created_at || item.paid_at
//             ? ` • ${item.created_at || item.paid_at}`
//             : ""}
//         </Text>
//       </View>
//     </View>
//   );
// }

// function getInstallmentPaidFlag(item: LoanInstallment | any) {
//   return !!item?.is_paid || !!item?.isPaid;
// }

// function InstallmentRow({
//   item,
//   onPay,
//   showPayButton,
//   highlight,
// }: {
//   item: LoanInstallment;
//   onPay?: () => void;
//   showPayButton?: boolean;
//   highlight?: boolean;
// }) {
//   const remaining =
//     toNumber(item.total_due) +
//     toNumber(item.late_fee) -
//     toNumber(item.paid_amount);

//   const isPaid = getInstallmentPaidFlag(item) || remaining <= 0;

//   const tone = isPaid
//     ? { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Paid" }
//     : toNumber(item.late_fee) > 0
//       ? { bg: DANGER_BG, text: DANGER_TEXT, label: "Due now" }
//       : { bg: WARNING_BG, text: WARNING_TEXT, label: "Current" };

//   return (
//     <View style={[styles.installmentCard, highlight ? styles.currentCard : null]}>
//       <View style={styles.rowTop}>
//         <Text style={styles.installmentTitle}>
//           Support step {item.installment_no}
//         </Text>
//         <View style={[styles.badge, { backgroundColor: tone.bg }]}>
//           <Text style={[styles.badgeText, { color: tone.text }]}>
//             {tone.label}
//           </Text>
//         </View>
//       </View>

//       <Text style={styles.installmentAmount}>
//         {fmtKES(remaining > 0 ? remaining : 0)}
//       </Text>

//       <Text style={styles.listSub}>
//         {item.due_date || "Current scheduled step"}
//       </Text>

//       <Text style={styles.listSub}>
//         Planned: {fmtKES(item.total_due)} • Paid: {fmtKES(item.paid_amount)}
//       </Text>

//       {showPayButton && !isPaid && onPay ? (
//         <View style={{ marginTop: SPACING.md }}>
//           <Button title="Pay This Step" onPress={onPay} />
//         </View>
//       ) : null}
//     </View>
//   );
// }

// function getGuarantorDisplayName(item?: LoanGuarantor | null) {
//   if (!item) return "Member";

//   const detail =
//     item.guarantor_detail ||
//     (typeof item.guarantor === "object" && item.guarantor ? item.guarantor : null);

//   if (!detail) return "Member";

//   const full =
//     detail.full_name?.trim() ||
//     `${detail.first_name || ""} ${detail.last_name || ""}`.trim();

//   return full || detail.username || detail.email || "Member";
// }

// function getLoanRate(loan?: Loan | null): number {
//   if (!loan) return 0;

//   const raw =
//     loan.product_detail?.annual_interest_rate ??
//     (typeof loan.product === "object" ? loan.product?.annual_interest_rate : 0);

//   const n = Number(raw ?? 0);
//   return Number.isFinite(n) ? n : 0;
// }

// function getLoanInterestType(loan?: Loan | null): string {
//   return String(
//     loan?.product_detail?.interest_type ??
//       (typeof loan?.product === "object" ? loan.product?.interest_type : "") ??
//       ""
//   ).toUpperCase();
// }

// function computeEstimatedTotalPayable(loan?: Loan | null): number {
//   if (!loan) return 0;

//   const principal = toNumber(loan.principal);
//   const termWeeks = Math.max(0, Number(loan.term_weeks || 0));
//   const rate = getLoanRate(loan) / 100;

//   if (principal <= 0 || termWeeks <= 0) return principal;

//   const backendTotal = toNumber(loan.total_payable);
//   if (backendTotal > 0) return backendTotal;

//   const interestType = getLoanInterestType(loan);

//   if (interestType === "REDUCING") {
//     const weeklyRate = rate / 52;
//     const weeklyPrincipal = principal / termWeeks;
//     let totalInterest = 0;
//     let balance = principal;

//     for (let i = 0; i < termWeeks; i += 1) {
//       totalInterest += balance * weeklyRate;
//       balance -= weeklyPrincipal;
//     }

//     return Math.max(0, principal + totalInterest);
//   }

//   const flatInterest = principal * rate * (termWeeks / 52);
//   return Math.max(0, principal + flatInterest);
// }

// function computeDisplayOutstanding(loan?: Loan | null): number {
//   if (!loan) return 0;

//   const backendOutstanding = toNumber(loan.outstanding_balance);
//   if (backendOutstanding > 0) return backendOutstanding;

//   const status = String(loan.status || "").toUpperCase();
//   const totalPaid = toNumber(loan.total_paid);
//   const estimatedTotal = computeEstimatedTotalPayable(loan);

//   if (REPAYABLE_STATUSES.includes(status)) {
//     return Math.max(0, estimatedTotal - totalPaid);
//   }

//   return Math.max(0, backendOutstanding);
// }

// function buildEstimatedInstallments(loan?: Loan | null): LoanInstallment[] {
//   if (!loan) return [];

//   const termWeeks = Math.max(0, Number(loan.term_weeks || 0));
//   const totalPaid = toNumber(loan.total_paid);
//   const totalPayable = computeEstimatedTotalPayable(loan);

//   if (termWeeks <= 0 || totalPayable <= 0) return [];

//   const weekly = totalPayable / termWeeks;
//   const paidInstallments = weekly > 0 ? Math.floor(totalPaid / weekly) : 0;

//   return Array.from({ length: termWeeks }).map((_, index) => {
//     const installmentNo = index + 1;
//     const isPaid = installmentNo <= paidInstallments;
//     const paidAmount = isPaid ? weekly : 0;

//     return {
//       id: installmentNo,
//       installment_no: installmentNo,
//       total_due: weekly,
//       paid_amount: paidAmount,
//       late_fee: 0,
//       is_paid: isPaid,
//       due_date: null,
//     } as LoanInstallment;
//   });
// }

// function getCurrentInstallment(installments: LoanInstallment[]) {
//   if (!installments.length) return null;

//   const nextOpen = installments.find((item) => {
//     const remaining =
//       toNumber(item.total_due) +
//       toNumber(item.late_fee) -
//       toNumber(item.paid_amount);
//     return !getInstallmentPaidFlag(item) && remaining > 0;
//   });

//   return nextOpen || null;
// }

// function getPreviouslyPaidInstallments(installments: LoanInstallment[]) {
//   return installments.filter((item) => getInstallmentPaidFlag(item));
// }

// export default function LoanDetailScreen() {
//   const insets = useSafeAreaInsets();
//   const params = useLocalSearchParams<{ id?: string; returnTo?: string }>();
//   const loanId = Number(params.id);

//   const [me, setMe] = useState<LocalUser | null>(null);
//   const [loan, setLoan] = useState<Loan | null>(null);

//   const [booted, setBooted] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);
//   const [busy, setBusy] = useState(false);

//   const [error, setError] = useState("");
//   const [rejectReason, setRejectReason] = useState("");

//   const backToLoans = useCallback(() => {
//     const target =
//       typeof params.returnTo === "string" && params.returnTo.trim()
//         ? params.returnTo
//         : ROUTES.tabs.loans;

//     router.replace(target as any);
//   }, [params.returnTo]);

//   const load = useCallback(
//     async (silent = false) => {
//       if (!loanId || Number.isNaN(loanId)) {
//         setLoan(null);
//         setError("Invalid support selected.");
//         return;
//       }

//       try {
//         if (!silent) setError("");

//         const [sessionRes, meRes, loanRes] = await Promise.allSettled([
//           getSessionUser(),
//           getMe(),
//           getLoanDetail(loanId),
//         ]);

//         const sessionUser =
//           sessionRes.status === "fulfilled" ? sessionRes.value : null;
//         const meUser = meRes.status === "fulfilled" ? meRes.value : null;

//         setMe(
//           sessionUser || meUser
//             ? {
//                 ...(sessionUser ?? {}),
//                 ...(meUser ?? {}),
//               }
//             : null
//         );

//         if (loanRes.status !== "fulfilled") {
//           if (!loan) {
//             setLoan(null);
//             setError(getApiErrorMessage(loanRes.reason));
//           }
//           return;
//         }

//         setLoan(loanRes.value);
//         setError("");
//       } catch (e: any) {
//         if (!loan) {
//           setLoan(null);
//           setError(getApiErrorMessage(e));
//         }
//       }
//     },
//     [loanId, loan]
//   );

//   useFocusEffect(
//     useCallback(() => {
//       let active = true;

//       (async () => {
//         try {
//           await load(true);
//         } finally {
//           if (active) setBooted(true);
//         }
//       })();

//       return () => {
//         active = false;
//       };
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     try {
//       await load(true);
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);

//   const myUserId = Number(me?.id || 0);
//   const borrowerId = getLoanBorrowerId(loan);
//   const isBorrower = !!myUserId && !!borrowerId && myUserId === borrowerId;
//   const isAdmin = !!(me?.is_staff || me?.is_superuser);

//   const canApproveOrReject =
//     isAdmin &&
//     ["PENDING", "UNDER_REVIEW"].includes(String(loan?.status || "").toUpperCase());

//   const status = statusMeta(loan?.status);
//   const borrowerName = getLoanBorrowerName(loan);
//   const productName = getLoanProductName(loan);

//   const principalValue = toNumber(loan?.principal);
//   const totalPaidValue = toNumber(loan?.total_paid);
//   const displayOutstanding = computeDisplayOutstanding(loan);

//   const principal = fmtKES(principalValue);
//   const totalPaid = fmtKES(totalPaidValue);
//   const outstanding = fmtKES(displayOutstanding);

//   const repaymentStatus = String(loan?.status || "").toUpperCase();
//   const allowPayNow =
//     isBorrower &&
//     REPAYABLE_STATUSES.includes(repaymentStatus) &&
//     displayOutstanding > 0;

//   const actualInstallments = loan?.installments ?? [];
//   const fallbackInstallments = buildEstimatedInstallments(loan);
//   const installments = actualInstallments.length
//     ? actualInstallments
//     : fallbackInstallments;

//   const currentInstallment = getCurrentInstallment(installments);
//   const paidInstallments = getPreviouslyPaidInstallments(installments);
//   const payments = loan?.payments ?? [];
//   const guarantors = loan?.guarantors ?? [];

//   const weeklyEstimate = useMemo(() => {
//     const termWeeks = Math.max(0, Number(loan?.term_weeks || 0));
//     const estimatedTotalPayable = computeEstimatedTotalPayable(loan);
//     if (termWeeks <= 0 || estimatedTotalPayable <= 0) return 0;
//     return estimatedTotalPayable / termWeeks;
//   }, [loan]);

//   const payNow = useCallback(
//     (amount?: number) => {
//       if (!loan?.id) return;

//       const borrowerUserId = getLoanBorrowerId(loan);
//       if (!borrowerUserId) {
//         Alert.alert(
//           "Unable to continue",
//           "Borrower details are missing for this support."
//         );
//         return;
//       }

//       const payAmount = Math.max(amount ?? displayOutstanding, 0);

//       router.push({
//         pathname: "/(tabs)/payments/deposit" as any,
//         params: {
//           source: "loan",
//           loanId: String(loan.id),
//           borrowerUserId: String(borrowerUserId),
//           amount: String(payAmount),
//           editableAmount: "true",
//           returnTo: ROUTES.tabs.loans,
//           backLabel: "Back to Support",
//           landingTitle: "Support Payment",
//         },
//       });
//     },
//     [loan, displayOutstanding]
//   );

//   const onApprove = useCallback(async () => {
//     if (!loan?.id) return;

//     try {
//       setBusy(true);
//       const res = await approveLoan(loan.id);
//       if (res?.loan) setLoan(res.loan);
//       Alert.alert("Success", res?.message || "Support approved successfully.");
//     } catch (e: any) {
//       Alert.alert("Unable to approve", getApiErrorMessage(e));
//     } finally {
//       setBusy(false);
//     }
//   }, [loan?.id]);

//   const onReject = useCallback(async () => {
//     if (!loan?.id) return;

//     if (!rejectReason.trim()) {
//       Alert.alert("Reason required", "Please enter a reason.");
//       return;
//     }

//     try {
//       setBusy(true);
//       const res = await rejectLoan(loan.id, rejectReason.trim());
//       if (res?.loan) setLoan(res.loan);
//       Alert.alert("Done", res?.message || "Support request updated.");
//     } catch (e: any) {
//       Alert.alert("Unable to reject", getApiErrorMessage(e));
//     } finally {
//       setBusy(false);
//     }
//   }, [loan?.id, rejectReason]);

//   if (!booted && !loan) {
//     return null;
//   }

//   if (!loanId || Number.isNaN(loanId)) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.emptyWrap}>
//           <EmptyState
//             title="Invalid support"
//             subtitle="The selected item could not be opened."
//             actionLabel="Back"
//             onAction={backToLoans}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!loan) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.emptyWrap}>
//           <EmptyState
//             title="Unable to load"
//             subtitle={error || "This item could not be loaded."}
//             actionLabel="Back"
//             onAction={backToLoans}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//       <ScrollView
//         style={styles.page}
//         contentContainerStyle={[
//           styles.content,
//           { paddingBottom: Math.max(insets.bottom + 24, 32) },
//         ]}
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={onRefresh}
//             tintColor="#8CF0C7"
//             colors={["#8CF0C7", "#0CC0B7"]}
//           />
//         }
//         showsVerticalScrollIndicator={false}
//       >
//         <View style={styles.topBar}>
//           <View style={{ flex: 1 }}>
//             <Text style={styles.pageTitle}>SUPPORT DETAILS</Text>
//             <Text style={styles.pageSub}>Community support record</Text>
//           </View>

//           <TouchableOpacity style={styles.iconBtn} onPress={backToLoans}>
//             <Ionicons name="arrow-back-outline" size={20} color={WHITE} />
//           </TouchableOpacity>
//         </View>

//         {currentInstallment ? (
//           <Section title="Current step">
//             <Card style={styles.blockCard} variant="default">
//               <InstallmentRow
//                 item={currentInstallment}
//                 highlight
//                 showPayButton={allowPayNow}
//                 onPay={() => {
//                   const remaining =
//                     toNumber(currentInstallment.total_due) +
//                     toNumber(currentInstallment.late_fee) -
//                     toNumber(currentInstallment.paid_amount);

//                   payNow(remaining > 0 ? remaining : undefined);
//                 }}
//               />
//             </Card>
//           </Section>
//         ) : null}

//         <Card style={styles.heroCard} variant="default">
//           <View style={styles.heroTop}>
//             <View style={{ flex: 1, paddingRight: 12 }}>
//               <Text style={styles.heroEyebrow}>SUPPORT #{loan.id}</Text>
//               <Text style={styles.heroTitle}>{borrowerName}</Text>
//               <Text style={styles.heroSubtitle}>{productName}</Text>
//             </View>

//             <View style={[styles.badge, { backgroundColor: status.bg }]}>
//               <Text style={[styles.badgeText, { color: status.text }]}>
//                 {status.label}
//               </Text>
//             </View>
//           </View>

//           <TouchableOpacity
//             activeOpacity={allowPayNow ? 0.92 : 1}
//             onPress={allowPayNow ? () => payNow() : undefined}
//             style={[styles.amountBox, allowPayNow ? styles.amountBoxActive : null]}
//           >
//             <View style={styles.amountTop}>
//               <Text style={styles.amountLabel}>Amount left</Text>

//               {allowPayNow ? (
//                 <View style={styles.payChip}>
//                   <Text style={styles.payChipText}>Pay Now</Text>
//                   <Ionicons name="chevron-forward" size={15} color={WHITE} />
//                 </View>
//               ) : null}
//             </View>

//             <Text style={styles.amountValue}>{outstanding}</Text>

//             <View style={styles.divider} />

//             <View style={styles.miniRow}>
//               <Text style={styles.miniLabel}>Support received</Text>
//               <Text style={styles.miniValue}>{principal}</Text>
//             </View>

//             <View style={styles.miniRow}>
//               <Text style={styles.miniLabel}>Paid so far</Text>
//               <Text style={styles.miniValue}>{totalPaid}</Text>
//             </View>

//             {weeklyEstimate > 0 ? (
//               <View style={styles.miniRow}>
//                 <Text style={styles.miniLabel}>Current step guide</Text>
//                 <Text style={styles.miniValue}>{fmtKES(weeklyEstimate)}</Text>
//               </View>
//             ) : null}
//           </TouchableOpacity>

//           {allowPayNow ? (
//             <View style={{ marginTop: SPACING.md }}>
//               <Button title="Pay Support" onPress={() => payNow()} />
//             </View>
//           ) : null}
//         </Card>

//         {error ? (
//           <Card style={styles.errorCard} variant="default">
//             <Ionicons name="alert-circle-outline" size={18} color="#FECACA" />
//             <Text style={styles.errorText}>{error}</Text>
//           </Card>
//         ) : null}

//         <Section title="Overview">
//           <View style={styles.statRow}>
//             <StatCard
//               label="Support received"
//               value={principal}
//               icon="cash-outline"
//             />
//             <View style={{ width: SPACING.sm }} />
//             <StatCard
//               label="Paid so far"
//               value={totalPaid}
//               icon="checkmark-circle-outline"
//             />
//           </View>

//           <View style={{ height: SPACING.sm }} />

//           <View style={styles.statRow}>
//             <StatCard
//               label="Amount left"
//               value={outstanding}
//               icon="wallet-outline"
//             />
//             <View style={{ width: SPACING.sm }} />
//             <StatCard
//               label="Steps"
//               value={`${loan.term_weeks || 0}`}
//               icon="calendar-outline"
//             />
//           </View>
//         </Section>

//         {guarantors.length > 0 ? (
//           <Section title="People supporting this support">
//             <Card style={styles.blockCard} variant="default">
//               {guarantors.map((g, idx) => {
//                 const accepted = !!g.accepted;

//                 return (
//                   <View key={g.id || idx}>
//                     <View style={styles.listRow}>
//                       <View style={{ flex: 1, paddingRight: 12 }}>
//                         <View style={styles.rowTop}>
//                           <Text style={styles.listTitle}>
//                             {getGuarantorDisplayName(g)}
//                           </Text>

//                           <View
//                             style={[
//                               styles.badge,
//                               {
//                                 backgroundColor: accepted
//                                   ? SUCCESS_BG
//                                   : WARNING_BG,
//                               },
//                             ]}
//                           >
//                             <Text
//                               style={[
//                                 styles.badgeText,
//                                 {
//                                   color: accepted
//                                     ? SUCCESS_TEXT
//                                     : WARNING_TEXT,
//                                 },
//                               ]}
//                             >
//                               {accepted ? "Confirmed" : "Pending"}
//                             </Text>
//                           </View>
//                         </View>
//                       </View>
//                     </View>

//                     {idx < guarantors.length - 1 ? (
//                       <View style={styles.lineDivider} />
//                     ) : null}
//                   </View>
//                 );
//               })}
//             </Card>
//           </Section>
//         ) : null}

//         {paidInstallments.length > 0 ? (
//           <Section title="Completed steps">
//             <Card style={styles.blockCard} variant="default">
//               {paidInstallments.map((item, idx) => (
//                 <View key={item.id || idx}>
//                   <InstallmentRow item={item} />
//                   {idx < paidInstallments.length - 1 ? (
//                     <View style={styles.lineDivider} />
//                   ) : null}
//                 </View>
//               ))}
//             </Card>
//           </Section>
//         ) : null}

//         {payments.length > 0 ? (
//           <Section title="Payment history">
//             <Card style={styles.blockCard} variant="default">
//               {payments.map((item, idx) => (
//                 <View key={item.id || idx}>
//                   <PaymentRow item={item} />
//                   {idx < payments.length - 1 ? (
//                     <View style={styles.lineDivider} />
//                   ) : null}
//                 </View>
//               ))}
//             </Card>
//           </Section>
//         ) : null}

//         {isAdmin ? (
//           <>
//             <Section title="Admin details">
//               <Card style={styles.blockCard} variant="default">
//                 <DetailRow label="Member" value={borrowerName} />
//                 <DetailRow label="Status" value={status.label} />
//                 <DetailRow label="Type" value={productName} />
//                 <DetailRow
//                   label="Approved on"
//                   value={formatDateTime(loan.approved_at)}
//                 />
//                 <DetailRow
//                   label="Completed on"
//                   value={formatDateTime(loan.completed_at)}
//                 />
//                 <DetailRow
//                   label="Reviewed on"
//                   value={formatDateTime(loan.reviewed_at)}
//                 />

//                 {loan.member_note ? (
//                   <View style={styles.noteBox}>
//                     <Text style={styles.noteTitle}>Member note</Text>
//                     <Text style={styles.noteText}>{loan.member_note}</Text>
//                   </View>
//                 ) : null}

//                 {loan.rejection_reason ? (
//                   <View
//                     style={[
//                       styles.noteBox,
//                       {
//                         backgroundColor: DANGER_BG,
//                         borderColor: "rgba(239,68,68,0.18)",
//                       },
//                     ]}
//                   >
//                     <Text style={styles.noteTitle}>Reason</Text>
//                     <Text style={styles.noteText}>{loan.rejection_reason}</Text>
//                   </View>
//                 ) : null}
//               </Card>
//             </Section>

//             {canApproveOrReject ? (
//               <Section title="Admin action">
//                 <Card style={styles.blockCard} variant="default">
//                   <Button
//                     title={busy ? "Please wait..." : "Approve Support"}
//                     onPress={onApprove}
//                     disabled={busy}
//                   />

//                   <View style={{ height: SPACING.md }} />

//                   <TextInput
//                     value={rejectReason}
//                     onChangeText={setRejectReason}
//                     placeholder="Write reason"
//                     placeholderTextColor="rgba(255,255,255,0.45)"
//                     multiline
//                     style={styles.input}
//                   />

//                   <View style={{ height: SPACING.sm }} />

//                   <Button
//                     title={busy ? "Please wait..." : "Decline Support"}
//                     variant="secondary"
//                     onPress={onReject}
//                     disabled={busy}
//                   />
//                 </Card>
//               </Section>
//             ) : null}
//           </>
//         ) : null}

//         <View style={styles.bottomActions}>
//           <Button
//             title="Back"
//             variant="secondary"
//             onPress={backToLoans}
//             style={{ flex: 1 }}
//           />
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     flex: 1,
//     backgroundColor: PAGE_BG,
//   },

//   content: {
//     paddingHorizontal: SPACING.md,
//     paddingTop: SPACING.sm,
//   },

//   emptyWrap: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: PAGE_BG,
//     padding: 24,
//   },

//   topBar: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 12,
//     marginBottom: SPACING.md,
//   },

//   pageTitle: {
//     color: WHITE,
//     fontSize: 20,
//     fontFamily: FONT.bold,
//     letterSpacing: 0.8,
//   },

//   pageSub: {
//     color: MUTED,
//     fontSize: 13,
//     marginTop: 4,
//     fontFamily: FONT.regular,
//   },

//   iconBtn: {
//     width: 46,
//     height: 46,
//     borderRadius: 16,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: SOFT,
//     borderWidth: 1,
//     borderColor: CARD_BORDER,
//   },

//   heroCard: {
//     backgroundColor: "rgba(12,106,128,0.22)",
//     borderWidth: 1,
//     borderColor: "rgba(12,106,128,0.30)",
//     borderRadius: 24,
//     padding: SPACING.md,
//     marginBottom: SPACING.lg,
//   },

//   heroTop: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//     gap: 10,
//   },

//   heroEyebrow: {
//     color: "rgba(255,255,255,0.75)",
//     fontSize: 12,
//     fontFamily: FONT.bold,
//     letterSpacing: 1.1,
//     marginBottom: 8,
//   },

//   heroTitle: {
//     color: WHITE,
//     fontSize: 26,
//     lineHeight: 32,
//     fontFamily: FONT.bold,
//   },

//   heroSubtitle: {
//     color: TEXT,
//     fontSize: 14,
//     marginTop: 6,
//     fontFamily: FONT.regular,
//   },

//   amountBox: {
//     marginTop: SPACING.md,
//     borderRadius: 20,
//     backgroundColor: "rgba(255,255,255,0.10)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.12)",
//     padding: SPACING.md,
//   },

//   amountBoxActive: {
//     backgroundColor: "rgba(255,255,255,0.13)",
//   },

//   amountTop: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: 10,
//   },

//   amountLabel: {
//     color: MUTED,
//     fontSize: 13,
//     fontFamily: FONT.regular,
//   },

//   amountValue: {
//     color: WHITE,
//     fontSize: 32,
//     lineHeight: 38,
//     marginTop: 10,
//     fontFamily: FONT.bold,
//   },

//   payChip: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 4,
//     backgroundColor: BRAND,
//     paddingHorizontal: 10,
//     paddingVertical: 6,
//     borderRadius: 999,
//   },

//   payChipText: {
//     color: WHITE,
//     fontSize: 11,
//     fontFamily: FONT.bold,
//   },

//   divider: {
//     height: 1,
//     backgroundColor: "rgba(255,255,255,0.10)",
//     marginVertical: 12,
//   },

//   miniRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: 10,
//     marginTop: 8,
//   },

//   miniLabel: {
//     color: MUTED,
//     fontSize: 13,
//     fontFamily: FONT.regular,
//     flex: 1,
//   },

//   miniValue: {
//     color: WHITE,
//     fontSize: 13,
//     fontFamily: FONT.bold,
//     textAlign: "right",
//     flexShrink: 1,
//   },

//   statRow: {
//     flexDirection: "row",
//     alignItems: "stretch",
//   },

//   statCard: {
//     flex: 1,
//     backgroundColor: CARD_BG,
//     borderWidth: 1,
//     borderColor: CARD_BORDER,
//     borderRadius: 18,
//     padding: SPACING.md,
//     minHeight: 118,
//   },

//   statIcon: {
//     width: 40,
//     height: 40,
//     borderRadius: 12,
//     backgroundColor: "rgba(236,251,255,0.88)",
//     alignItems: "center",
//     justifyContent: "center",
//     marginBottom: 12,
//   },

//   statLabel: {
//     color: MUTED,
//     fontSize: 13,
//     fontFamily: FONT.regular,
//   },

//   statValue: {
//     color: WHITE,
//     fontSize: 20,
//     lineHeight: 26,
//     marginTop: 8,
//     fontFamily: FONT.bold,
//   },

//   blockCard: {
//     backgroundColor: CARD_BG,
//     borderWidth: 1,
//     borderColor: CARD_BORDER,
//     borderRadius: 20,
//     padding: SPACING.md,
//   },

//   installmentCard: {
//     paddingVertical: 4,
//   },

//   currentCard: {
//     borderRadius: 18,
//     backgroundColor: "rgba(255,255,255,0.05)",
//     padding: SPACING.md,
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.08)",
//   },

//   installmentTitle: {
//     color: WHITE,
//     fontSize: 16,
//     fontFamily: FONT.bold,
//   },

//   installmentAmount: {
//     color: WHITE,
//     fontSize: 28,
//     lineHeight: 34,
//     marginTop: 10,
//     fontFamily: FONT.bold,
//   },

//   kvRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: SPACING.md,
//     paddingVertical: 10,
//     borderBottomWidth: 1,
//     borderBottomColor: "rgba(255,255,255,0.08)",
//   },

//   kvLabel: {
//     flex: 1,
//     color: MUTED,
//     fontSize: 13,
//     fontFamily: FONT.regular,
//   },

//   kvValue: {
//     flexShrink: 1,
//     textAlign: "right",
//     color: WHITE,
//     fontSize: 13,
//     fontFamily: FONT.bold,
//   },

//   noteBox: {
//     marginTop: SPACING.md,
//     borderRadius: 16,
//     padding: SPACING.md,
//     backgroundColor: "rgba(255,255,255,0.06)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.08)",
//   },

//   noteTitle: {
//     color: WHITE,
//     fontSize: 14,
//     fontFamily: FONT.bold,
//     marginBottom: 6,
//   },

//   noteText: {
//     color: TEXT,
//     fontSize: 13,
//     lineHeight: 20,
//     fontFamily: FONT.regular,
//   },

//   listRow: {
//     paddingVertical: 8,
//   },

//   rowTop: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: 10,
//     flexWrap: "wrap",
//   },

//   listTitle: {
//     color: WHITE,
//     fontSize: 15,
//     fontFamily: FONT.bold,
//   },

//   listSub: {
//     color: MUTED,
//     fontSize: 13,
//     lineHeight: 20,
//     marginTop: 6,
//     fontFamily: FONT.regular,
//   },

//   badge: {
//     borderRadius: 999,
//     paddingHorizontal: 10,
//     paddingVertical: 5,
//   },

//   badgeText: {
//     fontSize: 11,
//     fontFamily: FONT.bold,
//   },

//   lineDivider: {
//     height: 1,
//     backgroundColor: "rgba(255,255,255,0.08)",
//     marginVertical: 10,
//   },

//   emptyText: {
//     color: MUTED,
//     fontSize: 13,
//     lineHeight: 20,
//     fontFamily: FONT.regular,
//   },

//   input: {
//     minHeight: 92,
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: CARD_BORDER,
//     backgroundColor: "rgba(255,255,255,0.06)",
//     color: WHITE,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     textAlignVertical: "top",
//     fontFamily: FONT.regular,
//   },

//   errorCard: {
//     marginBottom: SPACING.md,
//     padding: SPACING.md,
//     borderRadius: 20,
//     backgroundColor: DANGER_BG,
//     borderWidth: 1,
//     borderColor: "rgba(239,68,68,0.20)",
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//   },

//   errorText: {
//     flex: 1,
//     color: WHITE,
//     fontSize: 13,
//     lineHeight: 20,
//     fontFamily: FONT.regular,
//   },

//   bottomActions: {
//     marginTop: SPACING.sm,
//     marginBottom: SPACING.sm,
//   },
// });