import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { ROUTES } from "@/constants/routes";
import { FONT, SHADOW, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { ENDPOINTS } from "@/services/endpoints";
import {
  fmtKES,
  getMerryMemberDashboard,
  getMerryMobileDetailBundle,
  getMerryMobileReadiness,
  getNextPayoutTurn,
  getPayoutReadiness,
  MerryDetail,
  MerryMemberDashboardResponse,
  MerryMobileDetailBundle,
  NextPayoutTurnResponse,
  PayoutReadinessResponse
} from "@/services/merry";

type MerryUser = {
    username?: string | null;
    is_admin?: boolean;
    is_staff?: boolean;
    is_superuser?: boolean;
  };

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
  expected_amount?: string | number;
  paid_amount?: string | number;
  outstanding?: string | number;
  outstanding_amount?: string | number;
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
  expected_amount?: string | number;
  paid_amount?: string | number;
  outstanding?: string | number;
  outstanding_amount?: string | number;
  status?: string;
  due_date?: string | null;
  days_overdue?: number;
};

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const PRIMARY_BTN = "#197D71";
const WHITE = "#FFFFFF";
const TEXT_SOFT = "rgba(255,255,255,0.82)";
const TEXT_FAINT = "rgba(255,255,255,0.70)";
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

function getApiErrorMessage(error: any): string {
  const data = error?.response?.data;

  if (typeof data === "string") return data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.error === "string") return data.error;

  if (data && typeof data === "object") {
    const firstValue = Object.values(data).find(Boolean);

    if (Array.isArray(firstValue)) {
      return String(firstValue[0] ?? "");
    }

    if (firstValue) return String(firstValue);
  }

  return "";
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

function unwrapApiData(value: any): any {
  if (!value || typeof value !== "object") return value;

  if (value.data && typeof value.data === "object") return value.data;
  if (value.result && typeof value.result === "object") return value.result;
  if (value.payload && typeof value.payload === "object") return value.payload;

  return value;
}

function normalizeReadinessSource(value: any): any {
  const source = unwrapApiData(value);

  if (!source || typeof source !== "object") return null;

  return (
    source.readiness ||
    source.payout_readiness ||
    source.payoutReadiness ||
    source.payout_readiness_status ||
    source.payoutReadinessStatus ||
    source
  );
}

function normalizeTurnSource(value: any): any {
  const source = unwrapApiData(value);

  if (!source || typeof source !== "object") return null;

  return (
    source.next_turn ||
    source.nextTurn ||
    source.current_turn ||
    source.currentTurn ||
    source.turn ||
    source
  );
}

function hasReadinessContent(value: any) {
  const source = normalizeReadinessSource(value);

  if (!source || typeof source !== "object") return false;

  return Boolean(
    Array.isArray(source.rows) ||
      Array.isArray(source.members_paid) ||
      Array.isArray(source.members_not_paid) ||
      source.pool_amount !== undefined ||
      source.total_paid !== undefined ||
      source.total_unpaid !== undefined ||
      source.paid_total !== undefined ||
      source.outstanding_total !== undefined ||
      source.due_total !== undefined ||
      source.total_paid_allocated !== undefined ||
      source.total_due !== undefined ||
      source.next_turn ||
      source.nextTurn,
  );
}

function firstReadinessSource(...sources: any[]) {
  for (const source of sources) {
    const normalized = normalizeReadinessSource(source);

    if (hasReadinessContent(normalized)) {
      return normalized;
    }
  }

  return null;
}

function readinessNumber(source: any, keys: string[]) {
  const normalized = normalizeReadinessSource(source);

  if (!normalized || typeof normalized !== "object") return 0;

  for (const key of keys) {
    if (normalized[key] !== undefined && normalized[key] !== null) {
      return moneyNumber(normalized[key]);
    }
  }

  return 0;
}

function readinessRowsFrom(source: any): ReadinessRow[] {
  const normalized = normalizeReadinessSource(source);

  if (!normalized || typeof normalized !== "object") return [];

  const mobileMemberRows = [
    ...(Array.isArray(normalized.members_paid) ? normalized.members_paid : []),
    ...(Array.isArray(normalized.members_not_paid)
      ? normalized.members_not_paid
      : []),
  ];

  const candidates = [
    normalized.rows,
    mobileMemberRows.length ? mobileMemberRows : undefined,
    normalized.data?.rows,
    normalized.member_rows,
    normalized.memberRows,
    normalized.readiness_rows,
    normalized.readinessRows,
    normalized.payout_rows,
    normalized.payoutRows,
  ];

  const rows = candidates.find((candidate) => Array.isArray(candidate));

  return Array.isArray(rows) ? rows : [];
}

function rowPaidAmount(row: any) {
  return moneyNumber(
    row?.paid_amount ??
      row?.paidAmount ??
      row?.amount_paid ??
      row?.amountPaid ??
      row?.total_paid ??
      row?.totalPaid ??
      row?.paid,
  );
}

function rowOutstandingAmount(row: any) {
  return moneyNumber(
    row?.outstanding ??
      row?.outstanding_amount ??
      row?.outstandingAmount ??
      row?.remaining ??
      row?.remaining_amount ??
      row?.remainingAmount ??
      row?.balance,
  );
}

function rowDueAmount(row: any) {
  const direct = moneyNumber(
    row?.due_amount ??
      row?.dueAmount ??
      row?.total_due ??
      row?.totalDue ??
      row?.amount,
  );

  if (direct > 0) return direct;

  return moneyNumber(row?.base_amount ?? row?.baseAmount) +
    moneyNumber(row?.penalty_amount ?? row?.penaltyAmount);
}

function rowStatus(row: any) {
  return String(row?.status || "").trim().toUpperCase();
}


function getIsAdmin(user?: MerryUser | null) {
  if (!user) return false;

  const adminFlags = [
    (user as any)?.is_admin,
    (user as any)?.isAdmin,
    (user as any)?.is_staff,
    (user as any)?.isStaff,
    (user as any)?.is_superuser,
    (user as any)?.isSuperuser,
    (user as any)?.can_manage_merry,
    (user as any)?.canManageMerry,
    (user as any)?.can_manage_users,
    (user as any)?.canManageUsers,
  ];

  if (adminFlags.some((value) => toBool(value))) return true;

  const roleFields = [
    (user as any)?.role,
    (user as any)?.user_role,
    (user as any)?.userRole,
    (user as any)?.account_role,
    (user as any)?.accountRole,
    (user as any)?.account_type,
    (user as any)?.accountType,
    (user as any)?.user_type,
    (user as any)?.userType,
    (user as any)?.type,
  ]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);

  return roleFields.some((role) =>
    [
      "admin",
      "administrator",
      "super_admin",
      "superadmin",
      "staff",
      "owner",
    ].includes(role),
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

  if (s === "NOT_PAID") {
    return { bg: DANGER_BG, text: DANGER_TEXT, label: "Not paid" };
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

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
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
          isPrimary
            ? styles.actionBtnTextPrimary
            : styles.actionBtnTextSecondary,
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
  const dueDateLabel = row.due_date
    ? formatShortDueDate(String(row.due_date))
    : "";

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
          {daysLate > 0
            ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"} overdue`
            : ""}
        </Text>
      ) : null}

      <View style={styles.breakdownMoneyRow}>
        <Text style={styles.breakdownMoneyLabel}>Base</Text>
        <Text style={styles.breakdownMoneyValue}>{fmtKES(baseAmount)}</Text>
      </View>

      {penalty > 0 ? (
        <View style={styles.breakdownMoneyRow}>
          <Text style={styles.breakdownMoneyLabel}>
            Penalty
            {daysLate > 0
              ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"}`
              : ""}
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
  const outstanding = rowOutstandingAmount(row);
  const penalty = moneyNumber((row as any)?.penalty_amount ?? (row as any)?.penaltyAmount);
  const paidAmount = rowPaidAmount(row);
  const daysLate = Number(row.days_overdue ?? 0);
  const dueDateLabel = row.due_date
    ? formatShortDueDate(String(row.due_date))
    : "";

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
          {daysLate > 0
            ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"} overdue`
            : ""}
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
            {daysLate > 0
              ? ` • ${daysLate} day${daysLate === 1 ? "" : "s"}`
              : ""}
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



function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function merryUserFromMobileBundle(
  bundle?: MerryMobileDetailBundle | null
): MerryUser | null {
  const viewer = bundle?.viewer as any;

  if (!viewer || typeof viewer !== "object") return null;

  return {
    ...viewer,
    is_staff: viewer.is_staff ?? viewer.is_admin,
    is_superuser: viewer.is_superuser ?? viewer.is_admin,
  };
}

async function fetchCurrentMerryUser(): Promise<MerryUser | null> {
  try {
    const res = await api.get(ENDPOINTS.accounts.me);
    const data = unwrapApiData(res.data);

    if (!data || typeof data !== "object") return null;

    return data as MerryUser;
  } catch {
    return null;
  }
}

export default function MerryDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    merryId?: string | string[];
    merry_id?: string | string[];
    returnTo?: string | string[];
  }>();

  const rawMerryId =
    firstParam(params.id) ??
    firstParam(params.merryId) ??
    firstParam(params.merry_id);

  const merryId = Number.parseInt(String(rawMerryId ?? ""), 10);
  const hasValidMerryId = Number.isFinite(merryId) && merryId > 0;
  const returnToValue = firstParam(params.returnTo);

  const backToMerryIndex = useCallback(() => {
    const target =
      typeof returnToValue === "string" && returnToValue.trim()
        ? returnToValue
        : ROUTES.tabs.merry;

    router.replace(target as any);
  }, [returnToValue]);

  const [user, setUser] = useState<MerryUser | null>(null);
  const [detail, setDetail] = useState<MerryDetail | null>(null);
  const [dashboard, setDashboard] =
    useState<MerryMemberDashboardResponse | null>(null);
  const [nextTurn, setNextTurn] = useState<NextPayoutTurnResponse | null>(null);
  const [readiness, setReadiness] = useState<PayoutReadinessResponse | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingNextPayout, setCreatingNextPayout] = useState(false);

  const [error, setError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [payoutMetaError, setPayoutMetaError] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showAdminBreakdown, setShowAdminBreakdown] = useState(false);
  const [adminRowsLoading, setAdminRowsLoading] = useState(false);
  const [adminRowsLoaded, setAdminRowsLoaded] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!hasValidMerryId) return;

    try {
      setDashboardError("");
      const res = await getMerryMemberDashboard(merryId);
      setDashboard(res);
    } catch (e: any) {
      setDashboard(null);

      // This is not a fatal screen error. Keep the page clean and allow pull-to-refresh.
      setDashboardError("");
    }
  }, [hasValidMerryId, merryId]);

  const loadPayoutMeta = useCallback(
    async (includeReadiness = false) => {
      if (!hasValidMerryId) return;

      try {
        setPayoutMetaError("");

        // Normal members only need the next payout turn.
        // Readiness is mainly for admin payout creation and can fail on some accounts,
        // so do not let it show a scary warning for ordinary member viewing.
        const [turnRes, readinessRes] = await Promise.allSettled([
          getNextPayoutTurn(merryId),
          includeReadiness
            ? getPayoutReadiness(merryId)
            : Promise.resolve(null),
        ]);

        setNextTurn(
          turnRes.status === "fulfilled"
            ? normalizeTurnSource(turnRes.value)
            : null,
        );

        if (includeReadiness) {
          setReadiness(
            readinessRes.status === "fulfilled"
              ? normalizeReadinessSource(readinessRes.value)
              : null,
          );
        } else {
          setReadiness(null);
        }

        if (turnRes.status === "rejected") {
          // Non-critical metadata failed. Keep the screen professional and quiet.
          setPayoutMetaError("");
          return;
        }

        if (includeReadiness && readinessRes.status === "rejected") {
          // Admin can refresh; do not show raw backend/network wording in the UI.
          setPayoutMetaError("");
          return;
        }

        setPayoutMetaError("");
      } catch (e: any) {
        setNextTurn(null);
        setReadiness(null);

        // This should not block the page or show "something went wrong".
        setPayoutMetaError("");
      }
    },
    [hasValidMerryId, merryId],
  );

  const load = useCallback(async () => {
    if (!hasValidMerryId) {
      setError("Invalid merry selected.");
      setDetail(null);
      setDashboard(null);
      setReadiness(null);
      setNextTurn(null);
      setUser(null);
      setDashboardError("");
      setPayoutMetaError("");
      setAdminRowsLoaded(false);
      return;
    }

    try {
      setError("");
      setDashboardError("");
      setPayoutMetaError("");
      setAdminRowsLoaded(false);
      setShowAdminBreakdown(false);

      // Mobile-only source of truth.
      // 1) /api/merry/:id/mobile-detail/ opens the screen.
      // 2) /api/merry/:id/mobile-readiness-rows/ loads admin payment totals/rows silently after the page is visible.
      const mobileBundle = await getMerryMobileDetailBundle(merryId);
      const viewerUser = merryUserFromMobileBundle(mobileBundle);

      setUser(viewerUser);
      setDetail(mobileBundle.detail);
      setDashboard(mobileBundle.dashboard);
      setNextTurn(mobileBundle.nextTurn);
      setReadiness(mobileBundle.readiness);
      setAdminRowsLoaded(false);

      if (getIsAdmin(viewerUser)) {
        setAdminRowsLoading(true);

        getMerryMobileReadiness(merryId)
          .then((adminReadiness) => {
            setReadiness((prev: any) => {
              const previous = normalizeReadinessSource(prev) || {};

              return {
                ...previous,
                ...adminReadiness,
                next_turn:
                  adminReadiness.next_turn ||
                  previous.next_turn ||
                  previous.nextTurn ||
                  null,
                rows: Array.isArray(adminReadiness.rows)
                  ? adminReadiness.rows
                  : Array.isArray(previous.rows)
                    ? previous.rows
                    : [],
              };
            });

            setAdminRowsLoaded(true);
          })
          .catch(() => {
            setAdminRowsLoaded(false);
            setPayoutMetaError("");
          })
          .finally(() => {
            setAdminRowsLoading(false);
          });
      } else {
        setAdminRowsLoading(false);
      }
    } catch (e: any) {
      setDetail(null);
      setDashboard(null);
      setReadiness(null);
      setNextTurn(null);
      setUser(null);
      setDashboardError("");
      setPayoutMetaError("");
      setAdminRowsLoaded(false);
      setError(
        getApiErrorMessage(e) ||
          getErrorMessage(e) ||
          "This merry could not be loaded. Please login again and refresh.",
      );
    }
  }, [hasValidMerryId, merryId]);

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadAdminReadinessRows = useCallback(async () => {
    if (!hasValidMerryId) return false;

    try {
      setAdminRowsLoading(true);
      setPayoutMetaError("");

      const normalizedRows = await getMerryMobileReadiness(merryId);

      setReadiness((prev: any) => {
        const previous = normalizeReadinessSource(prev) || {};

        return {
          ...previous,
          ...normalizedRows,
          next_turn:
            normalizedRows.next_turn ||
            previous.next_turn ||
            previous.nextTurn ||
            null,
          rows: Array.isArray(normalizedRows.rows) ? normalizedRows.rows : [],
        };
      });

      setAdminRowsLoaded(true);
      return true;
    } catch {
      // Keep the UI clean. Admin can pull-to-refresh and try again.
      setPayoutMetaError("");
      return false;
    } finally {
      setAdminRowsLoading(false);
    }
  }, [hasValidMerryId, merryId]);

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
      0,
    );
  }, [breakdownRows]);

  const overdueBaseTotal = useMemo(() => {
    return breakdownRows.reduce(
      (sum, row) => sum + moneyNumber(row.base_amount),
      0,
    );
  }, [breakdownRows]);

  const myDueNow = useMemo(() => {
    return totals.overdue + totals.current;
  }, [totals.current, totals.overdue]);

  const payableAfterWallet = useMemo(() => {
    const payable = myDueNow - walletBalance;
    return payable > 0 ? payable : 0;
  }, [myDueNow, walletBalance]);

  const depositAmount = useMemo(() => {
    if (myDueNow > 0) {
      return payableAfterWallet;
    }

    return memberPayAmount;
  }, [memberPayAmount, myDueNow, payableAfterWallet]);

  const effectiveReadiness = useMemo<any>(() => {
    return firstReadinessSource(
      readiness,
      (detail as any)?.readiness,
      (detail as any)?.payout_readiness,
      (detail as any)?.payoutReadiness,
      (detail as any)?.data?.readiness,
      (detail as any)?.data?.payout_readiness,
      (dashboard as any)?.readiness,
      (dashboard as any)?.payout_readiness,
    );
  }, [dashboard, detail, readiness]);

  const effectiveNextTurn = useMemo<any>(() => {
    return (
      normalizeTurnSource(nextTurn) ||
      normalizeTurnSource(effectiveReadiness?.next_turn) ||
      normalizeTurnSource(effectiveReadiness?.nextTurn) ||
      normalizeTurnSource((detail as any)?.next_turn) ||
      normalizeTurnSource((detail as any)?.nextTurn) ||
      null
    );
  }, [detail, effectiveReadiness, nextTurn]);

  const readinessRows = useMemo<ReadinessRow[]>(() => {
    return readinessRowsFrom(effectiveReadiness);
  }, [effectiveReadiness]);

  const rowsPaidTotal = useMemo(() => {
    return readinessRows.reduce((sum, row) => sum + rowPaidAmount(row), 0);
  }, [readinessRows]);

  const rowsOutstandingTotal = useMemo(() => {
    return readinessRows.reduce(
      (sum, row) => sum + rowOutstandingAmount(row),
      0,
    );
  }, [readinessRows]);

  const rowsDueTotal = useMemo(() => {
    return readinessRows.reduce((sum, row) => sum + rowDueAmount(row), 0);
  }, [readinessRows]);

  const totalPool = useMemo(() => {
    const backendDueTotal = readinessNumber(effectiveReadiness, [
      "pool_amount",
      "due_total",
      "total_due",
      "expected_amount",
      "payout_amount",
      "amount",
    ]);

    const turnExpected = moneyNumber(
      effectiveNextTurn?.expected_amount ?? effectiveNextTurn?.amount,
    );

    return rowsDueTotal || backendDueTotal || turnExpected;
  }, [effectiveNextTurn, effectiveReadiness, rowsDueTotal]);

  const totalPaid = useMemo(() => {
    const backendPaidTotal = readinessNumber(effectiveReadiness, [
      "paid_total",
      "total_paid",
      "total_paid_allocated",
      "paid",
    ]);

    return Math.max(rowsPaidTotal, backendPaidTotal);
  }, [effectiveReadiness, rowsPaidTotal]);

  const totalOutstanding = useMemo(() => {
    const backendOutstandingTotal = readinessNumber(effectiveReadiness, [
      "total_unpaid",
      "outstanding_total",
      "total_outstanding",
      "remaining_total",
      "balance_total",
      "outstanding",
    ]);

    return Math.max(rowsOutstandingTotal, backendOutstandingTotal);
  }, [effectiveReadiness, rowsOutstandingTotal]);

  const paidRows = useMemo(() => {
    return readinessRows.filter((row) => {
      return rowPaidAmount(row) > 0 && rowOutstandingAmount(row) <= 0;
    });
  }, [readinessRows]);

  const partialRows = useMemo(() => {
    return readinessRows.filter((row) => {
      return rowPaidAmount(row) > 0 && rowOutstandingAmount(row) > 0;
    });
  }, [readinessRows]);

  const unpaidRows = useMemo(() => {
    return readinessRows.filter((row) => {
      return rowPaidAmount(row) <= 0 && rowOutstandingAmount(row) > 0;
    });
  }, [readinessRows]);

  const adminMemberRows = useMemo(() => {
    return [...paidRows, ...partialRows, ...unpaidRows];
  }, [paidRows, partialRows, unpaidRows]);

  const adminRowsCount = useMemo(() => {
    const explicitCount = Number(
      (effectiveReadiness as any)?.rows_count ??
        (effectiveReadiness as any)?.rowsCount ??
        ((effectiveReadiness as any)?.paid_count !== undefined ||
        (effectiveReadiness as any)?.not_paid_count !== undefined
          ? Number((effectiveReadiness as any)?.paid_count ?? 0) +
            Number((effectiveReadiness as any)?.not_paid_count ?? 0)
          : undefined),
    );

    if (Number.isFinite(explicitCount) && explicitCount > 0) {
      return explicitCount;
    }

    if (adminMemberRows.length > 0) return adminMemberRows.length;

    const seatCount = Number(
      detail?.seats_count ?? detail?.members_count ?? detail?.max_seats ?? 0,
    );

    return Number.isFinite(seatCount) && seatCount > 0 ? seatCount : 0;
  }, [
    adminMemberRows.length,
    detail?.max_seats,
    detail?.members_count,
    detail?.seats_count,
    effectiveReadiness,
  ]);

  const handleToggleAdminBreakdown = useCallback(async () => {
    if (!showAdminBreakdown && !adminRowsLoaded && !adminRowsLoading) {
      await loadAdminReadinessRows();
    }

    setShowAdminBreakdown((value) => !value);
  }, [
    adminRowsLoaded,
    adminRowsLoading,
    loadAdminReadinessRows,
    showAdminBreakdown,
  ]);

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
      effectiveReadiness?.can_admin_create_payout &&
      effectiveReadiness?.ready_for_payout &&
      !effectiveReadiness?.payout_already_exists
    );
  }, [effectiveReadiness, isAdminUser]);

  const currentTargetLabel = useMemo(() => {
    const name = effectiveNextTurn?.username;
    const seatNo = effectiveNextTurn?.seat_no;

    if (!name) return "—";

    return `${name}${seatNo ? ` • Seat ${seatNo}` : ""}`;
  }, [effectiveNextTurn]);

  const nextMemberLabel = useMemo(() => {
    const directName =
      effectiveNextTurn?.next_username ||
      effectiveNextTurn?.next_user_name ||
      effectiveNextTurn?.next_member_name ||
      effectiveNextTurn?.upcoming_username ||
      effectiveNextTurn?.upcoming_member_name;

    const directSeatNo =
      effectiveNextTurn?.next_seat_no || effectiveNextTurn?.upcoming_seat_no;

    if (directName) {
      return `${directName}${directSeatNo ? ` • Seat ${directSeatNo}` : ""}`;
    }

    const currentSeatNo = Number(effectiveNextTurn?.seat_no ?? 0);
    const orderedRows = readinessRows
      .filter((row) => row.username && Number.isFinite(Number(row.seat_no)))
      .slice()
      .sort((a, b) => Number(a.seat_no ?? 0) - Number(b.seat_no ?? 0));

    if (orderedRows.length && currentSeatNo > 0) {
      const nextRow =
        orderedRows.find((row) => Number(row.seat_no ?? 0) > currentSeatNo) ||
        orderedRows[0];

      return `${nextRow.username}${
        nextRow.seat_no ? ` • Seat ${nextRow.seat_no}` : ""
      }`;
    }

    if (effectiveNextTurn?.username) {
      return `${effectiveNextTurn.username}${
        effectiveNextTurn?.seat_no ? ` • Seat ${effectiveNextTurn.seat_no}` : ""
      }`;
    }

    return "—";
  }, [effectiveNextTurn, readinessRows]);

  const currentPayoutDate = useMemo(() => {
    return (
      effectiveNextTurn?.due_date ||
      effectiveNextTurn?.scheduled_date ||
      effectiveReadiness?.scheduled_date ||
      null
    );
  }, [effectiveNextTurn, effectiveReadiness]);

  const memberHeadline = useMemo(() => {
    return fmtKES(depositAmount);
  }, [depositAmount]);

  const memberHeadlineLabel = useMemo(() => {
    return isMember ? "Contribute now" : "Contribution per seat";
  }, [isMember]);

  const heroMessage = useMemo(() => {
    if (!isMember) {
      return `${availableSeatText} • ${membershipLabel}`;
    }

    if (myDueNow > 0) {
      return "You have something pending right now.";
    }

    if (walletBalance > 0) {
      return "Your wallet will help cover upcoming contributions.";
    }

    return "You can still contribute for later.";
  }, [availableSeatText, isMember, membershipLabel, myDueNow, walletBalance]);

  const goToDeposit = useCallback(() => {
    const amount = String(depositAmount || 0);

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
  }, [depositAmount, merryId, title]);

  const openMembers = useCallback(() => {
    router.push({
      pathname: "/(tabs)/merry/members" as any,
      params: { merryId: String(merryId), returnTo: ROUTES.tabs.merry },
    });
  }, [merryId]);

  const handleCreateNextPayout = useCallback(async () => {
    if (!hasValidMerryId || !canCreateNextPayout) {
      Alert.alert(
        "Not ready",
        effectiveReadiness?.payout_already_exists
          ? "A payout already exists for this turn."
          : "This payout is not ready yet.",
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
        res?.data?.message ||
          "The next payout record was created successfully.",
      );

      await load();
    } catch (e: any) {
      Alert.alert(
        "Could not create payout",
        getApiErrorMessage(e) || getErrorMessage(e),
      );
    } finally {
      setCreatingNextPayout(false);
    }
  }, [canCreateNextPayout, effectiveReadiness, hasValidMerryId, load, merryId]);

  if (!hasValidMerryId) {
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

  if (!detail && loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <ScrollView
          style={styles.page}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + 24, 32) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pageTitle}>Merry</Text>
              <Text style={styles.pageSubTitle}>Opening quietly</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={backToMerryIndex}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
            </TouchableOpacity>
          </View>

          <Card style={styles.heroCard} variant="default">
            <Text style={styles.heroLabel}>Merry contribution</Text>
            <Text style={styles.heroAmount}>{fmtKES(0)}</Text>
            <Text style={styles.heroHint}>
              Your merry details will appear here shortly.
            </Text>
          </Card>

          <SectionBlock title="Current turn">
            <Card style={styles.sectionCard} variant="default">
              <Text style={styles.turnTarget}>—</Text>
              <Text style={styles.turnMeta}>Loading details quietly...</Text>
            </Card>
          </SectionBlock>
        </ScrollView>
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
        {detail ? (
          <>
            <View style={styles.topBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pageTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.pageSubTitle}>
                  {isMember
                    ? `${mySeatCount} seat${mySeatCount === 1 ? "" : "s"}${
                        mySeatNumbers.length
                          ? ` • ${mySeatNumbers.join(", ")}`
                          : ""
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

            <Card style={styles.heroCard} variant="default">
              <Text style={styles.heroLabel}>{memberHeadlineLabel}</Text>
              <Text style={styles.heroAmount}>
                {isMember ? memberHeadline : fmtKES(contributionPerSeat)}
              </Text>

              {isMember ? (
                <>
                  <Text style={styles.heroHint}>
                    {mySeatCount} seat{mySeatCount === 1 ? "" : "s"} •{" "}
                    {fmtKES(contributionPerSeat)} each
                  </Text>

                  <Text style={styles.heroHint}>{heroMessage}</Text>

                  {walletBalance > 0 ? (
                    <Text style={styles.heroHint}>
                      Wallet: {fmtKES(walletBalance)}
                    </Text>
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
                      title={
                        detail.is_open === false ? "Merry closed" : "Details"
                      }
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

            {/* Non-critical dashboard/payout metadata errors are kept out of the UI.
                The main page stays usable, and pull-to-refresh can retry silently. */}

            {isMember ? (
              <SectionBlock title="Current turn">
                <Card style={styles.sectionCard} variant="default">
                  <Text style={styles.turnTarget}>{currentTargetLabel}</Text>
                  <Text style={styles.turnMeta}>
                    Turn {effectiveNextTurn?.turn_no ?? "—"} • Cycle{" "}
                    {effectiveNextTurn?.cycle_no ??
                      effectiveNextTurn?.cycle_number ??
                      "—"}
                  </Text>
                  {currentPayoutDate ? (
                    <Text style={styles.turnMeta}>
                      Due date:{" "}
                      {formatShortDueDate(String(currentPayoutDate)) ||
                        String(currentPayoutDate)}
                    </Text>
                  ) : null}

                  <View style={styles.summaryRow}>
                    <SummaryStat
                      label="Pay now"
                      value={fmtKES(depositAmount)}
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
                      <InfoPill
                        text="You can still contribute for later."
                        success
                      />
                    )}
                  </View>
                </Card>
              </SectionBlock>
            ) : null}

            {isMember && breakdownRows.length ? (
              <SectionBlock title="Overdue breakdown">
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
              </SectionBlock>
            ) : null}

            {isAdminUser ? (
              <SectionBlock title="Admin">
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
                      value={nextMemberLabel}
                      icon="person-outline"
                    />
                  </View>

                  <View style={{ marginTop: SPACING.sm }}>
                    {effectiveReadiness?.ready_for_payout ? (
                      <InfoPill text="Payout is ready" success />
                    ) : (
                      <InfoPill
                        text={`Payout is not ready • ${fmtKES(totalOutstanding)} still missing`}
                      />
                    )}

                    {adminRowsLoading && !adminRowsLoaded ? (
                      <Text style={[styles.sectionMiniText, { marginTop: SPACING.sm }]}>
                        Updating payment status quietly...
                      </Text>
                    ) : null}
                  </View>

                  {adminRowsCount ? (
                    <View style={{ marginTop: SPACING.md }}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={handleToggleAdminBreakdown}
                        disabled={adminRowsLoading}
                        style={styles.toggleBtn}
                      >
                        <Text style={styles.toggleBtnText}>
                          {showAdminBreakdown
                            ? "Hide current turn members"
                            : adminRowsLoading
                              ? "Loading current turn members..."
                              : `View current turn members (${adminRowsCount})`}
                        </Text>
                        <Ionicons
                          name={
                            showAdminBreakdown ? "chevron-up" : "chevron-down"
                          }
                          size={16}
                          color={WHITE}
                        />
                      </TouchableOpacity>

                      {showAdminBreakdown ? (
                        <View style={{ marginTop: SPACING.md }}>
                          {adminRowsLoading ? (
                            <Text style={styles.sectionMiniText}>
                              Loading member payment status...
                            </Text>
                          ) : adminMemberRows.length ? (
                            <>
                              {paidRows.length ? (
                                <>
                                  <Text style={styles.sectionMiniText}>
                                    Paid members ({paidRows.length})
                                  </Text>
                                  {paidRows.map((row, idx) => (
                                    <AdminRowCard
                                      key={`paid-${row.due_id ?? idx}-${row.user_id ?? idx}-${row.seat_no ?? idx}`}
                                      row={row}
                                    />
                                  ))}
                                </>
                              ) : null}

                              {partialRows.length ? (
                                <>
                                  <Text
                                    style={[
                                      styles.sectionMiniText,
                                      { marginTop: SPACING.sm },
                                    ]}
                                  >
                                    Partially paid members ({partialRows.length})
                                  </Text>
                                  {partialRows.map((row, idx) => (
                                    <AdminRowCard
                                      key={`partial-${row.due_id ?? idx}-${row.user_id ?? idx}-${row.seat_no ?? idx}`}
                                      row={row}
                                    />
                                  ))}
                                </>
                              ) : null}

                              {unpaidRows.length ? (
                                <>
                                  <Text
                                    style={[
                                      styles.sectionMiniText,
                                      { marginTop: SPACING.sm },
                                    ]}
                                  >
                                    Unpaid members ({unpaidRows.length})
                                  </Text>
                                  {unpaidRows.map((row, idx) => (
                                    <AdminRowCard
                                      key={`unpaid-${row.due_id ?? idx}-${row.user_id ?? idx}-${row.seat_no ?? idx}`}
                                      row={row}
                                    />
                                  ))}
                                </>
                              ) : null}
                            </>
                          ) : (
                            <Text style={styles.sectionMiniText}>
                              Member rows could not be loaded. Pull down to refresh and try again.
                            </Text>
                          )}
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
              </SectionBlock>
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

  loadingText: {
    color: TEXT_SOFT,
    fontSize: 14,
    fontFamily: FONT.medium,
    marginTop: SPACING.md,
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
    fontSize: 24,
    fontFamily: FONT.bold,
  },

  pageSubTitle: {
    color: TEXT_SOFT,
    fontSize: 13,
    marginTop: 5,
    fontFamily: FONT.medium,
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
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  heroAmount: {
    color: WHITE,
    fontSize: 36,
    lineHeight: 42,
    fontFamily: FONT.bold,
    marginTop: 8,
  },

  heroHint: {
    color: TEXT_SOFT,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
    marginTop: 8,
  },

  sectionWrap: {
    marginBottom: SPACING.md,
  },

  sectionTitle: {
    color: WHITE,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: FONT.bold,
    marginBottom: SPACING.sm,
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
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  turnMeta: {
    color: TEXT_SOFT,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
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
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  summaryStatValue: {
    color: WHITE,
    fontSize: 19,
    lineHeight: 24,
    fontFamily: FONT.bold,
    marginTop: 6,
  },

  infoPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },

  infoPillText: {
    fontSize: 13,
    fontFamily: FONT.bold,
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
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
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
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  sectionMiniText: {
    color: TEXT_SOFT,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
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
    fontSize: 14,
    fontFamily: FONT.bold,
  },

  breakdownMeta: {
    color: TEXT_FAINT,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.medium,
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
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  breakdownMoneyValue: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusBadgeText: {
    fontSize: 12,
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
    fontSize: 15,
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