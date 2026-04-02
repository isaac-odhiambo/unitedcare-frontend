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
import { SafeAreaView } from "react-native-safe-area-context";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getApiErrorMessage, getMyLoans, Loan } from "@/services/loans";

/* ---------------- HELPERS ---------------- */

function toNum(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function fmtKES(amount?: string | number | null) {
  const n = toNum(amount);
  return `KES ${n.toLocaleString("en-KE")}`;
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
    return { text: "#8CF0C7", bg: "rgba(140,240,199,0.18)" };
  }

  if (["PENDING", "UNDER_REVIEW"].includes(value)) {
    return { text: "#FFD166", bg: "rgba(255,204,102,0.18)" };
  }

  if (["REJECTED", "CANCELLED", "DEFAULTED"].includes(value)) {
    return { text: "#FF6B6B", bg: "rgba(220,53,69,0.18)" };
  }

  return { text: "#FFFFFF", bg: "rgba(255,255,255,0.12)" };
}

function getLoanTitle(loan: Loan) {
  return loan.product_detail?.name || loan.product_name || `Support #${loan.id}`;
}

/* ---------------- ROW ---------------- */

function LoanRow({ loan }: { loan: Loan }) {
  const tone = getStatusTone(loan.status);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push(ROUTES.dynamic.loanDetail(loan.id) as any)}
      style={styles.row}
    >
      <View style={styles.rowGlow1} />
      <View style={styles.rowGlow2} />

      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text-outline" size={18} color="#0A6E8A" />
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {getLoanTitle(loan)}
          </Text>

          <Text style={styles.rowSubtitle}>
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

        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
      </View>
    </TouchableOpacity>
  );
}

/* ---------------- SCREEN ---------------- */

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

  /* ---------------- LOADING ---------------- */

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* BACKGROUND BLOBS */}
        <View style={styles.bgBlob1} />
        <View style={styles.bgBlob2} />

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Support history</Text>
          <Text style={styles.headerSubtitle}>
            Your past and current community support
          </Text>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {sortedLoans.length === 0 ? (
          <EmptyState
            title="No activity yet"
            subtitle="Your community support history will appear here."
            actionLabel="Back"
            onAction={() => router.replace(ROUTES.tabs.loans as any)}
          />
        ) : (
          <View style={styles.list}>
            {sortedLoans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} />
            ))}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.md,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0C6A80",
  },

  bgBlob1: {
    position: "absolute",
    top: -100,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  bgBlob2: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  header: {
    marginBottom: SPACING.md,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    gap: SPACING.sm,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderRadius: 18,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
  },

  list: {
    gap: SPACING.sm,
  },

  row: {
    position: "relative",
    overflow: "hidden",
    minHeight: 70,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: "rgba(49,180,217,0.22)",
    borderWidth: 1,
    borderColor: "rgba(189,244,255,0.15)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowGlow1: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  rowGlow2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(236,251,255,0.9)",
  },

  rowContent: {
    flex: 1,
  },

  rowTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
  },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
});