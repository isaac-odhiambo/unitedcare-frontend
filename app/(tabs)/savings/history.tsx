// app/(tabs)/savings/history.tsx
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
import { getErrorMessage } from "@/services/api";
import {
    getSavingsAccountHistory,
    SavingsAccount,
    SavingsHistoryRow,
} from "@/services/savings";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function entryColor(row: SavingsHistoryRow) {
  const entryType = String(row.entry_type || "").toUpperCase();
  const txnType = String(row.txn_type || "").toUpperCase();

  if (entryType === "CREDIT" || txnType === "DEPOSIT") return COLORS.success;
  if (entryType === "DEBIT" || txnType === "WITHDRAWAL") return COLORS.danger;
  return COLORS.info;
}

function entrySign(row: SavingsHistoryRow) {
  const entryType = String(row.entry_type || "").toUpperCase();
  const txnType = String(row.txn_type || "").toUpperCase();

  if (entryType === "CREDIT" || txnType === "DEPOSIT") return "+";
  if (entryType === "DEBIT" || txnType === "WITHDRAWAL") return "-";
  return "";
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

function AccountSummaryCard({ account }: { account: SavingsAccount }) {
  const helperText =
    account.account_type === "FIXED" && account.locked_until
      ? `Locked until ${account.locked_until}`
      : account.account_type === "TARGET" && account.target_deadline
      ? `Target by ${account.target_deadline}`
      : "Standard savings account";

  return (
    <Card style={styles.accountCard}>
      <View style={styles.accountTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.accountTitle}>{account.name}</Text>
          <Text style={styles.accountSub}>{helperText}</Text>
        </View>
        <TypePill type={account.account_type} />
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Balance</Text>
          <Text style={styles.metricValue}>{formatKes(account.balance)}</Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Reserved</Text>
          <Text style={styles.metricValue}>
            {formatKes(account.reserved_amount)}
          </Text>
        </View>

        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Available</Text>
          <Text style={styles.metricValue}>
            {formatKes(account.available_balance)}
          </Text>
        </View>

        <View style={styles.metric}>
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
  const color = entryColor(row);
  const sign = entrySign(row);
  const title =
    row.narration || row.txn_type || row.entry_type || "Transaction";
  const reference = row.reference || row.note || "";
  const date = row.created_at || "—";

  return (
    <Card style={styles.txCard}>
      <View style={styles.txTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.txTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.txMeta} numberOfLines={2}>
            {reference ? `${reference} • ` : ""}
            {date}
          </Text>
        </View>

        <Text style={[styles.txAmount, { color }]}>
          {sign} {formatKes(row.amount)}
        </Text>
      </View>
    </Card>
  );
}

export default function SavingsHistoryScreen() {
  const params = useLocalSearchParams<{ accountId?: string }>();
  const accountId = Number(params.accountId ?? 0);

  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!accountId || !Number.isFinite(accountId)) {
      setError("Missing or invalid savings account.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getSavingsAccountHistory(accountId);
      setAccount(data.account);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (e: any) {
      setError(getErrorMessage(e));
      setAccount(null);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

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
    let credits = 0;
    let debits = 0;

    transactions.forEach((row) => {
      const amount = Number(row.amount ?? 0);
      if (!Number.isFinite(amount)) return;

      const entryType = String(row.entry_type || "").toUpperCase();
      const txnType = String(row.txn_type || "").toUpperCase();

      if (entryType === "CREDIT" || txnType === "DEPOSIT") credits += amount;
      else if (entryType === "DEBIT" || txnType === "WITHDRAWAL") debits += amount;
    });

    return { credits, debits };
  }, [transactions]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error && !account) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to load account"
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
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Savings History</Text>
          <Text style={styles.hSub}>
            Review account balances and transaction activity
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

      {account ? (
        <Section title="Account Summary">
          <AccountSummaryCard account={account} />
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Credits</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>
            {formatKes(totals.credits)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Debits</Text>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
            {formatKes(totals.debits)}
          </Text>
        </View>
      </View>

      <Section
        title="Transactions"
        right={
          <Button
            variant="ghost"
            title="Deposit"
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        }
      >
        {transactions.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No transactions yet"
            subtitle="Deposits and withdrawals on this savings account will appear here."
            actionLabel="Deposit"
            onAction={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        ) : (
          transactions.map((row) => <TransactionRow key={row.id} row={row} />)
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

  accountCard: {
    padding: SPACING.md,
  },

  accountTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  accountTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  accountSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  metricsGrid: {
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

  txCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  txTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  txTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  txMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  txAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
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