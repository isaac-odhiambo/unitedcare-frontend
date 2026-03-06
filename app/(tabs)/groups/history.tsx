// app/(tabs)/savings/history.tsx
// ----------------------------------------------------
// Shows full savings transaction history (all accounts)

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
import {
    getSavingsHistoryRows,
    SavingsHistoryRow,
} from "@/services/savings";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(v?: string) {
  if (!v) return "—";
  return String(v).replace("T", " ").slice(0, 16);
}

function getDisplayType(row: SavingsHistoryRow): "CREDIT" | "DEBIT" {
  const entry = String(row.entry_type || "").toUpperCase();
  const txn = String(row.txn_type || "").toUpperCase();

  if (entry === "CREDIT" || entry === "DEBIT") return entry;

  if (txn === "DEPOSIT") return "CREDIT";
  return "DEBIT";
}

function EntryBadge({ type }: { type: "CREDIT" | "DEBIT" }) {
  const isCredit = type === "CREDIT";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isCredit
            ? "rgba(46,125,50,0.12)"
            : "rgba(220,38,38,0.12)",
        },
      ]}
    >
      <Text
        style={[
          styles.badgeText,
          { color: isCredit ? COLORS.success : COLORS.danger },
        ]}
      >
        {type}
      </Text>
    </View>
  );
}

export default function SavingsHistoryScreen() {
  const [rows, setRows] = useState<SavingsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // If backend later supports /savings/history/
      // replace with correct endpoint
      const data = await getSavingsHistoryRows(0);

      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Savings", getErrorMessage(e));
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

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;

    rows.forEach((r) => {
      const type = getDisplayType(r);

      if (type === "CREDIT") credit += Number(r.amount || 0);
      else debit += Number(r.amount || 0);
    });

    return { credit, debit };
  }, [rows]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Savings History</Text>
          <Text style={styles.subtitle}>
            Deposits and withdrawals across all savings
          </Text>
        </View>

        <Ionicons
          name="time-outline"
          size={22}
          color={COLORS.primary}
        />
      </View>

      {/* Summary */}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Total Credits</Text>
          <Text style={styles.summaryValue}>
            {formatKes(totals.credit)}
          </Text>
        </View>

        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Total Debits</Text>
          <Text style={styles.summaryValue}>
            {formatKes(totals.debit)}
          </Text>
        </View>
      </View>

      {/* Actions */}

      <View style={styles.actionBar}>
        <Button
          title="Deposit"
          onPress={() => router.push("/(tabs)/payments/deposit" as any)}
          style={{ flex: 1 }}
        />

        <View style={{ width: SPACING.sm }} />

        <Button
          title="Back to Accounts"
          variant="secondary"
          onPress={() => router.push("/(tabs)/savings" as any)}
          style={{ flex: 1 }}
        />
      </View>

      {/* Transactions */}

      <Section title="Transactions">
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No transactions yet"
            subtitle="Your savings deposits and withdrawals will appear here."
          />
        ) : (
          rows.slice(0, 300).map((r) => {
            const type = getDisplayType(r);

            return (
              <Card key={r.id} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <EntryBadge type={type} />

                  <Text style={styles.amount}>
                    {formatKes(r.amount)}
                  </Text>
                </View>

                <Text style={styles.meta}>
                  {formatDate(r.created_at)}
                  {r.reference ? ` • Ref: ${r.reference}` : ""}
                </Text>

                {(r.narration || r.note) && (
                  <Text style={styles.note}>
                    {r.narration || r.note}
                  </Text>
                )}
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

  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  subtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
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

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  meta: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  note: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});