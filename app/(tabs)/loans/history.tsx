// app/(tabs)/loans/history.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getApiErrorMessage, getMyLoans, Loan } from "@/services/loans";

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function formatStatus(status?: string | null) {
  const value = String(status || "").replaceAll("_", " ").trim();
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function getStatusTone(status?: string | null) {
  const value = String(status || "").toUpperCase();

  if (value === "COMPLETED") {
    return {
      text: COLORS.secondary,
      bg: "rgba(22, 163, 74, 0.10)",
    };
  }

  if (["PENDING", "UNDER_REVIEW"].includes(value)) {
    return {
      text: COLORS.warning,
      bg: "rgba(245, 158, 11, 0.12)",
    };
  }

  if (["REJECTED", "CANCELLED", "DEFAULTED"].includes(value)) {
    return {
      text: COLORS.danger,
      bg: "rgba(239, 68, 68, 0.10)",
    };
  }

  return {
    text: COLORS.primary,
    bg: "rgba(14, 94, 111, 0.10)",
  };
}

function getLoanTitle(loan: Loan) {
  return loan.product_detail?.name || loan.product_name || `Loan #${loan.id}`;
}

function LoanRow({ loan }: { loan: Loan }) {
  const tone = getStatusTone(loan.status);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(ROUTES.dynamic.loanDetail(loan.id) as any)}
      style={styles.row}
    >
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Ionicons
            name="document-text-outline"
            size={18}
            color={COLORS.primary}
          />
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {getLoanTitle(loan)}
          </Text>

          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {fmtKES(loan.principal)} • {fmtDate(loan.created_at)}
          </Text>
        </View>
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.text }]}>
            {formatStatus(loan.status)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textMuted}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function LoanHistoryScreen() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getMyLoans();
      setLoans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(getApiErrorMessage(e) || getErrorMessage(e));
      setLoans([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoading(true);
          await load();
        } finally {
          setLoading(false);
        }
      };

      run();
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

  const sortedLoans = useMemo(() => {
    return [...loans].sort((a, b) => Number(b.id) - Number(a.id));
  }, [loans]);

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Loan History</Text>
        <Text style={styles.headerSubtitle}>
          Your past and current loan records
        </Text>
      </View>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {sortedLoans.length === 0 ? (
        <EmptyState
          title="No loan records yet"
          subtitle="Your loan records will appear here."
          actionLabel="Back to Loans"
          onAction={() => router.replace(ROUTES.tabs.loans as any)}
        />
      ) : (
        <View style={styles.list}>
          {sortedLoans.map((loan) => (
            <LoanRow key={loan.id} loan={loan} />
          ))}
        </View>
      )}

      <View style={{ height: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.md,
  },

  headerTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: COLORS.text,
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: COLORS.textMuted,
  },

  errorCard: {
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: "#FFF4F4",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  errorText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    color: COLORS.danger,
  },

  list: {
    gap: SPACING.sm,
  },

  row: {
    minHeight: 68,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "rgba(14, 94, 111, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.soft,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  rowContent: {
    flex: 1,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14, 94, 111, 0.08)",
  },

  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.text,
  },

  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: COLORS.textMuted,
  },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  statusText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
  },
});