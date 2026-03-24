// app/(tabs)/savings/history.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).replace("T", " ").slice(0, 16);
  return d.toLocaleDateString();
}

function getDisplayType(row: SavingsHistoryRow): "CREDIT" | "DEBIT" {
  const entry = String(row.entry_type || "").toUpperCase();
  const txn = String(row.txn_type || "").toUpperCase();

  if (entry === "CREDIT" || entry === "DEBIT") return entry;
  if (txn === "DEPOSIT") return "CREDIT";
  return "DEBIT";
}

function typeTone(type: "CREDIT" | "DEBIT") {
  return type === "CREDIT"
    ? {
        bg: "rgba(46,125,50,0.12)",
        color: COLORS.success,
        label: "CREDIT",
      }
    : {
        bg: "rgba(220,38,38,0.12)",
        color: COLORS.danger,
        label: "DEBIT",
      };
}

function TypePill({ type }: { type: "CREDIT" | "DEBIT" }) {
  const tone = typeTone(type);

  return (
    <View style={[styles.typePill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.typePillText, { color: tone.color }]}>
        {tone.label}
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
      const data = await getSavingsHistoryRows(0);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Savings", getErrorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        try {
          setLoading(true);
          await load();
        } finally {
          if (mounted) setLoading(false);
        }
      };

      run();

      return () => {
        mounted = false;
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
    let credit = 0;
    let debit = 0;

    rows.forEach((r) => {
      const type = getDisplayType(r);
      if (type === "CREDIT") credit += Number(r.amount || 0);
      else debit += Number(r.amount || 0);
    });

    return { credit, debit };
  }, [rows]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroTitle}>Savings History</Text>
            <Text style={styles.heroSubtitle}>
              Deposits and withdrawals across your savings accounts.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="time-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Credits</Text>
            <Text style={styles.heroStatValue}>{formatKes(totals.credit)}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Debits</Text>
            <Text style={styles.heroStatValue}>{formatKes(totals.debit)}</Text>
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Button
            title="Deposit"
            onPress={() => router.push("/(tabs)/payments/deposit" as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Savings"
            variant="secondary"
            onPress={() => router.push("/(tabs)/savings" as any)}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <Section title="Transactions">
        {rows.length === 0 ? (
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
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                    <Text style={styles.meta}>
                      {formatDate(r.created_at)}
                      {r.reference ? ` • Ref: ${r.reference}` : ""}
                    </Text>
                  </View>

                  <TypePill type={type} />
                </View>

                {r.narration || r.note ? (
                  <Text style={styles.note}>{r.narration || r.note}</Text>
                ) : null}
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroTitle: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  heroSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
    fontFamily: FONT.regular,
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  heroActionsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
    alignItems: "center",
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.text,
  },

  meta: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },

  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  typePillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});