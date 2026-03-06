// app/(tabs)/loans/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getLoanDetail, Loan } from "@/services/loans";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || "").toUpperCase();

  const bg =
    s === "APPROVED" || s === "COMPLETED"
      ? "rgba(46, 125, 50, 0.12)"
      : s === "REJECTED" || s === "DEFAULTED"
      ? "rgba(211, 47, 47, 0.12)"
      : s === "UNDER_REVIEW"
      ? "rgba(37, 99, 235, 0.12)"
      : "rgba(242, 140, 40, 0.14)";

  const color =
    s === "APPROVED" || s === "COMPLETED"
      ? COLORS.success
      : s === "REJECTED" || s === "DEFAULTED"
      ? COLORS.danger
      : s === "UNDER_REVIEW"
      ? COLORS.info
      : COLORS.accent;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{s}</Text>
    </View>
  );
}

export default function LoanDetailScreen() {
  const params = useLocalSearchParams();
  const loanId = Number(params.id);

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLoanDetail(loanId);
      setLoan(data);
    } catch (e: any) {
      Alert.alert("Loan Details", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useFocusEffect(
    useCallback(() => {
      if (!Number.isFinite(loanId) || loanId <= 0) return;
      load();
    }, [loanId, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const contextLabel = useMemo(() => {
    if (!loan) return "—";
    if (loan.merry) return `Merry #${loan.merry}`;
    if (loan.group) return `Group #${loan.group}`;
    return "—";
  }, [loan]);

  const isActive = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    return ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(s);
  }, [loan?.status]);

  const canPay = useMemo(() => {
    const s = String(loan?.status || "").toUpperCase();
    const ob = Number(loan?.outstanding_balance ?? 0);
    return s === "APPROVED" && Number.isFinite(ob) && ob > 0;
  }, [loan?.status, loan?.outstanding_balance]);

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <EmptyState title="Invalid loan" subtitle="This loan ID is not valid." />
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
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.title}>Loan #{loanId}</Text>
          <Text style={styles.sub}>
            {contextLabel} {loan?.term_weeks ? `• ${loan.term_weeks} weeks` : ""}
          </Text>
        </View>

        {loan?.status ? <StatusPill status={loan.status} /> : null}
      </View>

      {/* Summary */}
      <Section title="Summary">
        <Card>
          {loading && !loan ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : !loan ? (
            <EmptyState title="Loan not found" subtitle="Please refresh and try again." />
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Principal</Text>
                <Text style={styles.kValue}>{formatKes(loan.principal)}</Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Total Payable</Text>
                <Text style={styles.kValue}>
                  {formatKes(loan.total_payable ?? "0.00")}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Total Paid</Text>
                <Text style={styles.kValue}>
                  {formatKes(loan.total_paid ?? "0.00")}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.kvRow}>
                <Text style={[styles.kLabel, { color: COLORS.dark }]}>
                  Outstanding
                </Text>
                <Text style={[styles.kValue, { fontFamily: FONT.bold }]}>
                  {formatKes(loan.outstanding_balance ?? "0.00")}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Created</Text>
                <Text style={styles.kValue}>
                  {loan.created_at ? new Date(loan.created_at).toLocaleString() : "—"}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Approved</Text>
                <Text style={styles.kValue}>
                  {loan.approved_at ? new Date(loan.approved_at).toLocaleString() : "—"}
                </Text>
              </View>
            </View>
          )}
        </Card>
      </Section>

      {/* Security / Collateral (from your model fields) */}
      <Section title="Security">
        <Card>
          {!loan ? (
            <Text style={styles.muted}>—</Text>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Security Target</Text>
                <Text style={styles.kValue}>
                  {formatKes(loan.security_target ?? "0.00")}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Borrower Reserved Savings</Text>
                <Text style={styles.kValue}>
                  {formatKes(loan.borrower_reserved_savings ?? "0.00")}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kLabel}>Borrower Reserved Merry Credit</Text>
                <Text style={styles.kValue}>
                  {formatKes(loan.borrower_reserved_merry_credit ?? "0.00")}
                </Text>
              </View>

              <Text style={styles.note}>
                Note: guarantor reserves and installment schedule are managed by the backend.
              </Text>
            </View>
          )}
        </Card>
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <View style={{ gap: SPACING.sm }}>
          <Button
            title="Add Guarantor"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/loans/add-guarantor",
                params: { loan: String(loanId) },
              } as any)
            }
            disabled={!isActive}
          />

          <Button
            title="Pay Loan (MPESA)"
            onPress={() =>
              router.push({
                pathname: "/loans/pay",
                params: {
                  loan: String(loanId),
                  due: String(loan?.outstanding_balance ?? "0.00"),
                },
              } as any)
            }
            disabled={!canPay}
          />

          <Button
            title="Back to Loans"
            variant="secondary"
            onPress={() => router.back()}
          />
        </View>

        {/* subtle hint */}
        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.gray} />
          <Text style={styles.hintText}>
            MPESA payment is initiated from the Payments app (STK Push) and will reflect after callback.
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

  center: { flex: 1, padding: SPACING.lg, justifyContent: "center" },

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
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  sub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  muted: { fontFamily: FONT.regular, color: COLORS.gray },

  kvRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  kLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray, flex: 1 },
  kValue: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.dark, textAlign: "right" },

  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },

  note: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  hintRow: { marginTop: SPACING.md, flexDirection: "row", gap: 8, alignItems: "flex-start" },
  hintText: { flex: 1, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontFamily: FONT.bold, fontSize: 11, letterSpacing: 0.3 },
});