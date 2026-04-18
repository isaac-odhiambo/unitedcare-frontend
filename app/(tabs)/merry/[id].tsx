import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { FONT, SHADOW, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";
import {
  fmtKES,
  getApiErrorMessage,
  getMerryDetail,
  getMerryMemberDashboard,
  getNextPayoutTurn,
  getPayoutReadiness,
  MerryDetail,
  MerryMemberDashboardResponse,
  NextPayoutTurnResponse,
  PayoutReadinessResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

type BreakdownRow = {
  due_id?: number;
  payout_id?: number | null;
  turn_no?: number | null;
  cycle_no?: number | null;
  seat_no?: number;
  period_key?: string;
  due_date?: string | null;
  status?: string;
  base_amount?: string | number;
  penalty_amount?: string | number;
  due_amount?: string | number;
  paid_amount?: string | number;
  outstanding?: string | number;
  days_overdue?: number;
  bucket?: string;
};

type ReadinessRow = {
  due_id?: number;
  payout_id?: number | null;
  turn_no?: number | null;
  seat_id?: number;
  seat_no?: number;
  member_id?: number;
  user_id?: number;
  username?: string | null;
  phone?: string | null;
  base_amount?: string | number;
  penalty_amount?: string | number;
  due_amount?: string | number;
  paid_amount?: string | number;
  outstanding?: string | number;
  status?: string;
  due_date?: string | null;
  days_overdue?: number;
};

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const PRIMARY_BTN = "#197D71";
const WHITE = "#FFFFFF";
const TEXT_SOFT = "rgba(255,255,255,0.74)";
const TEXT_FAINT = "rgba(255,255,255,0.62)";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BG_2 = "rgba(255,255,255,0.06)";
const CARD_BORDER = "rgba(255,255,255,0.09)";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const DANGER_BG = "rgba(239,68,68,0.16)";
const DANGER_TEXT = "#FECACA";
const INFO_BG = "rgba(12,106,128,0.18)";
const INFO_TEXT = "#D7F7FF";

function toBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
  }
  return fallback;
}

function moneyNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
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

function getIsAdmin(user?: MerryUser | null) {
  if (!user) return false;

  const role = String((user as any)?.role || "").toLowerCase();

  return (
    toBool((user as any)?.is_admin) ||
    toBool((user as any)?.is_staff) ||
    toBool((user as any)?.is_superuser) ||
    role === "admin" ||
    role === "super_admin" ||
    role === "superadmin"
  );
}

function getStatusColors(status?: string | null) {
  const s = String(status || "").toUpperCase();

  if (s === "PAID") {
    return { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Paid" };
  }

  if (s === "PARTIAL") {
    return { bg: INFO_BG, text: INFO_TEXT, label: "Partial" };
  }

  if (s === "OVERDUE") {
    return { bg: DANGER_BG, text: DANGER_TEXT, label: "Overdue" };
  }

  return {
    bg: WARNING_BG,
    text: WARNING_TEXT,
    label: s || "Pending",
  };
}

function SummaryStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryStat}>
      <View style={styles.summaryStatIcon}>
        <Ionicons name={icon} size={16} color={BRAND} />
      </View>
      <Text style={styles.summaryStatLabel}>{label}</Text>
      <Text style={styles.summaryStatValue}>{value}</Text>
    </View>
  );
}

function InfoPill({
  text,
  success = false,
  danger = false,
}: {
  text: string;
  success?: boolean;
  danger?: boolean;
}) {
  const backgroundColor = success
    ? SUCCESS_BG
    : danger
      ? DANGER_BG
      : WARNING_BG;

  const color = success ? SUCCESS_TEXT : danger ? DANGER_TEXT : WARNING_TEXT;

  return (
    <View style={[styles.infoPill, { backgroundColor }]}>
      <Text style={[styles.infoPillText, { color }]}>{text}</Text>
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.actionBtn,
        isPrimary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        disabled ? styles.actionBtnDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.actionBtnText,
          isPrimary ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
          disabled ? styles.actionBtnTextDisabled : null,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function BreakdownCard({ row }: { row: BreakdownRow }) {
  const colors = getStatusColors(row.status);
  const seatNo = row.seat_no ?? "—";
  const outstanding = moneyNumber(row.outstanding);
  const penalty = moneyNumber(row.penalty_amount);
  const baseAmount = moneyNumber(row.base_amount);
  const paidAmount = moneyNumber(row.paid_amount);
  const daysLate = Number(row.days_overdue ?? 0);
  const dueDateLabel = row.due_date ? formatShortDueDate(String(row.due_date)) : "";

  return (
    <View style={styles.breakdownCard}>
      <View style={styles.breakdownTop}>
        <Text style={styles.breakdownSeat}>Seat {seatNo}</Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusBadgeText, { color: colors.text }]}>
            {colors.label}
          </Text>
        </View>
      </View>

      <Text style={styles.breakdownMeta}>
        Turn {row.turn_no ?? "—"} • Cycle {row.cycle_no ?? "—"}
      </Text>

      {row.due_date ? (
        <Text style={styles.breakdownMeta}>
          Due date: {dueDateLabel || String(row.due_date)}
          {daysLate > 0 ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"} overdue` : ""}
        </Text>
      ) : null}

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Base</Text>
        <Text style={styles.breakdownMoneyValue}>{fmtKES(baseAmount)}</Text>
      </View>

      {penalty > 0 ? (
        <View style={styles.breakdownMoneyRow}>
          <Text style={styles.breakdownMoneyLabel}>
            Penalty{daysLate > 0 ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"}` : ""}
          </Text>
          <Text style={[styles.breakdownMoneyValue, { color: WARNING_TEXT }]}>
            {fmtKES(penalty)}
          </Text>
        </View>
      ) : null}

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Paid</Text>
        <Text style={styles.breakdownMoneyValue}>{fmtKES(paidAmount)}</Text>
      </View>

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Remaining</Text>
        <Text style={[styles.breakdownMoneyValue, { color: WHITE }]}>
          {fmtKES(outstanding)}
        </Text>
      </View>
    </View>
  );
}

function AdminRowCard({ row }: { row: ReadinessRow }) {
  const colors = getStatusColors(row.status);
  const outstanding = moneyNumber(row.outstanding);
  const penalty = moneyNumber(row.penalty_amount);
  const paidAmount = moneyNumber(row.paid_amount);
  const daysLate = Number(row.days_overdue ?? 0);
  const dueDateLabel = row.due_date ? formatShortDueDate(String(row.due_date)) : "";

  return (
    <View style={styles.breakdownCard}>
      <View style={styles.breakdownTop}>
        <Text style={styles.breakdownSeat}>
          {row.username || "Member"} • Seat {row.seat_no ?? "—"}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.statusBadgeText, { color: colors.text }]}>
            {colors.label}
          </Text>
        </View>
      </View>

      <Text style={styles.breakdownMeta}>
        Turn {row.turn_no ?? "—"}
        {row.phone ? ` • ${row.phone}` : ""}
      </Text>

      {row.due_date ? (
        <Text style={styles.breakdownMeta}>
          Due date: {dueDateLabel || String(row.due_date)}
          {daysLate > 0 ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"} overdue` : ""}
        </Text>
      ) : null}

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Paid</Text>
        <Text style={styles.breakdownMoneyValue}>{fmtKES(paidAmount)}</Text>
      </View>

      {penalty > 0 ? (
        <View style={styles.breakdownMoneyRow}>
          <Text style={styles.breakdownMoneyLabel}>
            Penalty
            {daysLate > 0 ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"}` : ""}
          </Text>
          <Text style={[styles.breakdownMoneyValue, { color: WARNING_TEXT }]}>
            {fmtKES(penalty)}
          </Text>
        </View>
      ) : null}

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Outstanding</Text>
        <Text style={[styles.breakdownMoneyValue, { color: WHITE }]}>
          {fmtKES(outstanding)}
        </Text>
      </View>
    </View>
  );
}

export default function MerryDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    returnTo?: string;
  }>();
  const merryId = Number(params.id);

  const backToMerryIndex = useCallback(() => {
    const target =
      typeof params.returnTo === "string" && params.returnTo.trim()
        ? params.returnTo
        : ROUTES.tabs.merry;

    router.replace(target as any);
  }, [params.returnTo]);

  const [user, setUser] = useState<MerryUser | null>(null);
  const [detail, setDetail] = useState<MerryDetail | null>(null);
  const [dashboard, setDashboard] =
    useState<MerryMemberDashboardResponse | null>(null);
  const [nextTurn, setNextTurn] = useState<NextPayoutTurnResponse | null>(null);
  const [readiness, setReadiness] = useState<PayoutReadinessResponse | null>(
    null
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingNextPayout, setCreatingNextPayout] = useState(false);

  const [error, setError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [payoutMetaError, setPayoutMetaError] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAdminBreakdown, setShowAdminBreakdown] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!merryId || Number.isNaN(merryId)) return;

    try {
      setDashboardError("");
      const res = await getMerryMemberDashboard(merryId);
      setDashboard(res);
    } catch (e: any) {
      setDashboard(null);
      setDashboardError(
        getApiErrorMessage(e) || "Unable to load merry dashboard."
      );
    }
  }, [merryId]);

  const loadPayoutMeta = useCallback(async () => {
    if (!merryId || Number.isNaN(merryId)) return;

    try {
      setPayoutMetaError("");

      const [turnRes, readinessRes] = await Promise.allSettled([
        getNextPayoutTurn(merryId),
        getPayoutReadiness(merryId),
      ]);

      setNextTurn(turnRes.status === "fulfilled" ? turnRes.value : null);
      setReadiness(
        readinessRes.status === "fulfilled" ? readinessRes.value : null
      );

      const payoutErrors: string[] = [];

      if (turnRes.status === "rejected") {
        payoutErrors.push(
          getApiErrorMessage(turnRes.reason) || getErrorMessage(turnRes.reason)
        );
      }

      if (readinessRes.status === "rejected") {
        payoutErrors.push(
          getApiErrorMessage(readinessRes.reason) ||
            getErrorMessage(readinessRes.reason)
        );
      }

      setPayoutMetaError(payoutErrors.filter(Boolean).join(" • "));
    } catch (e: any) {
      setNextTurn(null);
      setReadiness(null);
      setPayoutMetaError(
        getApiErrorMessage(e) || "Unable to load payout information."
      );
    }
  }, [merryId]);

  const load = useCallback(async () => {
    if (!merryId || Number.isNaN(merryId)) {
      setError("Invalid merry selected.");
      setDetail(null);
      setDashboard(null);
      setReadiness(null);
      setNextTurn(null);
      setDashboardError("");
      setPayoutMetaError("");
      return;
    }

    try {
      setError("");

      const [sessionRes, meRes, detailRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMerryDetail(merryId),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: MerryUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      if (detailRes.status !== "fulfilled") {
        setDetail(null);
        setDashboard(null);
        setReadiness(null);
        setNextTurn(null);
        setDashboardError("");
        setPayoutMetaError("");
        setError(
          getApiErrorMessage(detailRes.reason) ||
            getErrorMessage(detailRes.reason)
        );
        return;
      }

      const nextDetail = detailRes.value;
      setDetail(nextDetail);

      const tasks: Promise<any>[] = [];

      if (nextDetail.is_member) {
        tasks.push(loadDashboard());
        tasks.push(loadPayoutMeta());
      } else {
        setDashboard(null);
        setDashboardError("");

        if (getIsAdmin(mergedUser)) {
          tasks.push(loadPayoutMeta());
        } else {
          setReadiness(null);
          setNextTurn(null);
          setPayoutMetaError("");
        }
      }

      if (tasks.length) {
        await Promise.all(tasks);
      }
    } catch (e: any) {
      setDetail(null);
      setDashboard(null);
      setReadiness(null);
      setNextTurn(null);
      setDashboardError("");
      setPayoutMetaError("");
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, [loadDashboard, loadPayoutMeta, merryId]);

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

  const isAdminUser = useMemo(() => getIsAdmin(user), [user]);
  const isMember = !!detail?.is_member;
  const joinStatus = detail?.my_join_request?.status || null;
  const canRequestJoin = !!detail?.can_request_join && !isMember;
  const title = detail?.name || "Merry";

  const contributionPerSeat = useMemo(() => {
    return moneyNumber(detail?.contribution_amount);
  }, [detail?.contribution_amount]);

  const mySeatNumbers = useMemo<number[]>(() => {
    const seats = (dashboard as any)?.seat_numbers;
    return Array.isArray(seats)
      ? seats.map((n) => Number(n)).filter(Boolean)
      : [];
  }, [dashboard]);

  const mySeatCount = mySeatNumbers.length;
  const memberPayAmount = useMemo(() => {
    return contributionPerSeat * Math.max(1, mySeatCount || 0);
  }, [contributionPerSeat, mySeatCount]);

  const walletBalance = useMemo(() => {
    return moneyNumber((dashboard as any)?.wallet_balance);
  }, [dashboard]);

  const totals = useMemo(() => {
    const source: any = (dashboard as any)?.totals || {};
    return {
      overdue: moneyNumber(source.overdue_total),
      current: moneyNumber(source.current_total),
      future: moneyNumber(source.future_total),
    };
  }, [dashboard]);

  const breakdownRows = useMemo<BreakdownRow[]>(() => {
    const rows = (dashboard as any)?.overdue_rows || [];
    return Array.isArray(rows) ? rows : [];
  }, [dashboard]);

  const penaltyTotal = useMemo(() => {
    return breakdownRows.reduce(
      (sum, row) => sum + moneyNumber(row.penalty_amount),
      0
    );
  }, [breakdownRows]);

  const overdueBaseTotal = useMemo(() => {
    return breakdownRows.reduce(
      (sum, row) => sum + moneyNumber(row.base_amount),
      0
    );
  }, [breakdownRows]);

  const myDueNow = useMemo(() => {
    return totals.overdue + totals.current;
  }, [totals.current, totals.overdue]);

  const totalPool = useMemo(() => {
    return moneyNumber(nextTurn?.expected_amount ?? 0);
  }, [nextTurn?.expected_amount]);

  const totalPaid = useMemo(() => {
    return moneyNumber(readiness?.paid_total ?? 0);
  }, [readiness]);

  const totalOutstanding = useMemo(() => {
    return moneyNumber(readiness?.outstanding_total ?? 0);
  }, [readiness]);

  const readinessRows = useMemo<ReadinessRow[]>(() => {
    const rows = (readiness as any)?.rows || [];
    return Array.isArray(rows) ? rows : [];
  }, [readiness]);

  const unpaidRows = useMemo(() => {
    return readinessRows.filter((row) => moneyNumber(row.outstanding) > 0);
  }, [readinessRows]);

  const availableSeatText = useMemo(() => {
    if (detail?.available_seats == null) return "Unlimited";
    return `${detail.available_seats} left`;
  }, [detail?.available_seats]);

  const membershipLabel = useMemo(() => {
    if (isMember) return "Joined";
    if (joinStatus === "PENDING") return "Pending";
    if (joinStatus === "APPROVED") return "Approved";
    if (joinStatus === "REJECTED") return "Rejected";
    if (canRequestJoin) return "Open";
    if (detail?.is_open === false) return "Closed";
    return "View";
  }, [canRequestJoin, detail?.is_open, isMember, joinStatus]);

  const canCreateNextPayout = useMemo(() => {
    return !!(
      isAdminUser &&
      (readiness as any)?.can_admin_create_payout &&
      readiness?.ready_for_payout &&
      !(readiness as any)?.payout_already_exists
    );
  }, [isAdminUser, readiness]);

  const currentTargetLabel = useMemo(() => {
    if (!nextTurn?.username) return "—";
    return `${nextTurn.username}${
      nextTurn?.seat_no ? ` • Seat ${nextTurn.seat_no}` : ""
    }`;
  }, [nextTurn?.seat_no, nextTurn?.username]);

  const currentPayoutDate = useMemo(() => {
    return nextTurn?.due_date || (readiness as any)?.scheduled_date || null;
  }, [nextTurn?.due_date, readiness]);

  const walletMessage = useMemo(() => {
    if (!isMember) return "";
    return "Pay now adds to your merry wallet and is used automatically when due.";
  }, [isMember]);

  const memberHeadline = useMemo(() => {
    if (!isMember) return fmtKES(contributionPerSeat);
    return fmtKES(memberPayAmount);
  }, [contributionPerSeat, isMember, memberPayAmount]);

  const memberHeadlineLabel = useMemo(() => {
    if (!isMember) return "Contribution per seat";
    return "Pay now";
  }, [isMember]);

  const goToDeposit = useCallback(() => {
    const amount = String(memberPayAmount || 0);

    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "merry",
        purpose: "MERRY_CONTRIBUTION",
        merryId: String(merryId),
        merry_id: String(merryId),
        amount,
        suggestedAmount: amount,
        initial_amount: amount,
        minimum_amount: amount,
        editableAmount: "true",
        returnTo: ROUTES.tabs.merry,
        backLabel: "Back to Merry",
        landingTitle: "Merry",
        title: "Merry Contribution",
        subtitle: title,
        narration: `Merry contribution - ${title}`,
      },
    });
  }, [memberPayAmount, merryId, title]);

  const openMembers = useCallback(() => {
    router.push({
      pathname: "/(tabs)/merry/members" as any,
      params: { merryId: String(merryId), returnTo: ROUTES.tabs.merry },
    });
  }, [merryId]);

  const handleCreateNextPayout = useCallback(async () => {
    if (!merryId || !canCreateNextPayout) {
      Alert.alert(
        "Not ready",
        (readiness as any)?.payout_already_exists
          ? "A payout already exists for this turn."
          : "This payout is not ready yet."
      );
      return;
    }

    try {
      setCreatingNextPayout(true);

      const res = await api.post(ENDPOINTS.merry.createNextPayout(merryId), {
        notes: "Created from mobile app",
      });

      Alert.alert(
        "Payout created",
        res?.data?.message || "The next payout record was created successfully."
      );

      await load();
    } catch (e: any) {
      Alert.alert(
        "Could not create payout",
        getApiErrorMessage(e) || getErrorMessage(e)
      );
    } finally {
      setCreatingNextPayout(false);
    }
  }, [canCreateNextPayout, load, merryId, readiness]);

  if (!merryId || Number.isNaN(merryId)) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Invalid merry"
            subtitle="The selected merry could not be opened."
            actionLabel="Go Back"
            onAction={backToMerryIndex}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !detail) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.silentLoadingWrap}>
          <Text style={styles.silentLoadingText}>Loading merry…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user && !loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to continue."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!detail && !loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Unable to load merry"
            subtitle={error || "This merry could not be loaded."}
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry as any)}
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
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.pageSubTitle}>
              {isMember
                ? `${mySeatCount} seat${mySeatCount === 1 ? "" : "s"}${
                    mySeatNumbers.length ? ` • ${mySeatNumbers.join(", ")}` : ""
                  }`
                : `${availableSeatText} • ${membershipLabel}`}
            </Text>
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

        {detail ? (
          <>
            <Card style={styles.heroCard} variant="default">
              <Text style={styles.heroLabel}>{memberHeadlineLabel}</Text>
              <Text style={styles.heroAmount}>{memberHeadline}</Text>

              {isMember ? (
                <>
                  <Text style={styles.heroHint}>
                    {mySeatCount} seat{mySeatCount === 1 ? "" : "s"} • {fmtKES(contributionPerSeat)} each
                  </Text>

                  <Text style={styles.heroHint}>{walletMessage}</Text>

                  {walletBalance > 0 ? (
                    <Text style={styles.heroHint}>Wallet: {fmtKES(walletBalance)}</Text>
                  ) : null}

                  <View style={styles.heroActions}>
                    <ActionButton
                      title="Pay now"
                      onPress={goToDeposit}
                      variant="primary"
                    />
                    <View style={{ width: SPACING.sm }} />
                    <ActionButton
                      title="Members"
                      onPress={openMembers}
                      variant="secondary"
                    />
                  </View>
                </>
              ) : (
                <View style={{ marginTop: SPACING.md }}>
                  {joinStatus === "PENDING" ? (
                    <ActionButton
                      title="Request pending"
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/merry/join-request" as any,
                          params: {
                            merryId: String(merryId),
                            returnTo: ROUTES.tabs.merry,
                          },
                        })
                      }
                      variant="primary"
                    />
                  ) : canRequestJoin ? (
                    <ActionButton
                      title="Join merry"
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/merry/join-request" as any,
                          params: {
                            merryId: String(merryId),
                            returnTo: ROUTES.tabs.merry,
                          },
                        })
                      }
                      variant="primary"
                    />
                  ) : (
                    <ActionButton
                      title={detail.is_open === false ? "Merry closed" : "Details"}
                      onPress={openMembers}
                      variant="secondary"
                    />
                  )}
                </View>
              )}
            </Card>

            {error ? (
              <Card style={styles.errorCard} variant="default">
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color="#FECACA"
                />
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            {dashboardError && isMember ? (
              <Card style={styles.errorCard} variant="default">
                <Text style={styles.errorText}>{dashboardError}</Text>
              </Card>
            ) : null}

            {payoutMetaError ? (
              <Card style={styles.errorCard} variant="default">
                <Text style={styles.errorText}>{payoutMetaError}</Text>
              </Card>
            ) : null}

            {isMember ? (
              <Section title="Current turn">
                <Card style={styles.sectionCard} variant="default">
                  <Text style={styles.turnTarget}>{currentTargetLabel}</Text>
                  <Text style={styles.turnMeta}>
                    Turn {nextTurn?.turn_no ?? "—"} • Cycle {(nextTurn as any)?.cycle_no ?? "—"}
                  </Text>
                  {currentPayoutDate ? (
                    <Text style={styles.turnMeta}>
                      Due date: {formatShortDueDate(String(currentPayoutDate)) || String(currentPayoutDate)}
                    </Text>
                  ) : null}

                  <View style={styles.summaryRow}>
                    <SummaryStat
                      label="Pay now"
                      value={fmtKES(memberPayAmount)}
                      icon="cash-outline"
                    />
                    <SummaryStat
                      label="Wallet"
                      value={fmtKES(walletBalance)}
                      icon="wallet-outline"
                    />
                  </View>

                  <View style={styles.summaryRow}>
                    <SummaryStat
                      label="Per seat"
                      value={fmtKES(contributionPerSeat)}
                      icon="pricetag-outline"
                    />
                    <SummaryStat
                      label="My seats"
                      value={String(mySeatCount)}
                      icon="albums-outline"
                    />
                  </View>

                  <View style={{ marginTop: SPACING.sm }}>
                    {myDueNow > 0 ? (
                      <InfoPill
                        text={`Due now: ${fmtKES(myDueNow)}`}
                        danger={myDueNow > 0}
                      />
                    ) : (
                      <InfoPill text="No due right now. Pay now goes to wallet for future use." success />
                    )}
                  </View>
                </Card>
              </Section>
            ) : null}

            {isMember && breakdownRows.length ? (
              <Section title="Overdue breakdown">
                <Card style={styles.sectionCard} variant="default">
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setShowBreakdown((v) => !v)}
                    style={styles.toggleBtn}
                  >
                    <Text style={styles.toggleBtnText}>
                      {showBreakdown ? "Hide breakdown" : "View breakdown"}
                    </Text>
                    <Ionicons
                      name={showBreakdown ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={WHITE}
                    />
                  </TouchableOpacity>

                  {showBreakdown ? (
                    <View style={{ marginTop: SPACING.md }}>
                      <Text style={styles.sectionMiniText}>
                        Base overdue: {fmtKES(overdueBaseTotal)}
                        {penaltyTotal > 0
                          ? ` • Penalty: ${fmtKES(penaltyTotal)}`
                          : ""}
                      </Text>

                      {breakdownRows.map((row, idx) => (
                        <BreakdownCard
                          key={`${row.due_id ?? idx}-${row.seat_no ?? idx}`}
                          row={row}
                        />
                      ))}
                    </View>
                  ) : null}
                </Card>
              </Section>
            ) : null}

            {isAdminUser ? (
              <Section title="Admin">
                <Card style={styles.sectionCard} variant="default">
                  <View style={styles.summaryRow}>
                    <SummaryStat
                      label="Expected"
                      value={fmtKES(totalPool)}
                      icon="cash-outline"
                    />
                    <SummaryStat
                      label="Paid"
                      value={fmtKES(totalPaid)}
                      icon="checkmark-done-outline"
                    />
                  </View>

                  <View style={styles.summaryRow}>
                    <SummaryStat
                      label="Outstanding"
                      value={fmtKES(totalOutstanding)}
                      icon="hourglass-outline"
                    />
                    <SummaryStat
                      label="Next member"
                      value={nextTurn?.username || "—"}
                      icon="person-outline"
                    />
                  </View>

                  <View style={{ marginTop: SPACING.sm }}>
                    {readiness?.ready_for_payout ? (
                      <InfoPill text="Payout is ready" success />
                    ) : (
                      <InfoPill
                        text={`Payout is not ready • ${fmtKES(totalOutstanding)} still missing`}
                      />
                    )}
                  </View>

                  {unpaidRows.length ? (
                    <View style={{ marginTop: SPACING.md }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setShowAdminBreakdown((v) => !v)}
                        style={styles.toggleBtn}
                      >
                        <Text style={styles.toggleBtnText}>
                          {showAdminBreakdown
                            ? "Hide unpaid members"
                            : "View unpaid members"}
                        </Text>
                        <Ionicons
                          name={showAdminBreakdown ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={WHITE}
                        />
                      </TouchableOpacity>

                      {showAdminBreakdown ? (
                        <View style={{ marginTop: SPACING.md }}>
                          {unpaidRows.map((row, idx) => (
                            <AdminRowCard
                              key={`${row.due_id ?? idx}-${row.user_id ?? idx}`}
                              row={row}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  <View style={{ marginTop: SPACING.md }}>
                    <ActionButton
                      title={
                        creatingNextPayout
                          ? "Creating..."
                          : canCreateNextPayout
                            ? "Create next payout"
                            : "Not ready"
                      }
                      onPress={handleCreateNextPayout}
                      variant="primary"
                      disabled={!canCreateNextPayout || creatingNextPayout}
                    />
                  </View>
                </Card>
              </Section>
            ) : null}

            <View style={styles.bottomActions}>
              <ActionButton
                title="Back"
                onPress={backToMerryIndex}
                variant="secondary"
              />
            </View>
          </>
        ) : null}
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
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
    padding: 24,
  },

  silentLoadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: PAGE_BG,
  },

  silentLoadingText: {
    color: TEXT_SOFT,
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  pageTitle: {
    color: WHITE,
    fontSize: 22,
    fontFamily: FONT.bold,
  },

  pageSubTitle: {
    color: TEXT_SOFT,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  heroCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  heroLabel: {
    color: TEXT_SOFT,
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  heroAmount: {
    color: WHITE,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: FONT.bold,
    marginTop: 8,
  },

  heroHint: {
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginTop: 8,
  },

  sectionCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  turnTarget: {
    color: WHITE,
    fontSize: 18,
    fontFamily: FONT.bold,
  },

  turnMeta: {
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginTop: 6,
  },

  summaryRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  summaryStat: {
    flex: 1,
    minHeight: 96,
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: CARD_BG_2,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  summaryStatIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.90)",
    marginBottom: 8,
  },

  summaryStatLabel: {
    color: TEXT_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  summaryStatValue: {
    color: WHITE,
    fontSize: 17,
    lineHeight: 22,
    fontFamily: FONT.bold,
    marginTop: 6,
  },

  infoPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },

  infoPillText: {
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.18)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.20)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  errorText: {
    flex: 1,
    color: WHITE,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  toggleBtn: {
    minHeight: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  toggleBtnText: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  sectionMiniText: {
    color: TEXT_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginBottom: 4,
  },

  breakdownCard: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  breakdownTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  breakdownSeat: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  breakdownMeta: {
    color: TEXT_FAINT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginTop: 6,
  },

  breakdownMoneyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },

  breakdownMoneyLabel: {
    color: TEXT_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  breakdownMoneyValue: {
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  actionBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },

  actionBtnPrimary: {
    backgroundColor: PRIMARY_BTN,
    borderColor: PRIMARY_BTN,
  },

  actionBtnSecondary: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.18)",
  },

  actionBtnDisabled: {
    opacity: 0.55,
  },

  actionBtnText: {
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  actionBtnTextPrimary: {
    color: WHITE,
  },

  actionBtnTextSecondary: {
    color: WHITE,
  },

  actionBtnTextDisabled: {
    color: "rgba(255,255,255,0.75)",
  },

  bottomActions: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
});
