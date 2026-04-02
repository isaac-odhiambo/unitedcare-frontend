// app/(tabs)/payments/withdrawals.tsx
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getMyWithdrawals,
  WithdrawalRequest,
} from "@/services/payments";
import {
  canWithdraw,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type WithdrawalsUser = Partial<MeResponse> & Partial<SessionUser>;

const BRAND = "#0C6A80";
const BRAND_DARK = "#09586A";
const BRAND_SOFT = "rgba(12,106,128,0.10)";
const BRAND_SOFT_2 = "rgba(12,106,128,0.16)";
const PAGE_BG = "#F4FBFC";
const CARD_BG = "#EEF7F9";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sourceLabel(source?: string | null) {
  const s = String(source || "").toUpperCase();
  if (s === "SAVINGS") return "Savings";
  if (s === "MERRY") return "Merry";
  if (s === "GROUP") return "Group";
  return source || "Wallet";
}

function statusMeta(status: string) {
  const s = String(status || "").toUpperCase();

  if (["PAID", "APPROVED", "SUCCESS"].includes(s)) {
    return {
      color: COLORS.success || "#16A34A",
      bg: "rgba(34,197,94,0.10)",
      label: "Completed",
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (["FAILED", "REJECTED", "CANCELLED"].includes(s)) {
    return {
      color: COLORS.danger || "#DC2626",
      bg: "rgba(239,68,68,0.10)",
      label: "Not completed",
      icon: "close-circle-outline" as const,
    };
  }

  if (["PENDING", "PROCESSING"].includes(s)) {
    return {
      color: COLORS.warning || "#D97706",
      bg: "rgba(245,158,11,0.10)",
      label: "In progress",
      icon: "time-outline" as const,
    };
  }

  return {
    color: COLORS.gray || "#6B7280",
    bg: "rgba(107,114,128,0.10)",
    label: status || "Unknown",
    icon: "ellipse-outline" as const,
  };
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);

  return (
    <View
      style={[
        styles.statusPill,
        {
          borderColor: meta.color,
          backgroundColor: meta.bg,
        },
      ]}
    >
      <Ionicons name={meta.icon} size={13} color={meta.color} />
      <Text
        style={[
          styles.statusText,
          {
            color: meta.color,
          },
        ]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </View>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={16} color={BRAND} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function QuickAction({
  title,
  subtitle,
  icon,
  onPress,
  primary = false,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.quickAction, primary && styles.quickActionPrimary]}
    >
      <View
        style={[
          styles.quickActionIconWrap,
          primary && styles.quickActionIconWrapPrimary,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={primary ? COLORS.white : BRAND}
        />
      </View>

      <View style={styles.quickActionTextWrap}>
        <Text
          style={[styles.quickActionTitle, primary && styles.quickActionTitlePrimary]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.quickActionSubtitle,
            primary && styles.quickActionSubtitlePrimary,
          ]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={primary ? "rgba(255,255,255,0.92)" : BRAND}
      />
    </TouchableOpacity>
  );
}

function WithdrawalCard({ item }: { item: WithdrawalRequest }) {
  const status = String(item.status || "");
  const meta = statusMeta(status);

  return (
    <Card style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardSourceWrap}>
          <View style={styles.cardSourceIcon}>
            <Ionicons name="wallet-outline" size={16} color={BRAND} />
          </View>

          <View style={styles.cardSourceTextWrap}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {sourceLabel(item.source)}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.phone || "No phone"}
            </Text>
          </View>
        </View>

        <StatusPill status={status} />
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottomRow}>
        <View style={styles.cardAmountWrap}>
          <Text style={styles.cardAmountLabel}>Requested amount</Text>
          <Text style={styles.cardAmount} numberOfLines={1} adjustsFontSizeToFit>
            {formatKes(item.amount)}
          </Text>
        </View>

        <View style={styles.cardStateBadge}>
          <Ionicons name={meta.icon} size={14} color={meta.color} />
          <Text
            style={[styles.cardStateText, { color: meta.color }]}
            numberOfLines={1}
          >
            {String(status || "Unknown")}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function WithdrawalsScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<WithdrawalsUser | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const withdrawAllowed = canWithdraw(user);

  const totalRequests = withdrawals.length;

  const completedCount = useMemo(
    () =>
      withdrawals.filter((item) =>
        ["PAID", "APPROVED", "SUCCESS"].includes(
          String(item.status || "").toUpperCase()
        )
      ).length,
    [withdrawals]
  );

  const pendingCount = useMemo(
    () =>
      withdrawals.filter((item) =>
        ["PENDING", "PROCESSING"].includes(
          String(item.status || "").toUpperCase()
        )
      ).length,
    [withdrawals]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, withdrawalsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyWithdrawals(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      setUser({ ...(sessionUser ?? {}), ...(meUser ?? {}) });

      setWithdrawals(
        withdrawalsRes.status === "fulfilled"
          ? withdrawalsRes.value || []
          : []
      );

      if (withdrawalsRes.status === "rejected") {
        setError(getApiErrorMessage(withdrawalsRes.reason));
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
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.center}>
          <ActivityIndicator color={BRAND} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="Not signed in"
            subtitle="Login to continue"
            actionLabel="Login"
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
          { paddingBottom: Math.max(insets.bottom + 26, 34) },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={BRAND} />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="cash-outline" size={14} color={BRAND} />
              <Text style={styles.heroBadgeText}>
                {isAdmin ? "Community activity" : "My activity"}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Withdrawals</Text>
          <Text style={styles.heroSubtitle}>
            Track your recent withdrawal requests, follow progress, and move easily
            between deposit and withdrawal actions.
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="All requests"
              value={String(totalRequests)}
              icon="list-outline"
            />
            <SummaryTile
              label="Completed"
              value={String(completedCount)}
              icon="checkmark-circle-outline"
            />
            <SummaryTile
              label="In progress"
              value={String(pendingCount)}
              icon="time-outline"
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger || "#DC2626"}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {!kycComplete ? (
          <Card style={styles.notice}>
            <View style={styles.noticeRow}>
              <View style={styles.noticeIconWrap}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={COLORS.warning || "#D97706"}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>KYC needed</Text>
                <Text style={styles.noticeText}>
                  Complete KYC first so you can send a withdrawal request smoothly.
                </Text>
              </View>
            </View>

            <View style={{ marginTop: SPACING.sm }}>
              <Button
                title="Open KYC"
                onPress={() => router.push(ROUTES.tabs.profileKyc)}
              />
            </View>
          </Card>
        ) : null}

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <Text style={styles.sectionSubtitle}>
            Choose what you want to do next.
          </Text>

          <View style={styles.quickActionsWrap}>
            <QuickAction
              title={withdrawAllowed ? "Request withdrawal" : "Complete KYC"}
              subtitle={
                withdrawAllowed
                  ? "Send money out from your savings, merry, or group wallet."
                  : "Finish verification to unlock withdrawal requests."
              }
              icon={withdrawAllowed ? "arrow-up-circle-outline" : "shield-outline"}
              onPress={() =>
                withdrawAllowed
                  ? router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                  : router.push(ROUTES.tabs.profileKyc)
              }
              primary
            />

            <QuickAction
              title="Deposit"
              subtitle="Add money into your community wallet in a few quick steps."
              icon="arrow-down-circle-outline"
              onPress={() => router.push(ROUTES.tabs.paymentsDeposit)}
            />
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Recent requests</Text>
          <Text style={styles.sectionSubtitle}>
            Here is the latest progress on your withdrawal activity.
          </Text>

          {withdrawals.length === 0 ? (
            <Card style={styles.emptyCard}>
              <EmptyState
                title="No withdrawals yet"
                subtitle="When you make a withdrawal request, it will appear here."
                actionLabel="Withdraw"
                onAction={() =>
                  router.push(ROUTES.tabs.paymentsRequestWithdrawal)
                }
              />
            </Card>
          ) : (
            <View style={styles.listWrap}>
              {withdrawals.map((item) => (
                <WithdrawalCard key={item.id} item={item} />
              ))}
            </View>
          )}
        </View>
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
    padding: SPACING.md,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PAGE_BG,
  },

  hero: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: BRAND,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    maxWidth: "68%",
  },

  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: COLORS.white,
    flexShrink: 1,
  },

  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.90)",
  },

  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  summaryTile: {
    flexGrow: 1,
    minWidth: 92,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },

  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    marginBottom: 8,
  },

  summaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.80)",
  },

  summaryValue: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 22,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    backgroundColor: "#FFF1F2",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger || "#DC2626",
  },

  notice: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.20)",
    backgroundColor: "#FFF7E8",
  },

  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.10)",
  },

  noticeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: "#8A5A00",
    marginBottom: 2,
  },

  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },

  sectionWrap: {
    marginTop: SPACING.md,
  },

  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  sectionSubtitle: {
    marginTop: 4,
    marginBottom: SPACING.sm,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  quickActionsWrap: {
    gap: SPACING.sm,
  },

  quickAction: {
    minHeight: 78,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.xl,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.10)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  quickActionPrimary: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },

  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  quickActionIconWrapPrimary: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  quickActionTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  quickActionTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: FONT.bold,
    color: BRAND_DARK,
  },

  quickActionTitlePrimary: {
    color: COLORS.white,
  },

  quickActionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  quickActionSubtitlePrimary: {
    color: "rgba(255,255,255,0.88)",
  },

  listWrap: {
    gap: SPACING.sm,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.10)",
    ...SHADOW.card,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardSourceWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  cardSourceIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_SOFT,
  },

  cardSourceTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    lineHeight: 19,
    color: BRAND_DARK,
  },

  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  cardDivider: {
    height: 1,
    backgroundColor: "rgba(12,106,128,0.08)",
    marginVertical: SPACING.md,
  },

  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: SPACING.sm,
  },

  cardAmountWrap: {
    flex: 1,
    minWidth: 0,
  },

  cardAmountLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  cardAmount: {
    marginTop: 4,
    fontFamily: FONT.bold,
    fontSize: 19,
    lineHeight: 24,
    color: BRAND_DARK,
  },

  cardStateBadge: {
    maxWidth: "42%",
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.70)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  cardStateText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    flexShrink: 1,
  },

  statusPill: {
    minHeight: 30,
    maxWidth: "42%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    flexShrink: 1,
  },

  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
    flexShrink: 1,
  },

  emptyCard: {
    padding: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.10)",
    ...SHADOW.card,
  },
});