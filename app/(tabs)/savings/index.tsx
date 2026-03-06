// app/(tabs)/savings/index.tsx
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
  canWithdraw,
  getMe,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { listMySavingsAccounts, SavingsAccount } from "@/services/savings";
import { getSessionUser, SessionUser } from "@/services/session";

type SavingsUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TypePill({ type }: { type: string }) {
  const t = String(type || "").toUpperCase();

  const bg =
    t === "FLEXIBLE"
      ? "rgba(37, 99, 235, 0.12)"
      : t === "FIXED"
      ? "rgba(242, 140, 40, 0.14)"
      : "rgba(46, 125, 50, 0.12)";

  const color =
    t === "FLEXIBLE"
      ? COLORS.info
      : t === "FIXED"
      ? COLORS.accent
      : COLORS.success;

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{t}</Text>
    </View>
  );
}

function AccountCard({ acct }: { acct: SavingsAccount }) {
  const lockedText =
    acct.account_type === "FIXED" && acct.locked_until
      ? `Locked until ${acct.locked_until}`
      : acct.account_type === "TARGET" && acct.target_deadline
      ? `Target by ${acct.target_deadline}`
      : "Available for normal use";

  return (
    <Card style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{acct.name}</Text>
          <Text style={styles.sub}>{lockedText}</Text>
        </View>
        <TypePill type={acct.account_type} />
      </View>

      <View style={styles.grid}>
        <View style={styles.metric}>
          <Text style={styles.mLabel}>Balance</Text>
          <Text style={styles.mValue}>{formatKes(acct.balance)}</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.mLabel}>Reserved</Text>
          <Text style={styles.mValue}>{formatKes(acct.reserved_amount)}</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.mLabel}>Available</Text>
          <Text style={styles.mValue}>{formatKes(acct.available_balance)}</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.mLabel}>Status</Text>
          <Text style={styles.mValue}>{acct.is_active ? "Active" : "Inactive"}</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Text
          style={styles.link}
          onPress={() =>
            router.push(ROUTES.dynamic.savingsAccountHistory(acct.id) as any)
          }
        >
          View history
        </Text>
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </View>
    </Card>
  );
}

export default function SavingsIndexScreen() {
  const [user, setUser] = useState<SavingsUser | null>(null);
  const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc);
  }, []);

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [sessionRes, meRes, accountsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMySavingsAccounts(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: SavingsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setAccounts(
        accountsRes.status === "fulfilled" && Array.isArray(accountsRes.value)
          ? accountsRes.value
          : []
      );

      if (accountsRes.status === "rejected") {
        setError(getErrorMessage(accountsRes.reason));
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
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
    const sum = (k: keyof SavingsAccount) =>
      accounts.reduce((acc, a) => acc + (Number(a[k] ?? 0) || 0), 0);

    return {
      balance: sum("balance"),
      reserved: sum("reserved_amount"),
      available: sum("available_balance"),
    };
  }, [accounts]);

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
          subtitle="Please login to access savings."
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.hTitle}>Savings</Text>
          <Text style={styles.hSub}>Personal wallets, fixed and target accounts</Text>
        </View>

        <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
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

      {!kycComplete && (
        <Section title="KYC Notice">
          <Card style={styles.noticeCard} onPress={goToKyc}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              You can create savings accounts and deposit funds, but withdrawal
              requests require completed KYC.
            </Text>
          </Card>
        </Section>
      )}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Total Balance</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.balance)}</Text>
        </View>

        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Available</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.available)}</Text>
        </View>
      </View>

      <View style={styles.actionBar}>
        <Button
          title="Add Account"
          onPress={() => router.push(ROUTES.tabs.savingsCreate as any)}
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

      <Section
        title="My Accounts"
        right={
          <Text
            style={styles.smallLink}
            onPress={() => router.push(ROUTES.tabs.savingsCreate as any)}
          >
            New
          </Text>
        }
      >
        {accounts.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No savings accounts"
            subtitle="Create a savings account to start tracking your deposits."
            actionLabel="Add Account"
            onAction={() => router.push(ROUTES.tabs.savingsCreate as any)}
          />
        ) : (
          accounts.map((a) => <AccountCard key={a.id} acct={a} />)
        )}
      </Section>

      <Section
        title="Withdraw"
        right={
          <Text
            style={styles.smallLink}
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : goToKyc()
            }
          >
            {withdrawAllowed ? "Request" : "Complete KYC"}
          </Text>
        }
      >
        <Card>
          <Text style={styles.note}>
            Withdrawals are requested from personal savings and require admin
            approval before Mpesa payout.
          </Text>
          <View style={{ height: SPACING.sm }} />
          <Button
            title={withdrawAllowed ? "Request Withdrawal" : "Complete KYC"}
            variant="secondary"
            onPress={() =>
              withdrawAllowed
                ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                : goToKyc()
            }
          />
        </Card>
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
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    marginTop: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger,
  },

  noticeCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  summaryGrid: {
    marginTop: SPACING.md,
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

  actionBar: {
    flexDirection: "row",
    marginTop: SPACING.md,
    alignItems: "center",
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  smallLink: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  card: {
    marginBottom: SPACING.md,
  },

  topRow: {
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
  },

  grid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  metric: {
    width: "48%",
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  mLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  mValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  link: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  note: {
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