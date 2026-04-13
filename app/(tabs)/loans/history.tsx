// app/(tabs)/loans/history.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getApiErrorMessage, getMyLoans, Loan } from "@/services/loans";

const UI = {
  page: "#062C49",

  text: "#FFFFFF",
  textSoft: "rgba(255,255,255,0.88)",
  textMuted: "rgba(255,255,255,0.72)",

  mint: "#8CF0C7",
  aqua: "#0CC0B7",
  careGreen: "#197D71",

  glass: "rgba(255,255,255,0.10)",
  glassStrong: "rgba(255,255,255,0.14)",
  border: "rgba(255,255,255,0.12)",

  supportCard: "rgba(52, 198, 191, 0.22)",
  supportBorder: "rgba(195, 255, 250, 0.16)",
  supportIconBg: "rgba(236, 255, 252, 0.76)",
  supportIcon: "#148C84",

  successCard: "rgba(98, 192, 98, 0.23)",
  successBorder: "rgba(194, 255, 188, 0.16)",
  successIconBg: "rgba(236, 255, 235, 0.76)",
  successIcon: "#379B4A",

  infoCard: "rgba(49, 180, 217, 0.22)",
  infoBorder: "rgba(189, 244, 255, 0.15)",
  infoIconBg: "rgba(236, 251, 255, 0.76)",
  infoIcon: "#0A6E8A",

  warningCard: "rgba(255, 204, 102, 0.16)",
  warningBorder: "rgba(255, 220, 140, 0.18)",
  warningIconBg: "rgba(255, 247, 224, 0.88)",
  warningIcon: "#B7791F",

  dangerCard: "rgba(220,53,69,0.18)",
};

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
  return d.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
      text: UI.mint,
      bg: "rgba(140,240,199,0.18)",
    };
  }

  if (["PENDING", "UNDER_REVIEW"].includes(value)) {
    return {
      text: "#FFD166",
      bg: "rgba(255,204,102,0.18)",
    };
  }

  if (["REJECTED", "CANCELLED", "DEFAULTED"].includes(value)) {
    return {
      text: "#FF8A8A",
      bg: "rgba(220,53,69,0.18)",
    };
  }

  return {
    text: "#FFFFFF",
    bg: "rgba(255,255,255,0.12)",
  };
}

function getLoanTitle(loan: Loan) {
  return loan.product_detail?.name || loan.product_name || `Support #${loan.id}`;
}

function HistoryHero({
  onBack,
  count,
}: {
  onBack: () => void;
  count: number | string;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroOrbOne} />
      <View style={styles.heroOrbTwo} />
      <View style={styles.heroOrbThree} />

      <View style={styles.heroTopRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.heroBadge}>
          <Ionicons name="time-outline" size={14} color="#FFFFFF" />
          <Text style={styles.heroBadgeText}>SUPPORT HISTORY</Text>
        </View>
      </View>

      <Text style={styles.heroTitle}>Support history</Text>
      <Text style={styles.heroAmount}>{count}</Text>
      <Text style={styles.heroSubtitle}>
        Review your current and past community support activity.
      </Text>
    </View>
  );
}

function LoanRow({ loan }: { loan: Loan }) {
  const tone = getStatusTone(loan.status);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() =>
        router.push({
          pathname: "/(tabs)/loans/[id]" as any,
          params: { id: String(loan.id) },
        })
      }
      style={styles.row}
    >
      <View style={styles.rowGlow1} />
      <View style={styles.rowGlow2} />

      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text-outline" size={18} color={UI.infoIcon} />
        </View>

        <View style={styles.rowContent}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {getLoanTitle(loan)}
          </Text>

          <Text style={styles.rowSubtitle}>
            {fmtKES(loan.principal)} • {fmtDate(loan.created_at)}
          </Text>

          <Text style={styles.rowMeta}>
            Remaining: {fmtKES(loan.outstanding_balance || 0)}
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

function SilentLoadingCard() {
  return (
    <View style={styles.silentWrap}>
      <View style={styles.silentCard}>
        <Text style={styles.silentTitle}>Loading support history</Text>
        <Text style={styles.silentText}>
          Your recent and past community support activity will appear here shortly.
        </Text>
      </View>
    </View>
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

  const handleBack = useCallback(() => {
    const canGoBack =
      typeof (router as any)?.canGoBack === "function"
        ? (router as any).canGoBack()
        : false;

    if (canGoBack) {
      router.back();
      return;
    }

    router.replace(ROUTES.tabs.loans as any);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={UI.mint}
            colors={[UI.mint, UI.aqua]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <HistoryHero onBack={handleBack} count={loading ? "—" : sortedLoans.length} />

        {!loading && error ? (
          <TouchableOpacity activeOpacity={0.92} onPress={onRefresh} style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <SilentLoadingCard />
        ) : sortedLoans.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="No activity yet"
              subtitle="Your community support history will appear here."
              actionLabel="Back to support"
              onAction={() => router.replace(ROUTES.tabs.loans as any)}
            />
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Your activity</Text>
            <View style={styles.list}>
              {sortedLoans.map((loan) => (
                <LoanRow key={loan.id} loan={loan} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: UI.page,
  },

  page: {
    flex: 1,
    backgroundColor: UI.page,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: UI.supportCard,
    borderRadius: 26,
    padding: 20,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: UI.supportBorder,
  },

  heroOrbOne: {
    position: "absolute",
    top: -34,
    right: -14,
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -26,
    left: -16,
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroOrbThree: {
    position: "absolute",
    top: 76,
    right: 42,
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadgeText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  heroTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 8,
  },

  heroAmount: {
    fontSize: 30,
    lineHeight: 36,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: UI.textSoft,
    fontFamily: FONT.regular,
  },

  errorCard: {
    minHeight: 56,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: UI.dangerCard,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.lg,
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
  },

  sectionTitle: {
    marginBottom: 12,
    fontSize: 17,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  emptyWrap: {
    marginTop: SPACING.sm,
  },

  silentWrap: {
    marginTop: SPACING.xs,
  },

  silentCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: UI.glass,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: SPACING.lg,
  },

  silentTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.bold,
    marginBottom: 6,
  },

  silentText: {
    color: UI.textSoft,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.regular,
  },

  list: {
    gap: SPACING.sm,
  },

  row: {
    position: "relative",
    overflow: "hidden",
    minHeight: 78,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: UI.infoCard,
    borderWidth: 1,
    borderColor: UI.infoBorder,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  rowGlow1: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  rowGlow2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: UI.infoIconBg,
  },

  rowContent: {
    flex: 1,
  },

  rowTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
  },

  rowMeta: {
    marginTop: 4,
    fontSize: 11,
    color: UI.textMuted,
    fontFamily: FONT.regular,
  },

  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginLeft: 10,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },
});