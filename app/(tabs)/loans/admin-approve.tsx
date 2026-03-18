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
import { approveLoan, getApiErrorMessage, getMyLoans, Loan } from "@/services/loans";
import { getSessionUser } from "@/services/session";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
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

function productLabel(loan: Loan) {
  return (
    loan.product_detail?.name ||
    loan.product_name ||
    `Product #${loan.product}`
  );
}

function borrowerLabel(loan: Loan) {
  return loan.borrower_detail?.full_name || `User #${loan.borrower}`;
}

function statusColor(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "APPROVED":
      return COLORS.success;
    case "COMPLETED":
      return COLORS.primary;
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

export default function AdminApproveLoansScreen() {
  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getMyLoans();
      setItems(Array.isArray(data) ? data : []);
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

  const sessionUser = getSessionUser?.() as any;
  const isAdmin =
    !!sessionUser?.is_admin ||
    !!sessionUser?.is_staff ||
    !!sessionUser?.is_superuser ||
    String(sessionUser?.role || "").toLowerCase() === "admin" ||
    String(sessionUser?.role || "").toLowerCase() === "superadmin";

  const pending = useMemo(() => {
    return items.filter((l) =>
      ["PENDING", "UNDER_REVIEW"].includes(String(l.status || "").toUpperCase())
    );
  }, [items]);

  const doApprove = useCallback(
    async (loanId: number) => {
      Alert.alert("Approve Loan", `Approve Loan #${loanId}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          style: "default",
          onPress: async () => {
            try {
              setBusyId(loanId);
              setError("");
              const res = await approveLoan(loanId);
              Alert.alert("Success", res?.message || "Loan approved.");
              await load();
            } catch (e: any) {
              const msg = getApiErrorMessage(e) || getErrorMessage(e);
              setError(msg);
              Alert.alert("Approve Loan", msg);
            } finally {
              setBusyId(null);
            }
          },
        },
      ]);
    },
    [load]
  );

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: COLORS.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin only"
          subtitle="You do not have access to approve loans."
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
          <Text style={styles.hTitle}>Approve Loans</Text>
          <Text style={styles.hSub}>
            Review and approve pending global loan requests.
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

      <Section title={`Pending Requests (${pending.length})`}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : pending.length === 0 ? (
          <EmptyState
            title="No pending loans"
            subtitle="Pending and under-review loans will appear here."
          />
        ) : (
          pending.map((loan) => {
            const busy = busyId === loan.id;
            const guarantorCount = Array.isArray(loan.guarantors)
              ? loan.guarantors.length
              : 0;
            const acceptedGuarantors = Array.isArray(loan.guarantors)
              ? loan.guarantors.filter((g) => g.accepted).length
              : 0;

            return (
              <Card key={loan.id} style={styles.itemCard}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>Loan #{loan.id}</Text>
                    <Text style={styles.sub}>
                      {productLabel(loan)} • {loan.term_weeks} week(s)
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.status,
                      { color: statusColor(loan.status) },
                    ]}
                  >
                    {String(loan.status || "").toUpperCase()}
                  </Text>
                </View>

                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Principal</Text>
                    <Text style={styles.value}>{formatKes(loan.principal)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Borrower</Text>
                    <Text style={styles.value}>{borrowerLabel(loan)}</Text>
                  </View>
                </View>

                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Created</Text>
                    <Text style={styles.value}>{formatDateTime(loan.created_at)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Guarantors</Text>
                    <Text style={styles.value}>
                      {acceptedGuarantors}/{guarantorCount} accepted
                    </Text>
                  </View>
                </View>

                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Security target</Text>
                    <Text style={styles.value}>
                      {loan.security_target
                        ? formatKes(loan.security_target)
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Reserved now</Text>
                    <Text style={styles.value}>
                      {loan.security_reserved_total
                        ? formatKes(loan.security_reserved_total)
                        : "—"}
                    </Text>
                  </View>
                </View>

                {loan.member_note ? (
                  <Text style={styles.note}>Member note: {loan.member_note}</Text>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    title={busy ? "Approving..." : "Approve"}
                    onPress={() => doApprove(loan.id)}
                    loading={busy}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title="View"
                    variant="secondary"
                    onPress={() => router.push(`/(tabs)/loans/${loan.id}` as any)}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                </View>

                <Text style={styles.note}>
                  Approval runs backend checks, reserves available security,
                  creates installments, and sets the loan to APPROVED.
                </Text>
              </Card>
            );
          })
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