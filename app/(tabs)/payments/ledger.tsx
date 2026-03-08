// app/(tabs)/payments/ledger.tsx
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
  getMyLedger,
  PaymentLedgerEntry,
} from "@/services/payments";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type LedgerUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function entryColor(entry: PaymentLedgerEntry) {
  const type = String(entry.entry_type || "").toUpperCase();
  if (type === "CREDIT") return COLORS.success;
  if (type === "DEBIT") return COLORS.danger;
  return COLORS.info;
}

function entrySign(entry: PaymentLedgerEntry) {
  const type = String(entry.entry_type || "").toUpperCase();
  if (type === "CREDIT") return "+";
  if (type === "DEBIT") return "-";
  return "";
}

function categoryIcon(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "wallet-outline";
  if (c === "LOANS") return "cash-outline";
  if (c === "MERRY") return "repeat-outline";
  if (c === "GROUP") return "people-outline";
  if (c === "WITHDRAWAL") return "arrow-up-circle-outline";
  if (c === "WITHDRAWAL_FEE") return "remove-circle-outline";
  if (c === "TRANSACTION_FEE") return "receipt-outline";
  return "list-outline";
}

function categoryLabel(category?: string) {
  const c = String(category || "").toUpperCase();

  if (c === "SAVINGS") return "Savings";
  if (c === "LOANS") return "Loans";
  if (c === "MERRY") return "Merry";
  if (c === "GROUP") return "Group";
  if (c === "WITHDRAWAL") return "Withdrawal";
  if (c === "WITHDRAWAL_FEE") return "Withdrawal Fee";
  if (c === "TRANSACTION_FEE") return "Transaction Fee";
  return c || "Other";
}

function isFeeCategory(category?: string) {
  const c = String(category || "").toUpperCase();
  return c === "WITHDRAWAL_FEE" || c === "TRANSACTION_FEE";
}

function LedgerRow({ entry }: { entry: PaymentLedgerEntry }) {
  const color = entryColor(entry);
  const sign = entrySign(entry);
  const feeRow = isFeeCategory(entry.category);

  const title =
    entry.narration ||
    categoryLabel(entry.category) ||
    "Ledger entry";

  const meta = [
    categoryLabel(entry.category),
    entry.reference,
    entry.created_at,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <Card style={[styles.entryCard, feeRow && styles.feeCard]}>
      <View style={styles.entryTop}>
        <View style={styles.entryIcon}>
          <Ionicons
            name={categoryIcon(entry.category) as any}
            size={18}
            color={feeRow ? COLORS.warning : COLORS.primary}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.entryTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.entryMeta} numberOfLines={2}>
            {meta || "—"}
          </Text>
        </View>

        <Text style={[styles.entryAmount, { color }]}>
          {sign} {formatKes(entry.amount)}
        </Text>
      </View>

      {feeRow ? (
        <View style={styles.feeNoteRow}>
          <Ionicons
            name="information-circle-outline"
            size={14}
            color={COLORS.warning}
          />
          <Text style={styles.feeNoteText}>
            This row shows a system fee applied during payment processing.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function LedgerScreen() {
  const [user, setUser] = useState<LedgerUser | null>(null);
  const [ledger, setLedger] = useState<PaymentLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, ledgerRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLedger(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: LedgerUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setLedger(
        ledgerRes.status === "fulfilled" && Array.isArray(ledgerRes.value)
          ? ledgerRes.value
          : []
      );

      if (ledgerRes.status === "rejected") {
        setError(getApiErrorMessage(ledgerRes.reason));
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
    let credits = 0;
    let debits = 0;
    let fees = 0;

    ledger.forEach((entry) => {
      const amount = Number(entry.amount ?? 0);
      if (!Number.isFinite(amount)) return;

      const type = String(entry.entry_type || "").toUpperCase();
      const category = String(entry.category || "").toUpperCase();

      if (type === "CREDIT") credits += amount;
      else if (type === "DEBIT") debits += amount;

      if (category === "WITHDRAWAL_FEE" || category === "TRANSACTION_FEE") {
        fees += amount;
      }
    });

    return {
      credits,
      debits,
      fees,
      count: ledger.length,
    };
  }, [ledger]);

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
          subtitle="Please login to access the ledger."
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
          <Text style={styles.hTitle}>Ledger</Text>
          <Text style={styles.hSub}>
            Deposits, withdrawals, fees and transaction entries •{" "}
            {isAdmin ? "Admin" : "Member"}
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

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Credits</Text>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>
            {formatKes(stats.credits)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Debits</Text>
          <Text style={[styles.summaryValue, { color: COLORS.danger }]}>
            {formatKes(stats.debits)}
          </Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Fees</Text>
          <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
            {formatKes(stats.fees)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Entries</Text>
          <Text style={styles.summaryValue}>{stats.count}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Quick Action</Text>
          <Button
            title="Deposit"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Quick Action</Text>
          <Button
            title="Withdraw"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.paymentsRequestWithdrawal)}
          />
        </View>
      </View>

      <Section title="Ledger Entries">
        {ledger.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No ledger entries"
            subtitle="Deposits, withdrawals and transaction fees will appear here."
            actionLabel="Deposit"
            onAction={() => router.push(ROUTES.tabs.paymentsDeposit)}
          />
        ) : (
          ledger.map((entry) => <LedgerRow key={entry.id} entry={entry} />)
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

  entryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  feeCard: {
    borderColor: COLORS.warning,
    borderWidth: 1,
  },

  entryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  entryIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
  },

  entryTitle: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
  },

  entryMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  entryAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  feeNoteRow: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  feeNoteText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },
});