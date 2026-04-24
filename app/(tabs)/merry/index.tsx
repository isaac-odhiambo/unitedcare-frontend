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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  AvailableMerryRow,
  fmtKES,
  getApiErrorMessage,
  getAvailableMerries,
  getMyAllMerryDueSummary,
  MerryDueSummaryItem,
  MyAllMerryDueSummaryResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.08)";
const SOFT_WHITE_2 = "rgba(255,255,255,0.12)";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const ACCENT_BG = "rgba(12,106,128,0.22)";
const ACCENT_TEXT = "#D9F3F9";

function moneyNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function hasAmount(value?: string | number | null) {
  return moneyNumber(value) > 0;
}

function getFrequencyLabel(item: AvailableMerryRow) {
  const freq = String(item.payout_frequency || "").toUpperCase();

  if (freq === "DAILY") return "Daily";
  if (freq === "MONTHLY") return "Monthly";
  return "Weekly";
}

function getJoinStatusText(item: AvailableMerryRow) {
  const status = String(item.my_join_request?.status || "").toUpperCase();

  if (item.is_member) return "Joined";
  if (status === "PENDING") return "Pending";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (!item.is_open) return "Closed";
  if (item.available_seats !== null && Number(item.available_seats) <= 0) {
    return "Full";
  }
  if (item.can_request_join) return "Open";
  return "View";
}

function getSeatSummary(item: MerryDueSummaryItem) {
  const count = Number(item.seat_count ?? 0);
  const numbers = Array.isArray(item.seat_numbers) ? item.seat_numbers : [];

  if (numbers.length > 0) {
    return `${count} seat${count === 1 ? "" : "s"} • ${numbers.join(", ")}`;
  }

  return `${count} seat${count === 1 ? "" : "s"}`;
}

function formatShortDueDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function MyMerryCard({
  item,
  onContribute,
  onOpenDetail,
}: {
  item: MerryDueSummaryItem;
  onContribute: (item: MerryDueSummaryItem) => void;
  onOpenDetail: (item: MerryDueSummaryItem) => void;
}) {
  const overdueTotal = moneyNumber(item.overdue_total);
  const currentTotal = moneyNumber(item.current_total);
  const totalDueNow = moneyNumber(item.total_due_now);
  const walletBalance = moneyNumber(item.wallet_balance);
  const remainingAfterWallet = Math.max(0, totalDueNow - walletBalance);
  const fullyCoveredByWallet = totalDueNow > 0 && walletBalance >= totalDueNow;
  const partiallyCoveredByWallet =
    walletBalance > 0 && totalDueNow > walletBalance;

  const breakdownRows = Array.isArray(item.breakdown) ? item.breakdown : [];

  const overdueRows = breakdownRows.filter((row) => {
    const bucket = String((row as any)?.bucket || "").toLowerCase();
    const status = String((row as any)?.status || "").toUpperCase();
    const outstanding = moneyNumber((row as any)?.outstanding);

    if (outstanding <= 0) return false;
    return bucket === "overdue" || status === "OVERDUE";
  });

  const overdueCount = overdueRows.length;

  const maxDaysOverdue = overdueRows.reduce((max, row) => {
    const days = Number((row as any)?.days_overdue || 0);
    return days > max ? days : max;
  }, 0);

  const hasPenalty = breakdownRows.some(
    (row) => moneyNumber((row as any)?.penalty_amount) > 0
  );

  const showOverdueState = overdueTotal > 0 && !fullyCoveredByWallet;
  const nextAmount = moneyNumber(item.next_total);

  const badgeLabel = fullyCoveredByWallet
    ? "Covered"
    : showOverdueState
      ? "Pending"
      : currentTotal > 0
        ? "Pay now"
        : "Up to date";

  const badgeStyle = fullyCoveredByWallet
    ? styles.badgeSuccess
    : showOverdueState
      ? styles.badgeWarning
      : currentTotal > 0
        ? styles.badgeAccent
        : styles.badgeSuccess;

  const badgeTextStyle = fullyCoveredByWallet
    ? styles.badgeTextSuccess
    : showOverdueState
      ? styles.badgeTextWarning
      : currentTotal > 0
        ? styles.badgeTextAccent
        : styles.badgeTextSuccess;

  const primaryTitle = remainingAfterWallet > 0 ? "Pay now" : "View details";

  const onPrimaryPress = () => {
    if (remainingAfterWallet > 0) {
      onContribute(item);
      return;
    }
    onOpenDetail(item);
  };

  let panelLabel = "";
  let panelValue = "";

  if (remainingAfterWallet > 0) {
    panelLabel = "You need to contribute";
    panelValue = fmtKES(remainingAfterWallet);
  } else if (fullyCoveredByWallet) {
    panelLabel = "You're covered";
    panelValue = "Wallet will handle it";
  } else if (item.next_due_date) {
    panelLabel = "Next contribution";
    panelValue = formatShortDueDate(item.next_due_date);
  } else if (nextAmount > 0) {
    panelLabel = "Next contribution";
    panelValue = fmtKES(item.next_total);
  } else {
    panelLabel = "You're all good";
    panelValue = "No action needed";
  }

  return (
    <Card style={styles.merryCard} variant="default">
      <View style={styles.cardTop}>
        <View style={styles.cardTitleWrap}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="people-outline" size={17} color="#379B4A" />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.merry_name}
            </Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>
              {getSeatSummary(item)}
            </Text>
          </View>
        </View>

        <View style={[styles.badgeBase, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]} numberOfLines={1}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.amountPanel}>
        <Text style={styles.amountPanelLabel}>{panelLabel}</Text>
        <Text
          style={styles.amountPanelValue}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {panelValue}
        </Text>
      </View>

      {walletBalance > 0 ? (
        <View style={styles.walletRow}>
          <Ionicons name="wallet-outline" size={14} color={ACCENT_TEXT} />
          <Text style={styles.walletText}>
            Wallet balance: {fmtKES(item.wallet_balance)}
          </Text>
        </View>
      ) : null}

      {remainingAfterWallet > 0 ? (
        <Text style={styles.helperTextStrong}>
          You have something pending to contribute.
        </Text>
      ) : null}

      {showOverdueState ? (
        <Text style={styles.helperText}>
          {overdueCount} missed contribution
          {overdueCount === 1 ? "" : "s"}
          {maxDaysOverdue > 0
            ? ` • ${maxDaysOverdue} day${maxDaysOverdue === 1 ? "" : "s"} late`
            : ""}
        </Text>
      ) : null}

      {partiallyCoveredByWallet && remainingAfterWallet > 0 ? (
        <Text style={styles.helperText}>
          Wallet has already reduced what you need to pay.
        </Text>
      ) : null}

      {hasPenalty && remainingAfterWallet > 0 ? (
        <Text style={[styles.helperText, { color: WARNING_TEXT }]}>
          This amount includes any late charges.
        </Text>
      ) : null}

      {!hasAmount(item.total_due_now) && hasAmount(item.next_total) ? (
        <Text style={styles.helperText}>
          Next contribution
          {item.next_due_date
            ? ` on ${formatShortDueDate(item.next_due_date)}`
            : ""}{" "}
          • {fmtKES(item.next_total)}
        </Text>
      ) : null}

      {!hasAmount(item.total_due_now) && !hasAmount(item.next_total) ? (
        <Text style={styles.helperText}>You are all caught up.</Text>
      ) : null}

      <View style={styles.cardActions}>
        <Button title={primaryTitle} onPress={onPrimaryPress} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

function AvailableMerryCard({ item }: { item: AvailableMerryRow }) {
  const joinStatus = getJoinStatusText(item);
  const requestStatus = String(item.my_join_request?.status || "").toUpperCase();

  const canJoinDirect =
    !item.is_member &&
    item.can_request_join &&
    item.is_open !== false &&
    (item.available_seats == null || Number(item.available_seats) > 0) &&
    requestStatus !== "PENDING" &&
    requestStatus !== "APPROVED";

  const onPrimaryPress = () => {
    if (canJoinDirect) {
      router.push({
        pathname: "/(tabs)/merry/join-request" as any,
        params: {
          merryId: String(item.id),
          returnTo: ROUTES.tabs.merry,
          backLabel: "Back to Merry",
          landingTitle: "Merry",
        },
      });
      return;
    }

    router.push({
      pathname: "/(tabs)/merry/[id]" as any,
      params: {
        id: String(item.id),
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  };

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPrimaryPress}>
      <Card style={styles.availableCard} variant="default">
        <View style={styles.cardTop}>
          <View style={styles.cardTitleWrap}>
            <View style={styles.cardIconWrap}>
              <Ionicons name="sparkles-outline" size={17} color="#379B4A" />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={2}>
                {getFrequencyLabel(item)} • {item.seats_count} seat
                {Number(item.seats_count) === 1 ? "" : "s"}
              </Text>
            </View>
          </View>

          <View style={styles.amountBadge}>
            <Text style={styles.amountBadgeText} numberOfLines={1}>
              {fmtKES(item.contribution_amount)}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPillNeutral}>
            <Text style={styles.metaPillText} numberOfLines={1}>
              {item.available_seats == null
                ? "Unlimited seats"
                : `${item.available_seats} left`}
            </Text>
          </View>

          <View style={styles.metaPillAccent}>
            <Text style={styles.metaPillText} numberOfLines={1}>
              {joinStatus}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function MerryIndexScreen() {
  const insets = useSafeAreaInsets();

  const [user, setUser] = useState<MerryUser | null>(null);
  const [summary, setSummary] =
    useState<MyAllMerryDueSummaryResponse | null>(null);
  const [availableMerries, setAvailableMerries] = useState<AvailableMerryRow[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, summaryRes, availableRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMyAllMerryDueSummary(),
          getAvailableMerries(),
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

      setSummary(summaryRes.status === "fulfilled" ? summaryRes.value : null);
      setAvailableMerries(
        availableRes.status === "fulfilled" ? (availableRes.value ?? []) : []
      );

      const errors: string[] = [];

      if (summaryRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(summaryRes.reason) ||
            getErrorMessage(summaryRes.reason)
        );
      }

      if (availableRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(availableRes.reason) ||
            getErrorMessage(availableRes.reason)
        );
      }

      setError(errors.filter(Boolean).join(" • "));
    } catch (e: any) {
      setSummary(null);
      setAvailableMerries([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, []);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const myGroupsPreview = useMemo<MerryDueSummaryItem[]>(
    () => (Array.isArray(summary?.items) ? summary.items : []),
    [summary]
  );

  const availablePreview = useMemo<AvailableMerryRow[]>(
    () => (Array.isArray(availableMerries) ? availableMerries : []),
    [availableMerries]
  );

  const totalRequiredNow = useMemo(
    () => moneyNumber(summary?.total_due_now),
    [summary]
  );

  const totalWalletBalance = useMemo(() => {
    return moneyNumber(summary?.wallet_balance);
  }, [summary]);

  const remainingAfterWallet = useMemo(() => {
    return Math.max(0, totalRequiredNow - totalWalletBalance);
  }, [totalRequiredNow, totalWalletBalance]);

  const onPayAllMerryNow = useCallback(() => {
    if (!user?.id) return;

    if (remainingAfterWallet > 0) {
      router.push({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          amount: String(remainingAfterWallet),
          purpose: "MERRY_CONTRIBUTION",
          reference: `mus${user.id}`,
          title: "Pay merry due",
          subtitle: "Combined merry contribution",
          source: "merry_index_total",
          scope: "all",
          returnTo: ROUTES.tabs.merry,
          backLabel: "Back to Merry",
          landingTitle: "Merry",
        },
      });
      return;
    }

    router.push({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        amount: "",
        purpose: "MERRY_CONTRIBUTION",
        reference: `mus${user.id}`,
        title: "Contribute to merry",
        subtitle: "You can still contribute for later",
        source: "merry_index_total",
        scope: "extra",
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, [user?.id, remainingAfterWallet]);

  const onContribute = useCallback(
    (item: MerryDueSummaryItem) => {
      const amount = Math.max(
        0,
        moneyNumber(item.total_due_now) - moneyNumber(item.wallet_balance)
      );

      router.push({
        pathname: "/(tabs)/payments/deposit" as any,
        params: {
          amount: amount > 0 ? String(amount) : "",
          purpose: "MERRY_CONTRIBUTION",
          reference: user?.id ? `mus${user.id}` : "",
          merryId: String(item.merry_id),
          title: amount > 0 ? "Pay this merry" : "Contribute to merry",
          subtitle: item.merry_name || "Merry contribution",
          source: "merry_index_single",
          scope: amount > 0 ? "single" : "extra",
          returnTo: ROUTES.tabs.merry,
          backLabel: "Back to Merry",
          landingTitle: "Merry",
        },
      });
    },
    [user?.id]
  );

  const openMerryDetail = useCallback((item: MerryDueSummaryItem) => {
    router.push({
      pathname: "/(tabs)/merry/[id]" as any,
      params: {
        id: String(item.merry_id),
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
      },
    });
  }, []);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Not signed in</Text>
          <Text style={styles.emptySubtitle}>Please log in to continue.</Text>
          <TouchableOpacity
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
    <SafeAreaView style={styles.page} edges={["top"]}>
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
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                MERRY <Text style={styles.brandWordmarkGreen}>CIRCLE</Text>
              </Text>
              <Text style={styles.brandSub}>Simple and clear</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.heroShell}>
          <Text style={styles.heroEyebrow}>Your contribution</Text>
          <Text style={styles.heroAmount}>
            {remainingAfterWallet > 0 ? fmtKES(remainingAfterWallet) : "All set"}
          </Text>

          {remainingAfterWallet > 0 ? (
            <Text style={styles.heroSubText}>
              You have pending contributions.
            </Text>
          ) : totalWalletBalance > 0 ? (
            <Text style={styles.heroSubText}>
              Your wallet will handle what is due.
            </Text>
          ) : (
            <Text style={styles.heroSubText}>
              You can still contribute for later.
            </Text>
          )}

          {totalWalletBalance > 0 ? (
            <View style={styles.heroWalletRow}>
              <Ionicons name="wallet-outline" size={15} color={ACCENT_TEXT} />
              <Text style={styles.heroWalletText}>
                Wallet balance: {fmtKES(totalWalletBalance)}
              </Text>
            </View>
          ) : null}

          <Button
            title={remainingAfterWallet > 0 ? "Pay total now" : "Contribute now"}
            onPress={onPayAllMerryNow}
            style={styles.heroButton}
          />
        </View>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger || "#DC2626"}
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {availablePreview.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Available merry groups</Text>
            <View style={styles.cardList}>
              {availablePreview.map((item) => (
                <AvailableMerryCard key={`available-${item.id}`} item={item} />
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>My merry groups</Text>

        {!loading && myGroupsPreview.length === 0 ? (
          <View style={styles.emptyCardWrap}>
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="people-outline"
                title="No merry groups yet"
                subtitle="When you join a merry, it will appear here."
              />
            </Card>
          </View>
        ) : (
          <View style={styles.cardList}>
            {myGroupsPreview.map((item) => (
              <MyMerryCard
                key={`due-${item.merry_id}`}
                item={item}
                onContribute={onContribute}
                onOpenDetail={openMerryDetail}
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xl,
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
    color: TEXT_ON_DARK_SOFT,
    marginTop: 8,
    textAlign: "center",
    fontFamily: FONT.regular,
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: BRAND,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: WHITE,
    fontFamily: FONT.bold,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  brandWordmark: {
    color: WHITE,
    fontSize: 17,
    fontFamily: FONT.bold,
    letterSpacing: 0.7,
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
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroShell: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroEyebrow: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 13,
    fontFamily: FONT.medium,
    marginBottom: 8,
  },

  heroAmount: {
    color: WHITE,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FONT.bold,
  },

  heroSubText: {
    color: TEXT_ON_DARK,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.medium,
    marginTop: 8,
  },

  heroWalletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.18)",
  },

  heroWalletText: {
    color: ACCENT_TEXT,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
  },

  heroButton: {
    marginTop: SPACING.md,
  },

  sectionTitle: {
    color: WHITE,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.bold,
    marginBottom: SPACING.md,
  },

  cardList: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  merryCard: {
    backgroundColor: SOFT_WHITE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...SHADOW.card,
  },

  availableCard: {
    backgroundColor: SOFT_WHITE,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...SHADOW.card,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flex: 1,
  },

  cardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,255,235,0.78)",
  },

  cardTitle: {
    color: WHITE,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT.bold,
  },

  cardSubtitle: {
    marginTop: 4,
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT.regular,
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT.medium,
  },

  badgeWarning: {
    backgroundColor: WARNING_BG,
  },

  badgeSuccess: {
    backgroundColor: SUCCESS_BG,
  },

  badgeAccent: {
    backgroundColor: ACCENT_BG,
  },

  badgeTextWarning: {
    color: WARNING_TEXT,
  },

  badgeTextSuccess: {
    color: SUCCESS_TEXT,
  },

  badgeTextAccent: {
    color: ACCENT_TEXT,
  },

  amountPanel: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: SOFT_WHITE_2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  amountPanelLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
  },

  amountPanelValue: {
    marginTop: 6,
    color: WHITE,
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FONT.bold,
  },

  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.sm,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.18)",
  },

  walletText: {
    color: ACCENT_TEXT,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.medium,
  },

  helperText: {
    marginTop: SPACING.sm,
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  helperTextStrong: {
    marginTop: SPACING.sm,
    color: WHITE,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.bold,
  },

  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  amountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.round,
    backgroundColor: SOFT_WHITE_2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  amountBadgeText: {
    color: WHITE,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: FONT.medium,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  metaPillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  metaPillAccent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.18)",
  },

  metaPillText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: FONT.medium,
    color: WHITE,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
    backgroundColor: "#FFF1F2",
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.danger || "#DC2626",
  },

  emptyCardWrap: {
    marginBottom: SPACING.lg,
  },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
});