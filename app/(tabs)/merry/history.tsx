// app/(tabs)/merry/history.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
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

type MerryHistoryUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.14)";
const SURFACE_CARD = "rgba(255,255,255,0.10)";
const SURFACE_BORDER = "rgba(255,255,255,0.12)";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const DANGER_BG = "rgba(239,68,68,0.18)";
const DANGER_TEXT = "#FECACA";
const ACCENT_BG = "rgba(12,106,128,0.20)";
const ACCENT_TEXT = "#D9F3F9";

function moneyNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatKes(value?: string | number | null) {
  const n = moneyNumber(value);
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPaymentNumber(payment: MerryPaymentRow, key: string) {
  return moneyNumber((payment as any)?.[key]);
}

function hasPaymentNumber(payment: MerryPaymentRow, key: string) {
  return getPaymentNumber(payment, key) > 0;
}

function statusTone(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s === "CONFIRMED") {
    return {
      color: SUCCESS_TEXT,
      bg: SUCCESS_BG,
      border: "rgba(34,197,94,0.24)",
      label: "Confirmed",
    };
  }

  if (s === "PENDING") {
    return {
      color: WARNING_TEXT,
      bg: WARNING_BG,
      border: "rgba(245,158,11,0.26)",
      label: "Pending",
    };
  }

  if (s === "FAILED" || s === "CANCELLED") {
    return {
      color: DANGER_TEXT,
      bg: DANGER_BG,
      border: "rgba(239,68,68,0.26)",
      label: s === "FAILED" ? "Failed" : "Cancelled",
    };
  }

  return {
    color: ACCENT_TEXT,
    bg: ACCENT_BG,
    border: "rgba(12,106,128,0.28)",
    label: s || "Unknown",
  };
}

function StatusPill({ status }: { status?: string | null }) {
  const tone = statusTone(status);

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
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.summaryValue}>
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
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DetailRow({
  label,
  value,
  valueTone = "normal",
}: {
  label: string;
  value: string;
  valueTone?: "normal" | "success" | "warning" | "danger";
}) {
  const color =
    valueTone === "success"
      ? SUCCESS_TEXT
      : valueTone === "warning"
        ? WARNING_TEXT
        : valueTone === "danger"
          ? DANGER_TEXT
          : WHITE;

  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={[styles.kvValue, { color }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PaymentCard({
  payment,
  onOpenMerry,
}: {
  payment: MerryPaymentRow;
  onOpenMerry: (payment: MerryPaymentRow) => void;
}) {
  const contributionAmount = moneyNumber(payment.amount);
  const grossAmount = getPaymentNumber(payment, "gross_amount");
  const transactionFee = getPaymentNumber(payment, "transaction_fee");
  const hasFeeBreakdown = grossAmount > 0 || transactionFee > 0;
  const effectiveGrossAmount =
    grossAmount > 0 ? grossAmount : contributionAmount + transactionFee;

  return (
    <View style={styles.paymentCard}>
      <View style={styles.cardGlowTop} />
      <View style={styles.cardGlowBottom} />

      <View style={styles.paymentHeaderRow}>
        <View style={styles.paymentTitleWrap}>
          <View style={styles.paymentIconWrap}>
            <Ionicons name="receipt-outline" size={18} color={BRAND} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.paymentTitle} numberOfLines={1}>
              {payment.merry_name || `Merry #${payment.merry_id}`}
            </Text>
            <Text style={styles.paymentSubtitle}>
              Recorded on {formatDateTime(payment.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentRight}>
          <Text style={styles.paymentAmount}>
            {formatKes(contributionAmount)}
          </Text>
          <StatusPill status={payment.status} />
        </View>
      </View>

      <View style={styles.detailBlock}>
        <DetailRow label="Contribution" value={formatKes(contributionAmount)} />

        {hasFeeBreakdown ? (
          <>
            <DetailRow
              label="Transaction fee"
              value={formatKes(transactionFee)}
              valueTone={transactionFee > 0 ? "warning" : "normal"}
            />
            <DetailRow label="Total paid" value={formatKes(effectiveGrossAmount)} />
          </>
        ) : null}

        <DetailRow label="Period" value={payment.period_key || "—"} />
        <DetailRow label="Phone" value={payment.payer_phone || "—"} />
        <DetailRow
          label="Receipt"
          value={payment.mpesa_receipt_number || "—"}
        />
        <DetailRow label="Paid at" value={formatDateTime(payment.paid_at)} />
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

export default function MerryHistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    merryId?: string;
    returnTo?: string;
    backLabel?: string;
  }>();

  const initialMerryId = params.merryId ? Number(params.merryId) : null;

  const [user, setUser] = useState<MerryHistoryUser | null>(null);
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
      merryOptions.find((item) => item.id === selectedMerryId)?.name ||
      `Merry #${selectedMerryId}`
    );
  }, [merryOptions, selectedMerryId]);

  const filteredPayments = useMemo(() => {
    if (!selectedMerryId) return payments;

    return payments.filter(
      (payment) => Number(payment.merry_id) === Number(selectedMerryId)
    );
  }, [payments, selectedMerryId]);

  const totals = useMemo(() => {
    const confirmedPayments = filteredPayments.filter(
      (payment) => String(payment.status || "").toUpperCase() === "CONFIRMED"
    );

    const totalContribution = confirmedPayments.reduce(
      (sum, payment) => sum + moneyNumber(payment.amount),
      0
    );

    const totalGross = confirmedPayments.reduce((sum, payment) => {
      const gross = getPaymentNumber(payment, "gross_amount");
      const fee = getPaymentNumber(payment, "transaction_fee");

      if (gross > 0) return sum + gross;
      return sum + moneyNumber(payment.amount) + fee;
    }, 0);

    const totalFees = confirmedPayments.reduce(
      (sum, payment) => sum + getPaymentNumber(payment, "transaction_fee"),
      0
    );

    const pending = filteredPayments.filter(
      (payment) => String(payment.status || "").toUpperCase() === "PENDING"
    ).length;

    const failed = filteredPayments.filter((payment) =>
      ["FAILED", "CANCELLED"].includes(
        String(payment.status || "").toUpperCase()
      )
    ).length;

    return {
      totalCount: filteredPayments.length,
      confirmedCount: confirmedPayments.length,
      pendingCount: pending,
      failedCount: failed,
      totalContribution,
      totalGross,
      totalFees,
    };
  }, [filteredPayments]);

  const walletBalance = useMemo(() => {
    return moneyNumber(wallet?.wallet_balance || 0);
  }, [wallet]);

  const walletUpdatedAt = useMemo(() => {
    return formatDateTime((wallet as any)?.updated_at || null);
  }, [wallet]);

  const openMerryFromPayment = useCallback((payment: MerryPaymentRow) => {
    router.push({
      pathname: "/(tabs)/merry/[id]" as any,
      params: {
        id: String(payment.merry_id),
        returnTo: "/(tabs)/merry/history",
      },
    });
  }, []);

  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyScreenWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to view your merry history."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
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
              <Ionicons name="time-outline" size={22} color={WHITE} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brandWordmark}>
                MERRY <Text style={styles.brandWordmarkGreen}>HISTORY</Text>
              </Text>
              <Text style={styles.brandSub}>Payments and contribution records</Text>
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

          <Text style={styles.heroTag}>MERRY RECORDS</Text>
          <Text style={styles.heroTitle}>Track your merry activity</Text>
          <Text style={styles.heroSubtitle}>
            View your confirmed contributions, pending payments, failed records,
            wallet balance, and any separated transaction fees.
          </Text>

          <View style={styles.heroFooterRow}>
            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatLabel}>Wallet</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {formatKes(walletBalance)}
              </Text>
            </View>

            <View style={styles.heroStatChip}>
              <Text style={styles.heroStatLabel}>Current view</Text>
              <Text style={styles.heroStatValue} numberOfLines={1}>
                {selectedMerryName}
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color={DANGER_TEXT} />
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
              <Text style={styles.sectionCardTitle}>Filter records</Text>
              <Text style={styles.sectionCardSubtitle}>
                Show all merry payments or filter the list by one merry group.
              </Text>
            </View>
          </View>

          <View style={styles.filterRow}>
            <FilterChip
              label="All Merries"
              active={!selectedMerryId}
              onPress={() => setSelectedMerryId(null)}
            />
          </View>

          {merryOptions.length > 0 ? (
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

        <Text style={styles.sectionTitle}>Summary</Text>
        <Text style={styles.sectionSubtitle}>
          These totals are based on the selected payment records.
        </Text>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Records"
            value={totals.totalCount}
            icon="albums-outline"
          />
          <SummaryCard
            label="Confirmed"
            value={totals.confirmedCount}
            icon="checkmark-circle-outline"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Contribution"
            value={formatKes(totals.totalContribution)}
            icon="cash-outline"
          />
          <SummaryCard
            label="Fees"
            value={formatKes(totals.totalFees)}
            icon="card-outline"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Total paid"
            value={formatKes(totals.totalGross)}
            icon="wallet-outline"
          />
          <SummaryCard
            label="Pending"
            value={totals.pendingCount}
            icon="time-outline"
          />
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard
            label="Failed"
            value={totals.failedCount}
            icon="close-circle-outline"
          />
          <SummaryCard
            label="Wallet"
            value={formatKes(walletBalance)}
            icon="briefcase-outline"
          />
        </View>

        <View style={styles.walletStrip}>
          <Ionicons name="wallet-outline" size={17} color={ACCENT_TEXT} />
          <Text style={styles.walletStripText}>
            Wallet balance is {formatKes(walletBalance)}
            {walletUpdatedAt !== "—" ? ` • Updated ${walletUpdatedAt}` : ""}
          </Text>
        </View>

        <View style={styles.historyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {selectedMerryId ? "Selected Merry Records" : "All Payment Records"}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedMerryId
                ? `Showing records for ${selectedMerryName}.`
                : "Your most recent merry payment records appear below."}
            </Text>
          </View>
        </View>

        {filteredPayments.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="receipt-outline"
              title={
                selectedMerryId
                  ? "No records for this merry"
                  : "No merry history yet"
              }
              subtitle={
                selectedMerryId
                  ? "This selected merry does not have payment records yet."
                  : "Your merry contribution history will appear here after payments are recorded."
              }
              actionLabel={selectedMerryId ? "Show All Merries" : "Back to Merry"}
              onAction={() =>
                selectedMerryId ? setSelectedMerryId(null) : backToMerryIndex()
              }
            />
          </View>
        ) : (
          filteredPayments.map((payment) => (
            <PaymentCard
              key={String(payment.id)}
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
    backgroundColor: DANGER_BG,
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
    color: DANGER_TEXT,
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
    maxWidth: 190,
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
    lineHeight: 18,
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

  walletStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 18,
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.28)",
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  walletStripText: {
    flex: 1,
    color: ACCENT_TEXT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },

  historyHeader: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: SPACING.md,
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
    justifyContent: "flex-end",
  },

  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  secondaryActionText: {
    color: WHITE,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  statusPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },
});
