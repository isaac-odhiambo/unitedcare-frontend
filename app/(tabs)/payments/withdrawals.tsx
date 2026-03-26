// app/(tabs)/payments/withdrawals.tsx
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
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

  if (["PAID", "APPROVED", "SUCCESS"].includes(s)) return COLORS.success;
  if (["FAILED", "REJECTED", "CANCELLED"].includes(s)) return COLORS.danger;
  if (["PENDING", "PROCESSING"].includes(s)) return COLORS.warning;

  return COLORS.gray;
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);

  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

function WithdrawalCard({ item }: { item: WithdrawalRequest }) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.source}</Text>
          <Text style={styles.meta}>{item.phone}</Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
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

      setUser({ ...(sessionUser ?? {}), ...(meUser ?? {}) });

      setWithdrawals(
        withdrawalsRes.status === "fulfilled"
          ? withdrawalsRes.value || []
          : []
      );

      if (withdrawalsRes.status === "rejected") {
        setError(getApiErrorMessage(withdrawalsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Not signed in"
        actionLabel="Login"
        onAction={() => router.replace(ROUTES.auth.login)}
      />
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Withdrawals</Text>

        <Button
          title="Back"
          variant="ghost"
          onPress={() => router.back()}
        />
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {!kycComplete && (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>
            Complete KYC to request withdrawal
          </Text>
          <Button
            title="Open KYC"
            onPress={() => router.push(ROUTES.tabs.profileKyc)}
          />
        </Card>
      )}

      <Section title="Actions">
        <View style={styles.actions}>
          <Button
            title={withdrawAllowed ? "Withdraw" : "Complete KYC"}
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : router.push(ROUTES.tabs.profileKyc)
            }
            style={{ flex: 1 }}
          />
          <Button
            title="Deposit"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="Requests">
        {withdrawals.length === 0 ? (
          <EmptyState
            title="No withdrawals yet"
            actionLabel="Withdraw"
            onAction={() =>
              router.push(ROUTES.tabs.paymentsRequestWithdrawal)
            }
          />
        ) : (
          withdrawals.map((item) => (
            <WithdrawalCard key={item.id} item={item} />
          ))
        )}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  headerTitle: {
    fontSize: 18,
    fontFamily: FONT.bold,
  },

  error: {
    color: COLORS.danger,
    marginBottom: SPACING.sm,
  },

  notice: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  noticeText: {
    marginBottom: SPACING.sm,
  },

  actions: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  card: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  meta: {
    fontSize: 12,
    color: COLORS.gray,
  },

  amount: {
    fontFamily: FONT.bold,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    marginRight: 6,
  },

  statusText: {
    fontSize: 11,
  },
});