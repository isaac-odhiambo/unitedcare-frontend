// app/(tabs)/payments/index.tsx

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
import { FONT, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getMyLedger,
  getMyWithdrawals,
  PaymentLedgerEntry,
  WithdrawalRequest,
} from "@/services/payments";
import {
  getMe,
  isAdminUser,
  MeResponse,
} from "@/services/profile";
import {
  getSessionUser,
  saveSessionUser,
  SessionUser,
} from "@/services/session";

type PaymentsUser = Partial<MeResponse> & Partial<SessionUser>;
type SpaceTone = "savings" | "merry" | "groups" | "support";
type NoticeTone = "primary" | "success" | "warning" | "info";

const PAGE_BG = "#062C49";
const WHITE = "#FFFFFF";
const TEXT_SOFT = "rgba(255,255,255,0.84)";
const TEXT_MUTED = "rgba(255,255,255,0.68)";
const GLASS = "rgba(255,255,255,0.08)";
const GLASS_BORDER = "rgba(255,255,255,0.10)";

function getSpaceTonePalette(tone: SpaceTone) {
  const map = {
    savings: {
      card: "rgba(29, 196, 182, 0.22)",
      border: "rgba(129, 244, 231, 0.15)",
      iconBg: "rgba(220, 255, 250, 0.75)",
      icon: "#0B6A80",
      chip: "rgba(255,255,255,0.14)",
    },
    merry: {
      card: "rgba(98, 192, 98, 0.23)",
      border: "rgba(194, 255, 188, 0.16)",
      iconBg: "rgba(236, 255, 235, 0.76)",
      icon: "#379B4A",
      chip: "rgba(255,255,255,0.14)",
    },
    groups: {
      card: "rgba(49, 180, 217, 0.22)",
      border: "rgba(189, 244, 255, 0.15)",
      iconBg: "rgba(236, 251, 255, 0.76)",
      icon: "#0A6E8A",
      chip: "rgba(255,255,255,0.14)",
    },
    support: {
      card: "rgba(52, 198, 191, 0.22)",
      border: "rgba(195, 255, 250, 0.16)",
      iconBg: "rgba(236, 255, 252, 0.76)",
      icon: "#148C84",
      chip: "rgba(255,255,255,0.14)",
    },
  };

  return map[tone];
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

function money(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDisplayName(user?: PaymentsUser | null) {
  if (!user) return "Member";
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function categoryLabel(category?: string) {
  const c = String(category || "").toUpperCase();
  if (c === "SAVINGS") return "Savings";
  if (c === "LOANS") return "Support";
  if (c === "MERRY") return "Merry";
  if (c === "GROUP") return "Group";
  if (c === "WITHDRAWAL") return "Request";
  if (c === "WITHDRAWAL_FEE") return "Service fee";
  if (c === "TRANSACTION_FEE") return "Service fee";
  return c || "Activity";
}

function statusBadgeColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (["PAID", "SUCCESS", "APPROVED", "COMPLETED"].includes(s)) return "#41A357";
  if (["FAILED", "REJECTED", "CANCELLED", "DEFAULTED", "BLOCKED"].includes(s))
    return "#EF4444";
  if (["PROCESSING", "PENDING", "UNDER_REVIEW", "INITIATED", "TIMEOUT"].includes(s))
    return "#F59E0B";
  return "#94A3B8";
}

function NoticeBanner({
  tone,
  icon,
  title,
  text,
  actionLabel,
  onPress,
}: {
  tone: NoticeTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const palette = getOverviewTonePalette(tone);

  return (
    <View style={styles.noticeCard}>
      <View style={[styles.noticeGlow, { backgroundColor: palette.soft }]} />
      <View style={styles.noticeRow}>
        <View style={[styles.noticeIconWrap, { backgroundColor: palette.iconBg }]}>
          <Ionicons name={icon} size={18} color={palette.icon} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.noticeTitle}>{title}</Text>
          <Text style={styles.noticeText}>{text}</Text>
        </View>
      </View>

      {actionLabel && onPress ? (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onPress}
          style={[
            styles.noticeButton,
            {
              backgroundColor: palette.buttonBg,
              borderColor: palette.buttonBorder,
            },
          ]}
        >
          <Text
            style={[
              styles.noticeButtonText,
              { color: palette.buttonBg === "#FFFFFF" ? "#0C6A80" : "#FFFFFF" },
            ]}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  tone,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SpaceTone;
  onPress: () => void;
}) {
  const palette = getSpaceTonePalette(tone);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.actionCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: palette.iconBg }]}>
        <Ionicons name={icon} size={18} color={palette.icon} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

function StatusPill({ label }: { label: string }) {
  const color = statusBadgeColor(label);

  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: `${color}18`, borderColor: `${color}30` },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

function SmallSectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.smallHeader}>
      <Text style={styles.smallHeaderTitle}>{title}</Text>
      {actionLabel && onPress ? (
        <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
          <Text style={styles.smallHeaderAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function PaymentsIndexScreen() {
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    deposited?: string;
    amount?: string;
    phone?: string;
    notice?: string;
    requested?: string;
  }>();

  const [user, setUser] = useState<PaymentsUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ledger, setLedger] = useState<PaymentLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);

  const successNotice = useMemo(() => {
    if (params.deposited === "1") {
      return params.notice || `Your contribution of ${money(params.amount)} has started.`;
    }
    if (params.requested === "1") {
      return params.notice || "Your request has been received.";
    }
    return "";
  }, [params.amount, params.deposited, params.notice, params.requested]);

  const clearPaymentParams = useCallback(() => {
    if (
      params.deposited ||
      params.notice ||
      params.amount ||
      params.phone ||
      params.requested
    ) {
      router.replace(ROUTES.tabs.payments as any);
    }
  }, [params.amount, params.deposited, params.notice, params.phone, params.requested]);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, ledgerRes, wdRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyLedger(),
        getMyWithdrawals(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser =
        meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: PaymentsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (mergedUser) {
        await saveSessionUser(mergedUser);
      }

      if (!mergedUser) {
        setLedger([]);
        setWithdrawals([]);
        return;
      }

      setLedger(
        ledgerRes.status === "fulfilled" && Array.isArray(ledgerRes.value)
          ? ledgerRes.value
          : []
      );

      setWithdrawals(
        wdRes.status === "fulfilled" && Array.isArray(wdRes.value)
          ? wdRes.value
          : []
      );

      let nextError = "";
      if (ledgerRes.status === "rejected") {
        nextError = getApiErrorMessage(ledgerRes.reason);
      } else if (wdRes.status === "rejected") {
        nextError = getApiErrorMessage(wdRes.reason);
      }

      setError(nextError);
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

  const overview = useMemo(() => {
    const lastTxn = ledger?.[0];

    const pendingWds = (withdrawals ?? []).filter((w) =>
      ["PENDING", "UNDER_REVIEW"].includes(String(w.status).toUpperCase())
    );

    const processingWds = (withdrawals ?? []).filter((w) =>
      ["APPROVED", "PROCESSING"].includes(String(w.status).toUpperCase())
    );

    const credits = (ledger ?? []).filter(
      (row) => String(row.entry_type).toUpperCase() === "CREDIT"
    );

    const debits = (ledger ?? []).filter(
      (row) => String(row.entry_type).toUpperCase() === "DEBIT"
    );

    const totalIn = credits.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalOut = debits.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const lastLabel = lastTxn
      ? `${categoryLabel(lastTxn.category)} • ${money(lastTxn.amount)}`
      : "No activity yet";

    return {
      lastLabel,
      pendingCount: pendingWds.length,
      processingCount: processingWds.length,
      totalIn: money(totalIn),
      totalOut: money(totalOut),
    };
  }, [ledger, withdrawals]);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>
            Please log in to continue.
          </Text>
          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.emptyButton}
            onPress={() => router.replace(ROUTES.auth.login as any)}
          >
            <Text style={styles.emptyButtonText}>Go to Login</Text>
          </TouchableOpacity>
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
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />

        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: getSpaceTonePalette("support").card,
              borderColor: getSpaceTonePalette("support").border,
            },
          ]}
        >
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />

          <Text style={styles.heroTag}>COMMUNITY SPACE</Text>
          <Text style={styles.heroTitle}>{formatDisplayName(user)}</Text>
          <Text style={styles.heroCaption}>
            {isAdmin
              ? "Support members, follow shared activity, and keep the community moving together."
              : "Stay connected with your contributions, shared activity, and requests in one place."}
          </Text>

          <View style={styles.statsRow}>
            <MiniStat label="Added" value={overview.totalIn} />
            <MiniStat
              label="Waiting"
              value={String(overview.pendingCount + overview.processingCount)}
            />
          </View>
        </View>

        {successNotice ? (
          <NoticeBanner
            tone="success"
            icon="checkmark-circle-outline"
            title="Update received"
            text={successNotice}
            actionLabel="Dismiss"
            onPress={clearPaymentParams}
          />
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SmallSectionHeader title="Community actions" />
        <View style={styles.actionsWrap}>
          <ActionCard
            title="Add contribution"
            subtitle="Support your community space"
            icon="arrow-down-circle-outline"
            tone="savings"
            onPress={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
          />

          <ActionCard
            title="Send request"
            subtitle="Share a new community request"
            icon="paper-plane-outline"
            tone="support"
            onPress={() =>
              router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
            }
          />

          <ActionCard
            title="View activity"
            subtitle="See your shared updates"
            icon="list-outline"
            tone="groups"
            onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
          />

          <ActionCard
            title="View requests"
            subtitle="Follow your recent requests"
            icon="people-outline"
            tone="merry"
            onPress={() =>
              router.push(ROUTES.tabs.paymentsWithdrawals as any)
            }
          />
        </View>

        <SmallSectionHeader
          title="Recent activity"
          actionLabel="View all"
          onPress={() => router.push(ROUTES.tabs.paymentsLedger as any)}
        />
        {!loading && ledger?.length ? (
          <View style={styles.previewCard}>
            {ledger.slice(0, 2).map((row) => {
              const isCredit = String(row.entry_type).toUpperCase() === "CREDIT";
              const amountColor = isCredit ? "#8CF0C7" : "#FFD0D0";

              return (
                <View key={row.id} style={styles.previewRow}>
                  <View style={styles.previewLeft}>
                    <View style={styles.previewIconWrap}>
                      <Ionicons name="wallet-outline" size={16} color="#0A6E8A" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.previewTitle} numberOfLines={1}>
                        {row.narration || categoryLabel(row.category)}
                      </Text>
                      <Text style={styles.previewMeta} numberOfLines={1}>
                        {categoryLabel(row.category)}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.previewAmount, { color: amountColor }]}>
                    {isCredit ? "+" : "-"} {money(row.amount)}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <EmptyState
              title="No activity yet"
              subtitle="Your shared activity will appear here."
              actionLabel="Add contribution"
              onAction={() => router.push(ROUTES.tabs.paymentsDeposit as any)}
            />
          </View>
        )}

        <SmallSectionHeader
          title="Recent requests"
          actionLabel="View all"
          onPress={() =>
            router.push(ROUTES.tabs.paymentsWithdrawals as any)
          }
        />
        {!loading && withdrawals?.length ? (
          <View style={styles.previewCard}>
            {withdrawals.slice(0, 2).map((w) => (
              <View key={w.id} style={styles.previewRow}>
                <View style={styles.previewLeft}>
                  <View style={[styles.previewIconWrap, styles.previewIconWrapAlt]}>
                    <Ionicons name="people-outline" size={16} color="#148C84" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle} numberOfLines={1}>
                      Community request • {w.source}
                    </Text>
                    <Text style={styles.previewMeta} numberOfLines={1}>
                      {w.phone}
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text style={styles.previewAmountWhite}>{money(w.amount)}</Text>
                  <StatusPill label={String(w.status)} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <EmptyState
              title="No requests yet"
              subtitle="Your community requests will appear here."
              actionLabel="Send request"
              onAction={() =>
                router.push(ROUTES.tabs.paymentsRequestWithdrawal as any)
              }
            />
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: PAGE_BG,
  },

  emptyTitle: {
    color: WHITE,
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  emptySubtitle: {
    color: TEXT_MUTED,
    marginTop: 8,
    textAlign: "center",
    fontFamily: FONT.regular,
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: "#0C6A80",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: WHITE,
    fontFamily: FONT.bold,
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
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 120,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 22,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },

  heroOrbOne: {
    position: "absolute",
    top: -40,
    right: -10,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroOrbTwo: {
    position: "absolute",
    bottom: -24,
    left: -12,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroTag: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: FONT.bold,
  },

  heroTitle: {
    marginTop: 10,
    color: WHITE,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: FONT.bold,
  },

  heroCaption: {
    marginTop: 10,
    color: TEXT_SOFT,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  statsRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  miniStat: {
    flex: 1,
    minHeight: 70,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  miniStatLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  miniStatValue: {
    marginTop: 8,
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  noticeCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  noticeGlow: {
    position: "absolute",
    right: -16,
    top: -14,
    width: 90,
    height: 90,
    borderRadius: 999,
  },

  noticeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  noticeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  noticeTitle: {
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  noticeText: {
    marginTop: 4,
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  noticeButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
  },

  noticeButtonText: {
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  errorCard: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: SPACING.md,
  },

  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  errorText: {
    flex: 1,
    color: WHITE,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  smallHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },

  smallHeaderTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  smallHeaderAction: {
    color: "#8CF0C7",
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  actionsWrap: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  actionCard: {
    minHeight: 84,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  actionTitle: {
    color: WHITE,
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  actionSubtitle: {
    marginTop: 4,
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  previewCard: {
    backgroundColor: GLASS,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  previewLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  previewIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.90)",
  },

  previewIconWrapAlt: {
    backgroundColor: "rgba(236, 255, 252, 0.86)",
  },

  previewTitle: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.semiBold,
  },

  previewMeta: {
    marginTop: 6,
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  previewAmount: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
  },

  previewAmountWhite: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.semiBold,
  },

  statusPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontFamily: FONT.bold,
    textTransform: "capitalize",
  },

  emptyCard: {
    marginBottom: SPACING.md,
  },
});