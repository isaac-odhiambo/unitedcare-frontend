// app/(tabs)/payments/withdrawals.tsx
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
import {
  getApiErrorMessage,
  getMyWithdrawals,
  WithdrawalRequest,
} from "@/services/payments";
import {
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type WithdrawalsUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();

  if (["PAID", "APPROVED", "COMPLETED", "SUCCESS"].includes(s)) {
    return COLORS.success;
  }
  if (["FAILED", "REJECTED", "CANCELLED", "BLOCKED"].includes(s)) {
    return COLORS.danger;
  }
  if (["PENDING", "PROCESSING", "UNDER_REVIEW"].includes(s)) {
    return COLORS.warning;
  }
  return COLORS.gray;
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);

  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{String(status || "—").toUpperCase()}</Text>
    </View>
  );
}

function WithdrawalCard({ item }: { item: WithdrawalRequest }) {
  return (
    <Card style={styles.withdrawalCard}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.cardTitle}>Withdrawal • {item.source}</Text>
          <Text style={styles.cardMeta}>
            {item.phone}
            {item.created_at ? ` • ${item.created_at}` : ""}
          </Text>
        </View>

        <View style={{ alignItems: "flex-end", gap: 8 }}>
          <Text style={styles.amount}>{formatKes(item.amount)}</Text>
          <StatusPill status={String(item.status)} />
        </View>
      </View>
    </Card>
  );
}

export default function WithdrawalsScreen() {
  const [user, setUser] = useState<WithdrawalsUser | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, withdrawalsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyWithdrawals(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: WithdrawalsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setWithdrawals(
        withdrawalsRes.status === "fulfilled" && Array.isArray(withdrawalsRes.value)
          ? withdrawalsRes.value
          : []
      );

      if (withdrawalsRes.status === "rejected") {
        setError(getApiErrorMessage(withdrawalsRes.reason));
      } else if (meRes.status === "rejected") {
        setError(getApiErrorMessage(meRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
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

  const stats = useMemo(() => {
    const pending = withdrawals.filter(
      (w) => String(w.status).toUpperCase() === "PENDING"
    ).length;

    const processing = withdrawals.filter((w) =>
      ["APPROVED", "PROCESSING"].includes(String(w.status).toUpperCase())
    ).length;

    const paid = withdrawals.filter((w) =>
      ["PAID", "COMPLETED", "SUCCESS"].includes(String(w.status).toUpperCase())
    ).length;

    const totalAmount = withdrawals.reduce((sum, w) => {
      const n = Number(w.amount ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    return {
      pending,
      processing,
      paid,
      totalAmount,
    };
  }, [withdrawals]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to access withdrawals."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Withdrawals</Text>
          <Text style={styles.hSub}>
            Track payout requests and statuses • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={
            <Ionicons
              name="arrow-back-outline"
              size={16}
              color={COLORS.primary}
            />
          }
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Section title="KYC Notice">
          <Card style={styles.noticeCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              Withdrawal requests require completed KYC. You can still review any
              previous requests here.
            </Text>
            <View style={{ height: SPACING.sm }} />
            <Button
              title="Complete KYC"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.profileKyc)}
            />
          </Card>
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{stats.pending}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Processing</Text>
          <Text style={styles.summaryValue}>{stats.processing}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Paid</Text>
          <Text style={styles.summaryValue}>{stats.paid}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Requested</Text>
          <Text style={styles.summaryValue}>{formatKes(stats.totalAmount)}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsRow}>
          <Button
            title={withdrawAllowed ? "Request Withdrawal" : "Complete KYC"}
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : router.push(ROUTES.tabs.profileKyc)
            }
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Deposit"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="My Withdrawal Requests">
        {withdrawals.length === 0 ? (
          <EmptyState
            icon="cash-outline"
            title="No withdrawals yet"
            subtitle={
              withdrawAllowed
                ? "When you request a payout, it will appear here."
                : "Complete KYC before submitting a withdrawal request."
            }
            actionLabel={withdrawAllowed ? "Request Withdrawal" : "Complete KYC"}
            onAction={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : router.push(ROUTES.tabs.profileKyc)
            }
          />
        ) : (
          withdrawals.map((item) => (
            <WithdrawalCard key={item.id} item={item} />
          ))
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
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
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    fontFamily: FONT.regular,
  },

  noticeCard: {
    padding: SPACING.md,
  },

  noticeText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
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

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  withdrawalCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  cardMeta: {
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

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  statusText: {
    fontSize: 11,
    color: COLORS.text,
    fontFamily: FONT.medium,
  },
});