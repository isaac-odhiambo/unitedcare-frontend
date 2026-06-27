import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  approveLoan,
  canApproveLoan,
  canDisburseLoan,
  disburseLoan,
  fmtKES,
  getAdminLoans,
  getApiErrorMessage,
  getLoanAmountDueNow,
  getLoanBorrowerName,
  getLoanDaysOverdue,
  getLoanDaysRemaining,
  getLoanDefaultSummary,
  getLoanProductName,
  getLoanStatusLabel,
  Loan,
  toNumber,
} from "@/services/loans";
import { getSessionUser, SessionUser } from "@/services/session";

type AdminUser = Partial<SessionUser> & {
  is_admin?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  role?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString();
}

function statusColor(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
    case "DISBURSED":
    case "UNDER_REPAYMENT":
      return COLORS.primary;
    case "COMPLETED":
      return COLORS.success;
    case "PENDING":
    case "UNDER_REVIEW":
      return COLORS.warning;
    case "DEFAULTED":
    case "REJECTED":
    case "CANCELLED":
      return COLORS.danger;
    default:
      return COLORS.gray;
  }
}

function isAdminUser(user?: AdminUser | null) {
  if (!user) return false;

  return (
    !!user.is_admin ||
    !!user.is_staff ||
    !!user.is_superuser ||
    String(user.role || "").toLowerCase() === "admin" ||
    String(user.role || "").toLowerCase() === "superadmin"
  );
}

function InfoCell({
  label,
  value,
  danger,
}: {
  label: string;
  value?: string | number | null;
  danger?: boolean;
}) {
  return (
    <View style={styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, danger ? styles.dangerText : null]}>
        {value == null || value === "" ? "—" : String(value)}
      </Text>
    </View>
  );
}

function LoanCard({
  loan,
  busy,
  onApprove,
  onDisburse,
  onView,
}: {
  loan: Loan;
  busy: boolean;
  onApprove: () => void;
  onDisburse: () => void;
  onView: () => void;
}) {
  const status = String(loan.status || "").toUpperCase();
  const guarantorCount = Array.isArray(loan.guarantors)
    ? loan.guarantors.length
    : 0;
  const acceptedGuarantors = Array.isArray(loan.guarantors)
    ? loan.guarantors.filter((g) => g.accepted).length
    : 0;

  const daysOverdue = getLoanDaysOverdue(loan);
  const daysRemaining = getLoanDaysRemaining(loan);
  const dueNow = getLoanAmountDueNow(loan);
  const defaultInterest = toNumber(loan.default_interest_total);
  const lateFee = toNumber(loan.late_fee_total);

  const showApprove = canApproveLoan(loan);
  const showDisburse = canDisburseLoan(loan);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>Support #{loan.id}</Text>
          <Text style={styles.sub}>
            {getLoanProductName(loan)} • {loan.term_weeks || 0} week(s)
          </Text>
        </View>

        <Text style={[styles.status, { color: statusColor(status) }]}>
          {getLoanStatusLabel(loan).toUpperCase()}
        </Text>
      </View>

      <View style={styles.grid}>
        <InfoCell label="Support amount" value={fmtKES(loan.principal)} />
        <InfoCell label="Member" value={getLoanBorrowerName(loan)} />
      </View>

      <View style={styles.grid}>
        <InfoCell label="Requested" value={formatDateTime(loan.requested_at || loan.created_at)} />
        <InfoCell
          label="Supporting members"
          value={`${acceptedGuarantors}/${guarantorCount} accepted`}
        />
      </View>

      <View style={styles.grid}>
        <InfoCell
          label="Cover target"
          value={loan.security_target ? fmtKES(loan.security_target) : "—"}
        />
        <InfoCell
          label="Reserved cover"
          value={
            loan.security_reserved_total
              ? fmtKES(loan.security_reserved_total)
              : "—"
          }
        />
      </View>

      <View style={styles.grid}>
        <InfoCell
          label="Total expected"
          value={loan.total_payable ? fmtKES(loan.total_payable) : "—"}
        />
        <InfoCell
          label="Remaining"
          value={loan.outstanding_balance ? fmtKES(loan.outstanding_balance) : "—"}
          danger={daysOverdue > 0}
        />
      </View>

      <View style={styles.grid}>
        <InfoCell
          label="Needed now"
          value={dueNow > 0 ? fmtKES(dueNow) : "—"}
          danger={daysOverdue > 0}
        />
        <InfoCell
          label={daysOverdue > 0 ? "Days late" : "Days remaining"}
          value={daysOverdue > 0 ? daysOverdue : daysRemaining || "—"}
          danger={daysOverdue > 0}
        />
      </View>

      {defaultInterest > 0 || lateFee > 0 ? (
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
          <Text style={styles.warningText}>
            {getLoanDefaultSummary(loan)}
          </Text>
        </View>
      ) : null}

      {loan.member_note ? (
        <Text style={styles.note}>Member note: {loan.member_note}</Text>
      ) : null}

      {loan.rejection_reason ? (
        <Text style={[styles.note, styles.dangerText]}>
          Rejection reason: {loan.rejection_reason}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {showApprove ? (
          <>
            <Button
              title={busy ? "Approving..." : "Approve"}
              onPress={onApprove}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
          </>
        ) : null}

        {showDisburse ? (
          <>
            <Button
              title={busy ? "Disbursing..." : "Release"}
              onPress={onDisburse}
              loading={busy}
              disabled={busy}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
          </>
        ) : null}

        <Button
          title="View"
          variant="secondary"
          onPress={onView}
          disabled={busy}
          style={{ flex: 1 }}
        />
      </View>

      {showApprove ? (
        <Text style={styles.note}>
          Approval runs checks, reserves cover, creates steps, and marks the record approved.
        </Text>
      ) : null}

      {showDisburse ? (
        <Text style={styles.note}>
          Release marks the support as given and starts progress tracking.
        </Text>
      ) : null}
    </Card>
  );
}

export default function AdminApproveLoansScreen() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [items, setItems] = useState<Loan[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, loansRes] = await Promise.allSettled([
        getSessionUser(),
        getAdminLoans(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? (sessionRes.value as AdminUser) : null;

      setUser(sessionUser);

      if (loansRes.status === "fulfilled") {
        setItems(Array.isArray(loansRes.value) ? loansRes.value : []);
      } else {
        setItems([]);
        setError(getApiErrorMessage(loansRes.reason) || getErrorMessage(loansRes.reason));
      }

      if (sessionRes.status === "rejected") {
        setError(getApiErrorMessage(sessionRes.reason) || getErrorMessage(sessionRes.reason));
      }
    } catch (e: any) {
      setItems([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const isAdmin = isAdminUser(user);

  const pending = useMemo(() => {
    return items.filter((l) =>
      ["PENDING", "UNDER_REVIEW"].includes(String(l.status || "").toUpperCase())
    );
  }, [items]);

  const approved = useMemo(() => {
    return items.filter(
      (l) => String(l.status || "").toUpperCase() === "APPROVED"
    );
  }, [items]);

  const repayment = useMemo(() => {
    return items.filter((l) =>
      ["DISBURSED", "UNDER_REPAYMENT", "DEFAULTED"].includes(
        String(l.status || "").toUpperCase()
      )
    );
  }, [items]);

  const closed = useMemo(() => {
    return items.filter((l) =>
      ["COMPLETED", "REJECTED", "CANCELLED"].includes(
        String(l.status || "").toUpperCase()
      )
    );
  }, [items]);

  const doApprove = useCallback(
    async (loanId: number) => {
      Alert.alert("Approve Support", `Approve support #${loanId}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            try {
              setBusyId(loanId);
              setError("");
              const res = await approveLoan(loanId);
              Alert.alert("Success", res?.message || "Support approved.");
              await load();
            } catch (e: any) {
              const msg = getApiErrorMessage(e) || getErrorMessage(e);
              setError(msg);
              Alert.alert("Approve Support", msg);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [load]
  );

  const doDisburse = useCallback(
    async (loanId: number) => {
      Alert.alert("Release Support", `Release support #${loanId}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Release",
          style: "default",
          onPress: async () => {
            try {
              setBusyId(loanId);
              setError("");
              const res = await disburseLoan(loanId);
              Alert.alert("Success", res?.message || "Support released.");
              await load();
            } catch (e: any) {
              const msg = getApiErrorMessage(e) || getErrorMessage(e);
              setError(msg);
              Alert.alert("Release Support", msg);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [load]
  );

  const openDetail = useCallback((loanId: number) => {
    router.push(`/(tabs)/loans/${loanId}` as any);
  }, []);

  const renderLoanList = (rows: Loan[], emptyTitle: string, emptySubtitle: string) => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      );
    }

    if (rows.length === 0) {
      return <EmptyState title={emptyTitle} subtitle={emptySubtitle} />;
    }

    return rows.map((loan) => (
      <LoanCard
        key={loan.id}
        loan={loan}
        busy={busyId === loan.id}
        onApprove={() => doApprove(loan.id)}
        onDisburse={() => doDisburse(loan.id)}
        onView={() => openDetail(loan.id)}
      />
    ));
  };

  if (!loading && !isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin only"
          subtitle="You do not have access to manage support records."
        />
        <View style={{ height: SPACING.md }} />
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.hTitle}>Support Admin</Text>
          <Text style={styles.hSub}>
            Review pending requests, approve valid records, release support, and monitor progress/late tracking.
          </Text>
        </View>

        <Ionicons
          name="checkmark-done-outline"
          size={22}
          color={COLORS.primary}
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title={`Pending Approval (${pending.length})`}>
        {renderLoanList(
          pending,
          "No pending requests",
          "Pending and under-review requests will appear here."
        )}
      </Section>

      <Section title={`Approved Awaiting Release (${approved.length})`}>
        {renderLoanList(
          approved,
          "No approved records waiting",
          "Approved records waiting for release will appear here."
        )}
      </Section>

      <Section title={`Progress / Late Tracking (${repayment.length})`}>
        {renderLoanList(
          repayment,
          "No active progress records",
          "Released, in-progress, and late records will appear here."
        )}
      </Section>

      <Section title={`Closed Records (${closed.length})`}>
        {renderLoanList(
          closed,
          "No closed records",
          "Completed, not approved, and cancelled records will appear here."
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  center: { flex: 1, padding: SPACING.lg, justifyContent: "center" },

  loadingWrap: {
    paddingVertical: SPACING.lg,
  },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  status: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  grid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  cell: {
    width: "48%",
  },

  label: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  value: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  dangerText: {
    color: COLORS.danger,
  },

  warningBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.16)",
    padding: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  warningText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },

  actions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },
});
