// app/(tabs)/savings/[id].tsx
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

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  buildSavingsReference,
  canShowWithdrawAction,
  getApiErrorMessage,
  getMySavingsAccount,
  getSavingsAccountHistory,
  getSavingsLockMessage,
  getSavingsTypeLabel,
  isSavingsLocked,
  type SavingsAccount,
  type SavingsHistoryRow,
} from "@/services/savings";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getTxnTitle(row: SavingsHistoryRow) {
  const txnType = String(row.txn_type || "").toUpperCase();

  if (row.narration) return row.narration;
  if (txnType === "DEPOSIT") return "Deposit";
  if (txnType === "WITHDRAWAL") return "Withdrawal";
  if (txnType === "ADJUSTMENT") return "Adjustment";
  if (txnType === "AUTO_DEDUCT") return "Auto deduction";

  return "Transaction";
}

function getTxnTone(row: SavingsHistoryRow) {
  const txnType = String(row.txn_type || "").toUpperCase();

  if (txnType === "DEPOSIT") {
    return {
      color: COLORS.success,
      sign: "+",
      icon: "arrow-down-circle-outline" as const,
      bg: "rgba(46, 125, 50, 0.10)",
    };
  }

  if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
    return {
      color: COLORS.danger,
      sign: "-",
      icon: "arrow-up-circle-outline" as const,
      bg: "rgba(211, 47, 47, 0.10)",
    };
  }

  return {
    color: COLORS.info,
    sign: "",
    icon: "swap-horizontal-outline" as const,
    bg: "rgba(37, 99, 235, 0.10)",
  };
}

function TypePill({ account }: { account: SavingsAccount }) {
  const type = String(account.account_type || "").toUpperCase();
  const locked = isSavingsLocked(account);

  let bg = "rgba(37, 99, 235, 0.10)";
  let color = COLORS.info;
  let label = getSavingsTypeLabel(type);

  if (type === "FIXED") {
    bg = locked ? "rgba(242, 140, 40, 0.14)" : "rgba(242, 140, 40, 0.10)";
    color = COLORS.warning;
  }

  if (type === "TARGET") {
    bg = "rgba(46, 125, 50, 0.10)";
    color = COLORS.success;
  }

  return (
    <View style={[styles.typePill, { backgroundColor: bg }]}>
      <Text style={[styles.typePillText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function StatusBanner({ account }: { account: SavingsAccount }) {
  if (!account.is_active) {
    return (
      <View style={[styles.banner, styles.bannerDanger]}>
        <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
        <Text style={[styles.bannerText, { color: COLORS.danger }]}>
          This savings wallet is inactive.
        </Text>
      </View>
    );
  }

  const lockMessage = getSavingsLockMessage(account);
  if (lockMessage) {
    return (
      <View style={[styles.banner, styles.bannerWarning]}>
        <Ionicons name="lock-closed-outline" size={16} color={COLORS.warning} />
        <Text style={[styles.bannerText, { color: COLORS.warning }]}>
          {lockMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.bannerSuccess]}>
      <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
      <Text style={[styles.bannerText, { color: COLORS.success }]}>
        Savings wallet is active.
      </Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const color =
    tone === "success"
      ? COLORS.success
      : tone === "danger"
      ? COLORS.danger
      : COLORS.dark;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function AccountCard({ account }: { account: SavingsAccount }) {
  return (
    <Card style={styles.accountCard}>
      <View style={styles.accountHead}>
        <View style={styles.accountHeadText}>
          <Text style={styles.accountName} numberOfLines={1}>
            {account.name || "My Savings"}
          </Text>
          <Text style={styles.accountMeta}>Personal savings wallet</Text>
        </View>

        <TypePill account={account} />
      </View>

      <StatusBanner account={account} />

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Balance</Text>
          <Text style={styles.metricValue}>{formatKes(account.balance)}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Available</Text>
          <Text style={styles.metricValue}>{formatKes(account.available_balance)}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Reserved</Text>
          <Text style={styles.metricValue}>{formatKes(account.reserved_amount)}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Status</Text>
          <Text style={styles.metricValue}>
            {account.is_active ? "Active" : "Inactive"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function TransactionRow({ row }: { row: SavingsHistoryRow }) {
  const tone = getTxnTone(row);
  const title = getTxnTitle(row);
  const meta = row.reference || row.note || "";
  const date = formatDate(row.created_at);

  return (
    <Card style={styles.txCard}>
      <View style={styles.txRow}>
        <View style={[styles.txIconWrap, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={18} color={tone.color} />
        </View>

        <View style={styles.txBody}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {title}
          </Text>

          <Text style={styles.txMeta} numberOfLines={2}>
            {meta ? `${meta} • ` : ""}
            {date}
          </Text>
        </View>

        <Text style={[styles.txAmount, { color: tone.color }]}>
          {tone.sign}
          {formatKes(row.amount)}
        </Text>
      </View>
    </Card>
  );
}

export default function SavingsAccountDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const accountId = Number(params.id ?? 0);

  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      let resolvedAccountId = accountId;

      if (!resolvedAccountId || !Number.isFinite(resolvedAccountId)) {
        const myAccount = await getMySavingsAccount();
        if (!myAccount?.id) {
          setAccount(null);
          setTransactions([]);
          setError("No savings wallet found.");
          return;
        }
        resolvedAccountId = myAccount.id;
      }

      const res = await getSavingsAccountHistory(resolvedAccountId);
      setAccount(res?.account || null);
      setTransactions(Array.isArray(res?.transactions) ? res.transactions : []);
    } catch (e: any) {
      setAccount(null);
      setTransactions([]);
      setError(getApiErrorMessage(e));
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          setLoading(true);
          if (active) await load();
        } finally {
          if (active) setLoading(false);
        }
      };

      run();

      return () => {
        active = false;
      };
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

  const totals = useMemo(() => {
    let credits = 0;
    let debits = 0;

    for (const row of transactions) {
      const amount = Number(row.amount ?? 0);
      const txnType = String(row.txn_type || "").toUpperCase();

      if (!Number.isFinite(amount) || amount <= 0) continue;

      if (txnType === "DEPOSIT") {
        credits += amount;
      } else if (txnType === "WITHDRAWAL" || txnType === "AUTO_DEDUCT") {
        debits += amount;
      }
    }

    return { credits, debits };
  }, [transactions]);

  const canWithdraw = canShowWithdrawAction(account);
  const savingsReference = account?.id ? buildSavingsReference(account.id) : "";

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading savings details...</Text>
      </View>
    );
  }

  if (!account && error) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to load savings"
          subtitle={error}
          actionLabel="Back to Savings"
          onAction={() => router.replace(ROUTES.tabs.savings)}
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
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Savings Details</Text>
          <Text style={styles.subtitle}>
            Review your wallet balance and activity.
          </Text>
        </View>

        <Button
          title="Back"
          variant="ghost"
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

      {account ? (
        <>
          <Section title="Wallet">
            <AccountCard account={account} />
          </Section>

          <View style={styles.summaryGrid}>
            <SummaryCard
              label="Deposits"
              value={formatKes(totals.credits)}
              tone="success"
            />
            <SummaryCard
              label="Withdrawals"
              value={formatKes(totals.debits)}
              tone="danger"
            />
          </View>

          <Section
            title="Transactions"
            right={
              <View style={styles.sectionActions}>
                <Button
                  title="Deposit"
                  variant="ghost"
                  onPress={() =>
                    router.push({
                      pathname: ROUTES.tabs.paymentsDeposit as any,
                      params: {
                        category: "SAVINGS",
                        purpose: "SAVINGS_DEPOSIT",
                        accountId: String(account.id),
                        reference: savingsReference,
                        title: account.name || "Savings",
                      },
                    })
                  }
                />
                {canWithdraw ? (
                  <Button
                    title="Withdraw"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: ROUTES.tabs.paymentsWithdrawals as any,
                        params: {
                          category: "SAVINGS",
                          purpose: "SAVINGS_WITHDRAWAL",
                          accountId: String(account.id),
                          reference: savingsReference,
                          title: account.name || "Savings",
                        },
                      })
                    }
                  />
                ) : null}
              </View>
            }
          >
            {transactions.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No transactions yet"
                subtitle="Deposits and withdrawals on your savings wallet will appear here."
                actionLabel="Deposit"
                onAction={() =>
                  router.push({
                    pathname: ROUTES.tabs.paymentsDeposit as any,
                    params: {
                      category: "SAVINGS",
                      purpose: "SAVINGS_DEPOSIT",
                      accountId: String(account.id),
                      reference: savingsReference,
                      title: account.name || "Savings",
                    },
                  })
                }
              />
            ) : (
              transactions.map((row) => (
                <TransactionRow key={row.id} row={row} />
              ))
            )}
          </Section>
        </>
      ) : (
        <EmptyState
          title="No savings wallet"
          subtitle="Your savings activity will appear here once the wallet is available."
          actionLabel="Back to Savings"
          onAction={() => router.replace(ROUTES.tabs.savings)}
        />
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },

  loadingText: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  headerTextWrap: {
    flex: 1,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 20,
    color: COLORS.dark,
  },

  subtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(211, 47, 47, 0.14)",
    backgroundColor: "rgba(211, 47, 47, 0.05)",
  },

  errorText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
  },

  accountCard: {
    padding: SPACING.md,
  },

  accountHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  accountHeadText: {
    flex: 1,
  },

  accountName: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  accountMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  typePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },

  typePillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  banner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
  },

  bannerSuccess: {
    backgroundColor: "rgba(46, 125, 50, 0.06)",
    borderColor: "rgba(46, 125, 50, 0.16)",
  },

  bannerWarning: {
    backgroundColor: "rgba(242, 140, 40, 0.08)",
    borderColor: "rgba(242, 140, 40, 0.18)",
  },

  bannerDanger: {
    backgroundColor: "rgba(211, 47, 47, 0.06)",
    borderColor: "rgba(211, 47, 47, 0.16)",
  },

  bannerText: {
    flex: 1,
    fontFamily: FONT.medium || FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  metricsGrid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  metricCard: {
    width: "48%",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metricLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  metricValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
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
  },

  sectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },

  txCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  txBody: {
    flex: 1,
    minWidth: 0,
  },

  txTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  txMeta: {
    marginTop: 5,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.gray,
  },

  txAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
    marginLeft: SPACING.xs,
  },
});