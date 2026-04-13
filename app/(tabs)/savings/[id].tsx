import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

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
  if (txnType === "DEPOSIT") return "Contribution added";
  if (txnType === "WITHDRAWAL") return "Withdrawal";
  if (txnType === "ADJUSTMENT") return "Update";
  if (txnType === "AUTO_DEDUCT") return "Automatic deduction";

  return "Activity";
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
    bg: "rgba(12, 106, 128, 0.10)",
  };
}

function TypePill({ account }: { account: SavingsAccount }) {
  const type = String(account.account_type || "").toUpperCase();
  const locked = isSavingsLocked(account);

  let bg = "rgba(12, 106, 128, 0.10)";
  let color = "#0C6A80";
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
          This savings space is currently inactive.
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
      <Ionicons
        name="checkmark-circle-outline"
        size={16}
        color={COLORS.success}
      />
      <Text style={[styles.bannerText, { color: COLORS.success }]}>
        Your savings space is active and ready.
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
        : "#0F172A";

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
          <Text style={styles.accountMeta}>
            Your personal community savings space
          </Text>
        </View>

        <TypePill account={account} />
      </View>

      <StatusBanner account={account} />

      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total saved</Text>
          <Text style={styles.metricValue}>{formatKes(account.balance)}</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Ready to use</Text>
          <Text style={styles.metricValue}>
            {formatKes(account.available_balance)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Set aside</Text>
          <Text style={styles.metricValue}>
            {formatKes(account.reserved_amount)}
          </Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>Space status</Text>
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
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{ id?: string }>();
  const accountId = Number(params.id ?? 0);

  const [account, setAccount] = useState<SavingsAccount | null>(null);
  const [transactions, setTransactions] = useState<SavingsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");

      let resolvedAccountId = accountId;

      if (!resolvedAccountId || !Number.isFinite(resolvedAccountId)) {
        const myAccount = await getMySavingsAccount();
        if (!myAccount?.id) {
          setAccount(null);
          setTransactions([]);
          setError("No savings space found.");
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
          if (active) {
            setLoading(false);
            setHasBootstrapped(true);
          }
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

  if (!hasBootstrapped) {
    return <SafeAreaView style={styles.page} edges={["top", "left", "right"]} />;
  }

  if (!account && error) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Unable to open savings space"
            subtitle={error}
            actionLabel="Back to Savings"
            onAction={() => router.replace(ROUTES.tabs.savings)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#C7FFF2"
            colors={["#C7FFF2", "#8CF0C7"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Your Savings Space</Text>
              <Text style={styles.subtitle}>
                See how you are growing your savings and supporting your
                community.
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
                  color="#FFFFFF"
                />
              }
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {account ? (
          <>
            <Section title="Your savings space">
              <AccountCard account={account} />
            </Section>

            <View style={styles.summaryGrid}>
              <SummaryCard
                label="Added by you"
                value={formatKes(totals.credits)}
                tone="success"
              />
              <SummaryCard
                label="Taken out"
                value={formatKes(totals.debits)}
                tone="danger"
              />
            </View>

            <Section
              title="Recent activity"
              right={
                <View style={styles.sectionActions}>
                  <Button
                    title="Add"
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
                  title="No activity yet"
                  subtitle="When you add to savings or make a withdrawal, it will appear here."
                  actionLabel="Add to Savings"
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
            title="No savings space"
            subtitle="Your community saving activity will appear here once your space is ready."
            actionLabel="Back to Savings"
            onAction={() => router.replace(ROUTES.tabs.savings)}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
  },

  loadingWrap: {
    flex: 1,
    backgroundColor: "#0C6A80",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },

  loadingText: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.88)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  heroGlowOne: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -40,
    right: -30,
  },

  heroGlowTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(140, 240, 199, 0.10)",
    bottom: -20,
    left: -10,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  headerTextWrap: {
    flex: 1,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 22,
    color: "#FFFFFF",
  },

  subtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.86)",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(211, 47, 47, 0.18)",
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
  },

  accountCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
    ...SHADOW.card,
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
    color: "#0F172A",
  },

  accountMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#64748B",
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
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
  },

  metricLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "#64748B",
  },

  metricValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: "#0F172A",
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
    padding: SPACING.md,
    ...SHADOW.card,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "#64748B",
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
    borderRadius: RADIUS.lg,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.08)",
    ...SHADOW.card,
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
    color: "#0F172A",
  },

  txMeta: {
    marginTop: 5,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
  },

  txAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
    marginLeft: SPACING.xs,
  },
});
