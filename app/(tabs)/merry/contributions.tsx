import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMyMerryPayments,
  getMyMerryWallet,
  MerryPaymentRow,
  MerryWalletResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryPaymentsUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.14)";
const SURFACE_CARD = "rgba(255,255,255,0.10)";
const SURFACE_BORDER = "rgba(255,255,255,0.12)";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-KE");
}

function toNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusTone(status: string) {
  const s = String(status || "").toUpperCase();

  if (s === "CONFIRMED") {
    return {
      color: "#DCFCE7",
      bg: "rgba(34,197,94,0.16)",
      border: "rgba(34,197,94,0.22)",
      label: "Confirmed",
    };
  }

  if (s === "PENDING") {
    return {
      color: "#FEF3C7",
      bg: "rgba(245,158,11,0.18)",
      border: "rgba(245,158,11,0.24)",
      label: "Pending",
    };
  }

  if (["FAILED", "CANCELLED"].includes(s)) {
    return {
      color: "#FECACA",
      bg: "rgba(239,68,68,0.18)",
      border: "rgba(239,68,68,0.24)",
      label: s === "FAILED" ? "Failed" : "Cancelled",
    };
  }

  return {
    color: "#D9F3F9",
    bg: "rgba(12,106,128,0.20)",
    border: "rgba(12,106,128,0.28)",
    label: s || "Unknown",
  };
}

function StatusPill({ label }: { label: string }) {
  const tone = statusTone(label);

  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
      <Text style={[styles.statusPillText, { color: tone.color }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={18} color={BRAND} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
    >
      <Text
        style={[
          styles.filterChipText,
          active ? styles.filterChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function PaymentCard({
  payment,
  onOpenMerry,
}: {
  payment: MerryPaymentRow;
  onOpenMerry: (payment: MerryPaymentRow) => void;
}) {
  return (
    <View style={styles.paymentCard}>
      <View style={styles.cardGlowTop} />
      <View style={styles.cardGlowBottom} />

      <View style={styles.paymentHeaderRow}>
        <View style={styles.paymentTitleWrap}>
          <View style={styles.paymentIconWrap}>
            <Ionicons name="repeat-outline" size={18} color={BRAND} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.paymentTitle}>
              {payment.merry_name || `Merry #${payment.merry_id}`}
            </Text>
            <Text style={styles.paymentSubtitle}>
              Recorded on {formatDateTime(payment.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentRight}>
          <Text style={styles.paymentAmount}>{formatKes(payment.amount)}</Text>
          <StatusPill label={payment.status} />
        </View>
      </View>

      <View style={styles.detailBlock}>
        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Period</Text>
          <Text style={styles.kvValue}>{payment.period_key || "—"}</Text>
        </View>

        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Phone</Text>
          <Text style={styles.kvValue}>{payment.payer_phone || "—"}</Text>
        </View>

        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Receipt</Text>
          <Text style={styles.kvValue}>
            {payment.mpesa_receipt_number || "—"}
          </Text>
        </View>

        <View style={styles.kvRow}>
          <Text style={styles.kvLabel}>Paid at</Text>
          <Text style={styles.kvValue}>{formatDateTime(payment.paid_at)}</Text>
        </View>
      </View>

      <View style={styles.paymentActionsRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.secondaryAction}
          onPress={() => onOpenMerry(payment)}
        >
          <Ionicons name="open-outline" size={16} color={WHITE} />
          <Text style={styles.secondaryActionText}>Open Merry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MerryContributionsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ merryId?: string; returnTo?: string }>();
  const initialMerryId = params.merryId ? Number(params.merryId) : null;

  const [user, setUser] = useState<MerryPaymentsUser | null>(null);
  const [payments, setPayments] = useState<MerryPaymentRow[]>([]);
  const [wallet, setWallet] = useState<MerryWalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedMerryId, setSelectedMerryId] = useState<number | null>(
    Number.isFinite(initialMerryId as number) ? initialMerryId : null
  );

  const backToMerryIndex = useCallback(() => {
    const target =
      typeof params.returnTo === "string" && params.returnTo.trim()
        ? params.returnTo
        : ROUTES.tabs.merry;

    router.replace(target as any);
  }, [params.returnTo]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, paymentsRes, walletRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyMerryPayments(),
          getMyMerryWallet(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (paymentsRes.status === "fulfilled") {
        setPayments(Array.isArray(paymentsRes.value) ? paymentsRes.value : []);
      } else {
        setPayments([]);
        setError(
          getApiErrorMessage(paymentsRes.reason) ||
            getErrorMessage(paymentsRes.reason)
        );
      }

      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value ?? null);
      } else {
        setWallet(null);
      }
    } catch (e: any) {
      setPayments([]);
      setWallet(null);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
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

  const merryOptions = useMemo(() => {
    const seen = new Map<number, string>();

    payments.forEach((payment) => {
      const id = Number(payment.merry_id);
      if (Number.isFinite(id) && id > 0 && !seen.has(id)) {
        seen.set(id, payment.merry_name || `Merry #${id}`);
      }
    });

    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [payments]);

  const selectedMerryName = useMemo(() => {
    if (!selectedMerryId) return "All Merries";
    return (
      merryOptions.find((m) => m.id === selectedMerryId)?.name ||
      `Merry #${selectedMerryId}`
    );
  }, [merryOptions, selectedMerryId]);

  const filteredPayments = useMemo(() => {
    if (!selectedMerryId) return payments;
    return payments.filter(
      (p) => Number(p.merry_id) === Number(selectedMerryId)
    );
  }, [payments, selectedMerryId]);

  const totals = useMemo(() => {
    const totalAmount = filteredPayments.reduce(
      (sum, p) => sum + (Number(p.amount || 0) || 0),
      0
    );

    const confirmed = filteredPayments.filter(
      (p) => String(p.status || "").toUpperCase() === "CONFIRMED"
    ).length;

    const pending = filteredPayments.filter(
      (p) => String(p.status || "").toUpperCase() === "PENDING"
    ).length;

    const failed = filteredPayments.filter((p) =>
      ["FAILED", "CANCELLED"].includes(String(p.status || "").toUpperCase())
    ).length;

    return {
      totalCount: filteredPayments.length,
      totalAmount,
      confirmed,
      pending,
      failed,
    };
  }, [filteredPayments]);

  const walletBalance = useMemo(() => {
    return toNumber(wallet?.wallet_balance || 0);
  }, [wallet]);

  const openMerryFromPayment = useCallback((payment: MerryPaymentRow) => {
    router.push({
      pathname: "/(tabs)/merry/[id]" as any,
      params: {
        id: String(payment.merry_id),
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyScreenWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to access your merry contributions."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login)}
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
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="receipt-outline" size={22} color={WHITE} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                CONTRIBUTION <Text style={styles.brandWordmarkGreen}>RECORDS</Text>
              </Text>
              <Text style={styles.brandSub}>Community contribution journey</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={WHITE} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={backToMerryIndex}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroShell}>
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <Text style={styles.heroTag}>MERRY CONTRIBUTIONS</Text>
          <Text style={styles.heroTitle}>Track your contribution records</Text>
          <Text style={styles.heroSubtitle}>
            Review contribution records for one merry space or switch back to all
            your merry activity in the same community style as your dashboard.
          </Text>

          <View style={styles.heroFooterRow}>
            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatLabel}>Wallet</Text>
              <Text style={styles.heroStatValue}>{formatKes(walletBalance)}</Text>
            </View>

            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatLabel}>View</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {selectedMerryName}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color="#FECACA" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.glassCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons name="options-outline" size={18} color={BRAND} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>Choose what to view</Text>
              <Text style={styles.sectionCardSubtitle}>
                Open this merry only or switch back to all merry records.
              </Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            <FilterChip
              label="All Merries"
              active={!selectedMerryId}
              onPress={() => setSelectedMerryId(null)}
            />

            {selectedMerryId ? (
              <FilterChip
                label={selectedMerryName}
                active
                onPress={() => setSelectedMerryId(null)}
              />
            ) : null}
          </View>

          {merryOptions.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.merryScrollContent}
            >
              {merryOptions.map((item) => (
                <FilterChip
                  key={`merry-${item.id}`}
                  label={item.name}
                  active={selectedMerryId === item.id}
                  onPress={() => setSelectedMerryId(item.id)}
                />
              ))}
            </ScrollView>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Quick Summary</Text>
        <Text style={styles.sectionSubtitle}>
          A quick view of your contribution progress in the selected view.
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label={selectedMerryId ? "Filtered records" : "All payments"}
            value={totals.totalCount}
            icon="albums-outline"
          />
          <SummaryCard
            label="Total contributed"
            value={formatKes(totals.totalAmount)}
            icon="cash-outline"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Confirmed"
            value={totals.confirmed}
            icon="checkmark-circle-outline"
          />
          <SummaryCard
            label="Pending"
            value={totals.pending}
            icon="time-outline"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Failed / Cancelled"
            value={totals.failed}
            icon="close-circle-outline"
          />
          <SummaryCard
            label="Wallet balance"
            value={formatKes(walletBalance)}
            icon="wallet-outline"
          />
        </View>

        <View style={styles.historyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {selectedMerryId ? "This Merry Activity" : "Contribution Activity"}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedMerryId
                ? `Showing contribution records for ${selectedMerryName}.`
                : "Your most recent merry contribution records appear below."}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.historyAction}
            onPress={backToMerryIndex}
          >
            <Ionicons name="people-outline" size={16} color={WHITE} />
            <Text style={styles.historyActionText}>Open Merry</Text>
          </TouchableOpacity>
        </View>

        {filteredPayments.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="cash-outline"
              title={
                selectedMerryId
                  ? "No records for this merry yet"
                  : "No merry contributions yet"
              }
              subtitle={
                selectedMerryId
                  ? "This selected merry does not have contribution records yet."
                  : "Your contribution history will appear here after your first contribution."
              }
              actionLabel={selectedMerryId ? "Show All Merries" : "Go to Merry"}
              onAction={() =>
                selectedMerryId ? setSelectedMerryId(null) : backToMerryIndex()
              }
            />
          </View>
        ) : (
          filteredPayments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onOpenMerry={openMerryFromPayment}
            />
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
  },

  emptyScreenWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
    padding: 24,
  },

  emptyWrap: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(19, 195, 178, 0.10)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(52, 174, 213, 0.08)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(112, 208, 115, 0.09)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 100,
    left: 40,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 180,
    right: 60,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  brandWordmark: {
    color: WHITE,
    fontSize: 17,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  brandWordmarkGreen: {
    color: "#74D16C",
  },

  brandSub: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT.regular,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroShell: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(12,106,128,0.48)",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(176, 243, 234, 0.10)",
  },

  heroOrbOne: {
    position: "absolute",
    right: -36,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.18)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -12,
    bottom: -35,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "rgba(42, 191, 120, 0.18)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 70,
    bottom: -60,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroTag: {
    color: "#D8FFF0",
    fontSize: 11,
    letterSpacing: 1.1,
    marginBottom: 8,
    fontFamily: FONT.bold,
  },

  heroTitle: {
    color: WHITE,
    fontSize: 24,
    lineHeight: 31,
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    color: TEXT_ON_DARK,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: FONT.regular,
    maxWidth: "96%",
  },

  heroFooterRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatChip: {
    flex: 1,
    backgroundColor: SOFT_WHITE_2,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroStatLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },

  heroStatValue: {
    marginTop: 4,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: WHITE,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(239,68,68,0.18)",
    borderRadius: 20,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  errorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239,68,68,0.12)",
  },

  errorText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: "#FECACA",
  },

  glassCard: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    ...SHADOW.card,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: SPACING.md,
  },

  sectionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  sectionCardTitle: {
    color: WHITE,
    fontSize: 17,
    fontFamily: FONT.bold,
  },

  sectionCardSubtitle: {
    marginTop: 4,
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginTop: SPACING.sm,
  },

  merryScrollContent: {
    gap: SPACING.sm as any,
    paddingTop: SPACING.sm,
    paddingRight: SPACING.sm,
  },

  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.round,
    backgroundColor: SOFT_WHITE,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  filterChipActive: {
    backgroundColor: "rgba(116,209,108,0.20)",
    borderColor: "rgba(116,209,108,0.28)",
  },

  filterChipText: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: WHITE,
  },

  filterChipTextActive: {
    color: "#D8FFF0",
  },

  sectionTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: WHITE,
    marginBottom: SPACING.xs,
  },

  sectionSubtitle: {
    marginTop: 4,
    marginBottom: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.sm,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    ...SHADOW.card,
  },

  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHITE,
    marginBottom: 10,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: WHITE,
  },

  historyHeader: {
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: SPACING.md,
  },

  historyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  historyActionText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: WHITE,
  },

  paymentCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  cardGlowTop: {
    position: "absolute",
    top: -30,
    right: -15,
    width: 120,
    height: 120,
    borderRadius: 120,
    backgroundColor: "rgba(52,174,213,0.10)",
  },

  cardGlowBottom: {
    position: "absolute",
    bottom: -35,
    left: -12,
    width: 110,
    height: 110,
    borderRadius: 110,
    backgroundColor: "rgba(112,208,115,0.08)",
  },

  paymentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  paymentTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingRight: 8,
  },

  paymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  paymentTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: WHITE,
  },

  paymentSubtitle: {
    marginTop: 5,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  paymentRight: {
    alignItems: "flex-end",
    gap: 8,
  },

  paymentAmount: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: WHITE,
  },

  detailBlock: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: TEXT_ON_DARK_SOFT,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: WHITE,
  },

  paymentActionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  secondaryActionText: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: WHITE,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },

  statusPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },
});
