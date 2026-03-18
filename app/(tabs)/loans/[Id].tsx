// app/(tabs)/loans/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { getApiErrorMessage, getLoanDetail, Loan } from "@/services/loans";

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatKes(value?: string | number | null) {
  const n = toNum(value);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function statusText(status?: string | null) {
  if (!status) return "—";
  return String(status).replaceAll("_", " ");
}

function getStatusColors(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s === "APPROVED") {
    return {
      bg: "rgba(46, 125, 50, 0.12)",
      color: COLORS.success,
    };
  }

  if (s === "COMPLETED") {
    return {
      bg: "rgba(37, 99, 235, 0.12)",
      color: COLORS.primary,
    };
  }

  if (s === "REJECTED" || s === "DEFAULTED" || s === "CANCELLED") {
    return {
      bg: "rgba(211, 47, 47, 0.12)",
      color: COLORS.danger,
    };
  }

  if (s === "UNDER_REVIEW") {
    return {
      bg: "rgba(37, 99, 235, 0.12)",
      color: COLORS.info,
    };
  }

  return {
    bg: "rgba(242, 140, 40, 0.14)",
    color: COLORS.accent,
  };
}

function StatusPill({ status }: { status: string }) {
  const { bg, color } = getStatusColors(status);

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>
        {String(statusText(status)).toUpperCase()}
      </Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kLabel, strong && { color: COLORS.dark }]}>
        {label}
      </Text>
      <Text style={[styles.kValue, strong && { fontFamily: FONT.bold }]}>
        {value}
      </Text>
    </View>
  );
}

function productLabel(loan?: Loan | null) {
  if (!loan) return "—";
  return (
    loan.product_detail?.name ||
    loan.product_name ||
    `Product #${loan.product}`
  );
}

export default function LoanDetailScreen() {
  const params = useLocalSearchParams();
  const loanId = Number(params.id);

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!Number.isFinite(loanId) || loanId <= 0) return;

    try {
      setError("");
      const data = await getLoanDetail(loanId);
      setLoan(data);
    } catch (e: any) {
      setLoan(null);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, [loanId]);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(loanId) || loanId <= 0) return;
      initialLoad();
    }, [initialLoad, loanId])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const isPendingOrReview = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    return s === "PENDING" || s === "UNDER_REVIEW";
  }, [loan?.status]);

  const canPay = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    const outstanding = toNum(loan?.outstanding_balance);
    return (s === "APPROVED" || s === "DEFAULTED") && outstanding > 0;
  }, [loan?.status, loan?.outstanding_balance]);

  const securityAllocations = useMemo(() => {
    return Array.isArray(loan?.security_allocations)
      ? loan!.security_allocations.filter((x) => x.is_active)
      : [];
  }, [loan]);

  const guarantors = useMemo(() => {
    return Array.isArray(loan?.guarantors) ? loan!.guarantors : [];
  }, [loan]);

  const installments = useMemo(() => {
    return Array.isArray(loan?.installments) ? loan!.installments : [];
  }, [loan]);

  const payments = useMemo(() => {
    return Array.isArray(loan?.payments) ? loan!.payments : [];
  }, [loan]);

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <EmptyState title="Invalid loan" subtitle="This loan ID is not valid." />
      </View>
    );
  }

  if (loading && !loan) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.title}>Loan #{loanId}</Text>
          <Text style={styles.sub}>
            {productLabel(loan)}
            {loan?.term_weeks ? ` • ${loan.term_weeks} week(s)` : ""}
          </Text>
        </View>

        {loan?.status ? <StatusPill status={loan.status} /> : null}
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

      <Section title="Summary">
        <Card style={styles.card}>
          {!loan ? (
            <EmptyState
              title="Loan not found"
              subtitle="Please refresh and try again."
            />
          ) : (
            <View style={styles.group}>
              <DetailRow label="Principal" value={formatKes(loan.principal)} />
              <DetailRow
                label="Total payable"
                value={
                  toNum(loan.total_payable) > 0
                    ? formatKes(loan.total_payable)
                    : "Pending approval"
                }
              />
              <DetailRow
                label="Paid so far"
                value={formatKes(loan.total_paid ?? "0.00")}
              />

              <View style={styles.divider} />

              <DetailRow
                label="Outstanding"
                value={formatKes(loan.outstanding_balance ?? "0.00")}
                strong
              />
              <DetailRow label="Status" value={statusText(loan.status)} />
              <DetailRow label="Product" value={productLabel(loan)} />
              <DetailRow
                label="Created"
                value={formatDateTime(loan.created_at)}
              />
              <DetailRow
                label="Approved"
                value={formatDateTime(loan.approved_at)}
              />
              <DetailRow
                label="Rejected"
                value={formatDateTime(loan.rejected_at)}
              />
              <DetailRow
                label="Completed"
                value={formatDateTime(loan.completed_at)}
              />
            </View>
          )}
        </Card>
      </Section>

      <Section title="Security">
        <Card style={styles.card}>
          {!loan ? (
            <Text style={styles.muted}>—</Text>
          ) : (
            <View style={styles.group}>
              <DetailRow
                label="Security target"
                value={formatKes(loan.security_target ?? "0.00")}
              />
              <DetailRow
                label="Reserved total"
                value={formatKes(loan.security_reserved_total ?? "0.00")}
              />

              {securityAllocations.length === 0 ? (
                <Text style={styles.muted}>
                  No active security allocations are available yet for this loan.
                </Text>
              ) : (
                securityAllocations.map((item) => (
                  <View key={item.id} style={styles.allocationRow}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.allocationTitle}>
                        {String(item.source_type).replaceAll("_", " ")}
                      </Text>
                      <Text style={styles.allocationSub}>
                        {item.owner_detail?.full_name || `User #${item.owner_user}`}
                      </Text>
                    </View>
                    <Text style={styles.allocationAmount}>
                      {formatKes(item.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}
        </Card>
      </Section>

      <Section title="Guarantors">
        <Card style={styles.card}>
          {!loan ? (
            <Text style={styles.muted}>—</Text>
          ) : guarantors.length === 0 ? (
            <Text style={styles.muted}>No guarantors added yet.</Text>
          ) : (
            <View style={styles.group}>
              {guarantors.map((g) => (
                <View key={g.id} style={styles.allocationRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.allocationTitle}>
                      {g.guarantor_detail?.full_name || `Guarantor #${g.guarantor}`}
                    </Text>
                    <Text style={styles.allocationSub}>
                      {g.accepted ? "Accepted" : "Pending"} • Reserved{" "}
                      {formatKes(g.reserved_amount ?? "0.00")}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.smallBadge,
                      { color: g.accepted ? COLORS.success : COLORS.warning },
                    ]}
                  >
                    {g.accepted ? "ACCEPTED" : "PENDING"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Section>

      <Section title="Installments">
        <Card style={styles.card}>
          {!loan ? (
            <Text style={styles.muted}>—</Text>
          ) : installments.length === 0 ? (
            <Text style={styles.muted}>
              Installments will appear after approval.
            </Text>
          ) : (
            <View style={styles.group}>
              {installments.map((inst) => (
                <View key={inst.id} style={styles.installmentRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.allocationTitle}>
                      Installment {inst.installment_no}
                    </Text>
                    <Text style={styles.allocationSub}>
                      Due {formatDateTime(inst.due_date)}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.allocationAmount}>
                      {formatKes(inst.total_due)}
                    </Text>
                    <Text style={styles.installmentMeta}>
                      Paid {formatKes(inst.paid_amount)} •{" "}
                      {inst.is_paid ? "Paid" : "Pending"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Section>

      <Section title="Payments">
        <Card style={styles.card}>
          {!loan ? (
            <Text style={styles.muted}>—</Text>
          ) : payments.length === 0 ? (
            <Text style={styles.muted}>No payments recorded yet.</Text>
          ) : (
            <View style={styles.group}>
              {payments.map((p) => (
                <View key={p.id} style={styles.installmentRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.allocationTitle}>
                      {formatKes(p.amount)}
                    </Text>
                    <Text style={styles.allocationSub}>
                      {p.method}
                      {p.reference ? ` • ${p.reference}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.installmentMeta}>
                    {formatDateTime(p.paid_at)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Section>

      {loan?.member_note || loan?.admin_note ? (
        <Section title="Notes">
          <Card style={styles.card}>
            <View style={styles.group}>
              {loan.member_note ? (
                <View>
                  <Text style={styles.noteTitle}>Member note</Text>
                  <Text style={styles.noteText}>{loan.member_note}</Text>
                </View>
              ) : null}

              {loan.admin_note ? (
                <View>
                  <Text style={styles.noteTitle}>Admin note</Text>
                  <Text style={styles.noteText}>{loan.admin_note}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        </Section>
      ) : null}

      <Section title="Actions">
        <View style={{ gap: SPACING.sm }}>
          <Button
            title="Add Guarantor"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/loans/add-guarantor" as any,
                params: { loan: String(loanId) },
              })
            }
            disabled={!isPendingOrReview}
          />

          <Button
            title="Repay Loan"
            onPress={() =>
              router.push({
                pathname: "/(tabs)/loans/pay" as any,
                params: {
                  loan: String(loanId),
                  due: String(loan?.outstanding_balance ?? "0.00"),
                },
              })
            }
            disabled={!canPay}
          />

          <Button
            title="Back to Loans"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>

        <View style={styles.hintRow}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.gray}
          />
          <Text style={styles.hintText}>
            Repayments made through MPESA STK Push may take a short moment to
            reflect after callback confirmation.
          </Text>
        </View>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  center: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: "center",
  },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  card: {
    padding: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
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

  muted: {
    fontFamily: FONT.regular,
    color: COLORS.gray,
    fontSize: 12,
    lineHeight: 18,
  },

  group: {
    gap: 12,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  kLabel: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kValue: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.dark,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },

  allocationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },

  allocationTitle: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  allocationSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  allocationAmount: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    textAlign: "right",
  },

  installmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },

  installmentMeta: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    textAlign: "right",
  },

  smallBadge: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  noteTitle: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 4,
  },

  noteText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  hintRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },

  hintText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  pillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});