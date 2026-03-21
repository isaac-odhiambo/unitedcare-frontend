// app/(tabs)/merry/contributions.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMyMerryPayments,
  getMyMerryWallet,
  MerryPaymentRow,
  MerryWalletResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryPaymentsUser = Partial<MeResponse> & Partial<SessionUser>;

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
  return d.toLocaleString("en-KE");
}

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (["CONFIRMED"].includes(s)) return COLORS.success;
  if (["PENDING"].includes(s)) return COLORS.warning;
  if (["FAILED", "CANCELLED"].includes(s)) return COLORS.danger;
  return COLORS.gray;
}

function StatusPill({ label }: { label: string }) {
  const color = statusColor(label);

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{String(label || "—").toUpperCase()}</Text>
    </View>
  );
}

function PaymentCard({ payment }: { payment: MerryPaymentRow }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.itemTitle}>
            {payment.merry_name || `Merry #${payment.merry_id}`}
          </Text>
          <Text style={styles.itemMeta}>
            {formatDateTime(payment.created_at)}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={styles.amount}>{formatKes(payment.amount)}</Text>
          <StatusPill label={payment.status} />
        </View>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Period</Text>
        <Text style={styles.kvValue}>{payment.period_key || "—"}</Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Phone</Text>
        <Text style={styles.kvValue}>{payment.payer_phone || "—"}</Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Receipt</Text>
        <Text style={styles.kvValue}>{payment.mpesa_receipt_number || "—"}</Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Paid At</Text>
        <Text style={styles.kvValue}>{formatDateTime(payment.paid_at)}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Open Merry"
          variant="secondary"
          onPress={() => router.push(ROUTES.dynamic.merryDetail(payment.merry_id) as any)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

export default function MerryContributionsScreen() {
  const [user, setUser] = useState<MerryPaymentsUser | null>(null);
  const [payments, setPayments] = useState<MerryPaymentRow[]>([]);
  const [wallet, setWallet] = useState<MerryWalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, paymentsRes, walletRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyMerryPayments(),
        getMyMerryWallet(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser =
        meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (paymentsRes.status === "fulfilled") {
        setPayments(Array.isArray(paymentsRes.value) ? paymentsRes.value : []);
      } else {
        setPayments([]);
        setError(
          getApiErrorMessage(paymentsRes.reason) ||
            getErrorMessage(paymentsRes.reason)
        );
      }

      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value ?? null);
      } else {
        setWallet(null);
      }
    } catch (e: any) {
      setPayments([]);
      setWallet(null);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
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
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const totals = useMemo(() => {
    const totalAmount = payments.reduce(
      (sum, p) => sum + (Number(p.amount || 0) || 0),
      0
    );
    const confirmed = payments.filter(
      (p) => String(p.status || "").toUpperCase() === "CONFIRMED"
    ).length;
    const pending = payments.filter(
      (p) => String(p.status || "").toUpperCase() === "PENDING"
    ).length;
    const failed = payments.filter((p) =>
      ["FAILED", "CANCELLED"].includes(String(p.status || "").toUpperCase())
    ).length;

    return {
      totalCount: payments.length,
      totalAmount,
      confirmed,
      pending,
      failed,
    };
  }, [payments]);

  const walletBalance = useMemo(() => {
    return Number(wallet?.wallet_balance || 0) || 0;
  }, [wallet]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access merry payments."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
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
          <Text style={styles.hTitle}>My Merry Payments</Text>
          <Text style={styles.hSub}>
            Personal merry payment history and wallet balance
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />}
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.walletCard}>
        <View style={styles.walletTop}>
          <View style={styles.walletIconWrap}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.walletTitle}>Merry Wallet</Text>
            <Text style={styles.walletSub}>
              Extra merry payments stay here and can reduce future dues automatically.
            </Text>
          </View>
        </View>

        <Text style={styles.walletAmount}>{formatKes(walletBalance)}</Text>
        <Text style={styles.walletMeta}>
          Last updated: {formatDateTime(wallet?.updated_at)}
        </Text>
      </Card>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Payments</Text>
          <Text style={styles.summaryValue}>{totals.totalCount}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Amount</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.totalAmount)}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Confirmed</Text>
          <Text style={styles.summaryValue}>{totals.confirmed}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{totals.pending}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Failed / Cancelled</Text>
          <Text style={styles.summaryValue}>{totals.failed}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Wallet Balance</Text>
          <Text style={styles.summaryValue}>{formatKes(walletBalance)}</Text>
        </View>
      </View>

      <Section title="Payment History">
        {payments.length === 0 ? (
          <EmptyState
            icon="cash-outline"
            title="No merry payments yet"
            subtitle="Your contribution history will appear here after payment."
            actionLabel="Go to Merry"
            onAction={() => router.push(ROUTES.tabs.merry)}
          />
        ) : (
          payments.map((payment) => (
            <PaymentCard key={payment.id} payment={payment} />
          ))
        )}
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

  walletCard: {
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    ...SHADOW.card,
  },

  walletTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  walletIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  walletTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: COLORS.dark,
  },

  walletSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  walletAmount: {
    marginTop: SPACING.md,
    fontFamily: FONT.bold,
    fontSize: 22,
    color: COLORS.dark,
  },

  walletMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  itemTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  itemMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  pillText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },
});