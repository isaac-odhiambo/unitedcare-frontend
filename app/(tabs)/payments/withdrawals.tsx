// app/(tabs)/payments/withdrawals.tsx

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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getMyWithdrawals,
  WithdrawalRequest,
} from "@/services/payments";
import {
  getMe,
  isAdminUser,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type WithdrawalsUser = Partial<MeResponse> & Partial<SessionUser>;
type NoticeTone = "primary" | "success" | "warning" | "info";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.92)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.76)";
const TEXT_ON_DARK_MUTED = "rgba(255,255,255,0.58)";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSourceLabel(source?: string | null) {
  const s = String(source || "").toUpperCase();
  if (s === "SAVINGS") return "Savings";
  if (s === "MERRY") return "Merry";
  if (s === "GROUP") return "Group";
  return "Community wallet";
}

function formatDateLabel(value?: string | null) {
  if (!value) return "Recent request";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getOverviewTonePalette(tone: NoticeTone) {
  const map = {
    primary: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(12,106,128,0.05)",
    },
    success: {
      iconBg: "rgba(65,163,87,0.12)",
      icon: "#379B4A",
      buttonBg: "#197D71",
      buttonBorder: "#197D71",
      soft: "rgba(65,163,87,0.05)",
    },
    warning: {
      iconBg: "rgba(24,140,132,0.12)",
      icon: "#148C84",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(20,140,132,0.05)",
    },
    info: {
      iconBg: "rgba(12,106,128,0.12)",
      icon: "#0C6A80",
      buttonBg: "#FFFFFF",
      buttonBorder: "rgba(12,106,128,0.20)",
      soft: "rgba(12,106,128,0.05)",
    },
  };

  return map[tone];
}

function getStatusMeta(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (["PAID", "APPROVED", "COMPLETED", "SUCCESS"].includes(s)) {
    return {
      label: "Completed",
      helper: "Money was sent successfully.",
      color: "#41A357",
      bg: "rgba(65,163,87,0.16)",
      border: "rgba(125,232,147,0.20)",
      icon: "checkmark-circle-outline" as const,
    };
  }

  if (["FAILED", "REJECTED", "CANCELLED", "BLOCKED"].includes(s)) {
    return {
      label: "Not completed",
      helper: "This request did not go through.",
      color: "#EF4444",
      bg: "rgba(239,68,68,0.16)",
      border: "rgba(255,135,135,0.20)",
      icon: "close-circle-outline" as const,
    };
  }

  if (["PENDING", "PROCESSING", "UNDER_REVIEW"].includes(s)) {
    return {
      label: "In progress",
      helper: "Your request is being reviewed.",
      color: "#F59E0B",
      bg: "rgba(245,158,11,0.16)",
      border: "rgba(255,211,132,0.20)",
      icon: "time-outline" as const,
    };
  }

  return {
    label: status || "Unknown",
    helper: "Check again later for updates.",
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.16)",
    border: "rgba(203,213,225,0.18)",
    icon: "help-circle-outline" as const,
  };
}

function NoticeBanner({
  tone,
  icon,
  title,
  text,
  buttonLabel,
  onPress,
}: {
  tone: NoticeTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  buttonLabel?: string;
  onPress?: () => void;
}) {
  const palette = getOverviewTonePalette(tone);

  return (
    <View style={styles.noticeCard}>
      <View style={[styles.noticeGlow, { backgroundColor: palette.soft }]} />

      <View style={styles.noticeTop}>
        <View style={[styles.noticeIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>{title}</Text>
          <Text style={styles.noticeText}>{text}</Text>
        </View>
      </View>

      {buttonLabel && onPress ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Button title={buttonLabel} variant="secondary" onPress={onPress} />
        </View>
      ) : null}
    </View>
  );
}

function StatusPill({ status }: { status?: string | null }) {
  const meta = getStatusMeta(status);

  return (
    <View
      style={[
        styles.statusPill,
        {
          backgroundColor: meta.bg,
          borderColor: meta.border,
        },
      ]}
    >
      <Ionicons name={meta.icon} size={13} color={meta.color} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={styles.summaryTileValue}>{value}</Text>
    </View>
  );
}

function WithdrawalCard({ item }: { item: WithdrawalRequest }) {
  const statusMeta = getStatusMeta(item?.status);

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestCardTop}>
        <View style={styles.requestIconWrap}>
          <Ionicons name="cash-outline" size={18} color="#0A6E8A" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.requestTitle}>
            Community request • {formatSourceLabel((item as any)?.source)}
          </Text>
          <Text style={styles.requestMeta}>
            {(item as any)?.phone || "No phone added"}
          </Text>
        </View>

        <StatusPill status={(item as any)?.status} />
      </View>

      <View style={styles.requestAmountRow}>
        <Text style={styles.requestAmount}>{formatKes((item as any)?.amount)}</Text>
        <Text style={styles.requestDate}>
          {formatDateLabel((item as any)?.created_at)}
        </Text>
      </View>

      <View style={styles.requestFooter}>
        <Text style={styles.requestHelper}>{statusMeta.helper}</Text>
      </View>
    </View>
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

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, withdrawalsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyWithdrawals(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: WithdrawalsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setWithdrawals(
        withdrawalsRes.status === "fulfilled" && Array.isArray(withdrawalsRes.value)
          ? withdrawalsRes.value
          : []
      );

      if (meRes.status === "rejected") {
        setError(getApiErrorMessage(meRes.reason));
      }

      if (withdrawalsRes.status === "rejected") {
        setError(getApiErrorMessage(withdrawalsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
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

  const totalRequests = useMemo(() => withdrawals.length, [withdrawals]);

  const totalAmount = useMemo(() => {
    return withdrawals.reduce((sum, item) => {
      const n = Number((item as any)?.amount ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [withdrawals]);

  const pendingCount = useMemo(() => {
    return withdrawals.filter((item) =>
      ["PENDING", "PROCESSING", "UNDER_REVIEW"].includes(
        String((item as any)?.status || "").toUpperCase()
      )
    ).length;
  }, [withdrawals]);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.page}>
          <EmptyState
            title="You are not signed in"
            subtitle="Log in to continue"
            actionLabel="Log in"
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
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
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
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.hero}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />

          <View style={styles.heroTopRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.replace(ROUTES.tabs.payments as any)}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroBadge}>
              <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>Community wallet</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>My requests</Text>
          <Text style={styles.heroSubtitle}>
            See how your community wallet requests are moving.
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="Total requests"
              value={String(totalRequests)}
            />
            <SummaryTile
              label="In progress"
              value={String(pendingCount)}
            />
            <SummaryTile
              label="Amount"
              value={formatKes(totalAmount)}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color="#FFD7D7"
              />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <Button
            title="New Request"
            onPress={() => router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)}
            leftIcon={<Ionicons name="add-outline" size={18} color={WHITE} />}
          />
        </View>

        {!loading && withdrawals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              title="No requests yet"
              subtitle="When you send a request from your community wallet, it will appear here."
              actionLabel="Start Request"
              onAction={() => router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)}
            />
          </Card>
        ) : (
          <View style={styles.listWrap}>
            {withdrawals.map((item, index) => (
              <WithdrawalCard
                key={String((item as any)?.id ?? `${(item as any)?.created_at ?? "req"}-${index}`)}
                item={item}
              />
            ))}
          </View>
        )}
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

  hero: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(129, 244, 231, 0.15)",
    backgroundColor: "rgba(29, 196, 182, 0.22)",
    overflow: "hidden",
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -18,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
    color: WHITE,
  },

  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  heroSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
  },

  summaryRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  summaryTile: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  summaryTileLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  summaryTileValue: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  noticeCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  noticeGlow: {
    position: "absolute",
    right: -18,
    top: -12,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
    marginBottom: 2,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    backgroundColor: "rgba(239,68,68,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: WHITE,
  },

  actionsRow: {
    marginBottom: SPACING.md,
  },

  emptyCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  listWrap: {
    gap: SPACING.sm,
  },

  requestCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.08)",
    ...SHADOW.card,
  },

  requestCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  requestIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.86)",
  },

  requestTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  requestMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.bold,
  },

  requestAmountRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: SPACING.sm,
  },

  requestAmount: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
    color: WHITE,
  },

  requestDate: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_MUTED,
    textAlign: "right",
    flexShrink: 1,
  },

  requestFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },

  requestHelper: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: TEXT_ON_DARK_SOFT,
  },
});