import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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
import { approveLoan, getMyLoans, Loan } from "@/services/loans";
import { getSessionUser } from "@/services/session";

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

function ctxLabel(l: Loan) {
  if (l.merry) return `Merry #${l.merry}`;
  if (l.group) return `Group #${l.group}`;
  return "—";
}

export default function AdminApproveLoansScreen() {
  const me = getSessionUser?.() as any;

  // ✅ Admin gate (frontend UX only)
  const isAdmin = !!me?.is_admin || String(me?.role || "").toLowerCase() === "admin";

  const [items, setItems] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyLoans(); // if backend later adds admin list endpoint, swap here
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Admin Loans", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // What we can approve: PENDING / UNDER_REVIEW
  const pending = useMemo(() => {
    return items.filter((l) =>
      ["PENDING", "UNDER_REVIEW"].includes(String(l.status || "").toUpperCase())
    );
  }, [items]);

  const doApprove = async (loanId: number) => {
    try {
      Alert.alert(
        "Approve Loan",
        `Approve Loan #${loanId}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            style: "default",
            onPress: async () => {
              try {
                setBusyId(loanId);
                const res = await approveLoan(loanId);
                Alert.alert("Success", res?.message || "Loan approved.");
                await load();
              } catch (e: any) {
                Alert.alert("Approve Loan", getErrorMessage(e));
              } finally {
                setBusyId(null);
              }
            },
          },
        ]
      );
    } catch {}
  };

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.hTitle}>Approve Loans</Text>
          <Text style={styles.hSub}>
            Approve pending loan requests (admin workflow).
          </Text>
        </View>
        <Ionicons name="checkmark-done-outline" size={22} color={COLORS.primary} />
      </View>

      <Section title={`Pending Requests (${pending.length})`}>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : pending.length === 0 ? (
          <EmptyState
            title="No pending loans"
            subtitle="Pending and under-review loans will appear here."
          />
        ) : (
          pending.map((l) => {
            const busy = busyId === l.id;
            return (
              <Card key={l.id} style={{ marginBottom: SPACING.md }}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>Loan #{l.id}</Text>
                    <Text style={styles.sub}>
                      {ctxLabel(l)} • Product #{l.product} • {l.term_weeks} weeks
                    </Text>
                  </View>

                  <Text style={styles.status}>
                    {String(l.status || "").toUpperCase()}
                  </Text>
                </View>

                <View style={styles.grid}>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Principal</Text>
                    <Text style={styles.value}>{formatKes(l.principal)}</Text>
                  </View>
                  <View style={styles.cell}>
                    <Text style={styles.label}>Borrower</Text>
                    <Text style={styles.value}>User #{l.borrower}</Text>
                  </View>
                </View>

                <View style={styles.actions}>
                  <Button
                    title={busy ? "Approving..." : "Approve"}
                    onPress={() => doApprove(l.id)}
                    loading={busy}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title="View"
                    variant="secondary"
                    onPress={() => router.push(`/loans/${l.id}` as any)}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                </View>

                <Text style={styles.note}>
                  Approval triggers security coverage logic (borrower reserves + guarantors),
                  creates installment schedule, and sets loan status to APPROVED.
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
  },
  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  muted: { marginTop: 6, fontFamily: FONT.regular, color: COLORS.gray },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },
  sub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  status: { fontFamily: FONT.bold, fontSize: 11, color: COLORS.primary },

  grid: { marginTop: SPACING.md, flexDirection: "row", justifyContent: "space-between" },
  cell: { width: "48%" },
  label: { fontFamily: FONT.regular, fontSize: 11, color: COLORS.gray },
  value: { marginTop: 6, fontFamily: FONT.bold, fontSize: 13, color: COLORS.dark },

  actions: { marginTop: SPACING.md, flexDirection: "row", alignItems: "center" },

  note: { marginTop: 10, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
});