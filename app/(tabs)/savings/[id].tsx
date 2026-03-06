// app/(tabs)/savings/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
    getSavingsAccountHistory,
    SavingsAccountHistory,
    SavingsTransaction,
} from "@/services/savings";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TxnIcon({ type }: { type: string }) {
  const t = String(type || "").toUpperCase();
  const name =
    t === "DEPOSIT"
      ? "arrow-down-circle-outline"
      : t === "WITHDRAWAL"
      ? "arrow-up-circle-outline"
      : t === "AUTO_DEDUCT"
      ? "remove-circle-outline"
      : "document-text-outline";
  return <Ionicons name={name as any} size={18} color={COLORS.gray} />;
}

function TxnRow({ t }: { t: SavingsTransaction }) {
  const kind = String(t.txn_type || "").toUpperCase();
  const isIn = kind === "DEPOSIT";
  const sign = isIn ? "+" : "-";

  return (
    <Card style={{ marginBottom: SPACING.sm }}>
      <View style={styles.txRow}>
        <View style={styles.txLeft}>
          <TxnIcon type={kind} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.txTitle}>{kind.replace("_", " ")}</Text>
            <Text style={styles.txSub}>
              {t.reference ? `Ref: ${t.reference}` : "—"} • {new Date(t.created_at).toLocaleString()}
            </Text>
          </View>
        </View>

        <Text style={[styles.txAmt, { color: isIn ? COLORS.success : COLORS.danger }]}>
          {sign} {formatKes(t.amount)}
        </Text>
      </View>

      {t.note ? <Text style={styles.txNote}>{t.note}</Text> : null}
    </Card>
  );
}

export default function SavingsAccountDetailScreen() {
  const { id } = useLocalSearchParams();
  const accountId = Number(id);

  const [data, setData] = useState<SavingsAccountHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getSavingsAccountHistory(accountId);
      setData(res);
    } catch (e: any) {
      Alert.alert("Savings", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      if (Number.isFinite(accountId)) load();
    }, [accountId, load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const acct = data?.account;

  const quick = useMemo(() => {
    if (!acct) return { bal: 0, res: 0, avail: 0 };
    return {
      bal: Number(acct.balance ?? 0) || 0,
      res: Number(acct.reserved_amount ?? 0) || 0,
      avail: Number(acct.available_balance ?? 0) || 0,
    };
  }, [acct]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.hTitle}>{acct?.name || `Account #${accountId}`}</Text>
        <Text style={styles.hSub}>Transaction history and balances</Text>

        <View style={{ height: SPACING.md }} />

        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>Balance</Text>
            <Text style={styles.summaryValue}>{formatKes(quick.bal)}</Text>
          </View>
          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>Available</Text>
            <Text style={styles.summaryValue}>{formatKes(quick.avail)}</Text>
          </View>
        </View>

        <View style={styles.actionBar}>
          <Button
            title="Deposit"
            onPress={() => router.push("/payments/deposit" as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Withdraw"
            variant="secondary"
            onPress={() => router.push("/payments/request-withdrawal" as any)}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <Section title="Transactions">
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : !data || (data.transactions || []).length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No transactions"
            subtitle="Your deposits and withdrawals will show here."
          />
        ) : (
          data.transactions.map((t) => <TxnRow key={t.id} t={t} />)
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
  },

  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  summaryGrid: { marginTop: SPACING.md, flexDirection: "row", gap: SPACING.sm as any },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  summaryLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  summaryValue: { marginTop: 8, fontFamily: FONT.bold, fontSize: 16, color: COLORS.dark },

  actionBar: { flexDirection: "row", marginTop: SPACING.md, alignItems: "center" },

  muted: { marginTop: 6, fontFamily: FONT.regular, color: COLORS.gray },

  txRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  txLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 },
  txTitle: { fontFamily: FONT.bold, fontSize: 13, color: COLORS.dark },
  txSub: { marginTop: 4, fontFamily: FONT.regular, fontSize: 11, color: COLORS.gray },
  txAmt: { fontFamily: FONT.bold, fontSize: 12 },

  txNote: { marginTop: 10, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
});