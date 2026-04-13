import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  fmtKES,
  getApiErrorMessage,
  getMerryDetail,
  getMerryPaymentBreakdown,
  MerryDetail,
  MerryPaymentBreakdownResponse,
} from "@/services/merry";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const BRAND_DARK = "#09586A";
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
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
const MERRY_ICON_BG = "rgba(236, 255, 235, 0.76)";
const MERRY_ICON = "#379B4A";

function toBool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(v)) return true;
    if (["0", "false", "no", "off"].includes(v)) return false;
  }
  return fallback;
}

function hasAmount(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0;
}

function statusTone(bucket?: string) {
  switch ((bucket || "").toLowerCase()) {
    case "overdue":
      return { bg: DANGER_BG, text: DANGER_TEXT, label: "Overdue" };
    case "current":
      return { bg: WARNING_BG, text: WARNING_TEXT, label: "Due now" };
    case "future":
      return { bg: SUCCESS_BG, text: SUCCESS_TEXT, label: "Next due" };
    default:
      return { bg: ACCENT_BG, text: ACCENT_TEXT, label: "Open" };
  }
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

function DueLine({
  item,
}: {
  item: MerryPaymentBreakdownResponse["items"][number];
}) {
  const tone = statusTone(item.bucket);

  return (
    <View style={styles.dueLine}>
      <View style={{ flex: 1, paddingRight: SPACING.sm }}>
        <View style={styles.dueLineTop}>
          <Text style={styles.dueLineTitle}>
            Seat {item.seat_no} • Slot {item.slot_no}
          </Text>
          <View style={[styles.dueBadge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.dueBadgeText, { color: tone.text }]}>
              {tone.label}
            </Text>
          </View>
        </View>

        <Text style={styles.dueLineSub}>
          {item.period_key}
          {item.due_date ? ` • ${item.due_date}` : ""}
        </Text>
      </View>

      <Text style={styles.dueLineAmount}>{fmtKES(item.outstanding)}</Text>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>
        {value == null || value === "" ? "—" : String(value)}
      </Text>
    </View>
  );
}

function InfoStrip({
  icon,
  text,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "neutral" | "warning" | "danger" | "success";
}) {
  const toneStyle =
    tone === "warning"
      ? { bg: WARNING_BG, border: "rgba(245,158,11,0.22)", color: WARNING_TEXT }
      : tone === "danger"
        ? { bg: DANGER_BG, border: "rgba(239,68,68,0.22)", color: DANGER_TEXT }
        : tone === "success"
          ? { bg: SUCCESS_BG, border: "rgba(34,197,94,0.22)", color: SUCCESS_TEXT }
          : { bg: SOFT_WHITE, border: SURFACE_BORDER, color: TEXT_ON_DARK };

  return (
    <View
      style={[
        styles.infoStrip,
        { backgroundColor: toneStyle.bg, borderColor: toneStyle.border },
      ]}
    >
      <Ionicons name={icon} size={16} color={toneStyle.color} />
      <Text style={[styles.infoStripText, { color: toneStyle.color }]}>
        {text}
      </Text>
    </View>
  );
}

export default function MerryDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; includeNext?: string }>();
  const merryId = Number(params.id);
  const initialIncludeNext = toBool(params.includeNext, false);

  const [user, setUser] = useState<MerryUser | null>(null);
  const [detail, setDetail] = useState<MerryDetail | null>(null);
  const [breakdown, setBreakdown] =
    useState<MerryPaymentBreakdownResponse | null>(null);

  const [includeNext, setIncludeNext] = useState(initialIncludeNext);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);

  const [error, setError] = useState("");
  const [breakdownError, setBreakdownError] = useState("");

  const loadBreakdown = useCallback(
    async (includeNextValue: boolean, showPop = false) => {
      if (!merryId || Number.isNaN(merryId)) return;

      try {
        setBreakdownError("");
        const breakdownRes = await getMerryPaymentBreakdown(
          merryId,
          includeNextValue
        );
        setBreakdown(breakdownRes);
      } catch (e: any) {
        const message =
          getApiErrorMessage(e) ||
          getErrorMessage(e) ||
          "Unable to load contribution summary.";
        setBreakdown(null);
        setBreakdownError(message);

        if (showPop) {
          Alert.alert("Contribution summary unavailable", message);
        }
      }
    },
    [merryId]
  );

  const load = useCallback(
    async (includeNextValue = includeNext, showBreakdownPop = false) => {
      if (!merryId || Number.isNaN(merryId)) {
        setError("Invalid merry selected.");
        setDetail(null);
        setBreakdown(null);
        setBreakdownError("");
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
          setBreakdown(null);
          setBreakdownError("");
          setError(
            getApiErrorMessage(detailRes.reason) ||
              getErrorMessage(detailRes.reason)
          );
          return;
        }

        const nextDetail = detailRes.value;
        setDetail(nextDetail);

        if (nextDetail.is_member) {
          await loadBreakdown(includeNextValue, showBreakdownPop);
        } else {
          setBreakdown(null);
          setBreakdownError("");
        }
      } catch (e: any) {
        setDetail(null);
        setBreakdown(null);
        setBreakdownError("");
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      }
    },
    [includeNext, loadBreakdown, merryId]
  );

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load(initialIncludeNext, false);
      setIncludeNext(initialIncludeNext);
    } finally {
      setLoading(false);
    }
  }, [initialIncludeNext, load]);

  useFocusEffect(
    useCallback(() => {
      initialLoad();
    }, [initialLoad])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(includeNext, false);
    } finally {
      setRefreshing(false);
    }
  }, [includeNext, load]);

  const onToggleIncludeNext = useCallback(
    async (value: boolean) => {
      if (!detail?.is_member) return;
      try {
        setToggling(true);
        setIncludeNext(value);
        await load(value, true);
      } finally {
        setToggling(false);
      }
    },
    [detail?.is_member, load]
  );

  const isMember = !!detail?.is_member;
  const joinStatus = detail?.my_join_request?.status || null;
  const canRequestJoin = !!detail?.can_request_join && !isMember;

  const rawSelectedAmount = useMemo(() => {
    if (!isMember || !breakdown) return "0.00";
    return includeNext ? breakdown.pay_with_next : breakdown.required_now;
  }, [breakdown, includeNext, isMember]);

  const walletBalance = useMemo(() => {
    if (!isMember) return 0;
    return Number(breakdown?.wallet_balance || 0) || 0;
  }, [breakdown, isMember]);

  const payableAfterWallet = useMemo(() => {
    if (!isMember || !breakdown) return 0;

    if (!includeNext && breakdown.net_required_now_after_wallet != null) {
      const n = Number(breakdown.net_required_now_after_wallet || 0);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    const gross = Number(rawSelectedAmount || 0);
    if (!Number.isFinite(gross)) return 0;
    return Math.max(0, gross - walletBalance);
  }, [breakdown, includeNext, isMember, rawSelectedAmount, walletBalance]);

  const canPaySelected = isMember && hasAmount(payableAfterWallet);
  const groupedPreview = useMemo(
    () => (isMember && breakdown?.items?.length ? breakdown.items : []),
    [breakdown, isMember]
  );

  const title = breakdown?.merry_name || detail?.name || "Merry";
  const seatCount = isMember
    ? breakdown?.seat_count ?? 0
    : detail?.members_count ?? 0;
  const seatNumbers = isMember ? breakdown?.seat_numbers ?? [] : [];
  const contributionPerSeat =
    breakdown?.amount_per_seat || detail?.contribution_amount || "0.00";

  const availableSeatText = useMemo(() => {
    if (detail?.available_seats == null) return "Unlimited seats";
    return `${detail.available_seats} seat${detail.available_seats === 1 ? "" : "s"} left`;
  }, [detail?.available_seats]);

  const membershipLabel = useMemo(() => {
    if (isMember) return "Joined";
    if (joinStatus === "PENDING") return "Join request pending";
    if (joinStatus === "APPROVED") return "Approved";
    if (joinStatus === "REJECTED") return "Request rejected";
    if (canRequestJoin) return "Open to join";
    if (detail?.is_open === false) return "Closed";
    return "View merry";
  }, [canRequestJoin, detail?.is_open, isMember, joinStatus]);

  const nextContributionDate = useMemo(() => {
    if (breakdown?.next_due_date) return breakdown.next_due_date;

    const nextFutureItem = breakdown?.items?.find(
      (item) =>
        String(item.bucket || "").toLowerCase() === "future" && item.due_date
    );

    return nextFutureItem?.due_date || null;
  }, [breakdown]);

  const goToDeposit = useCallback(() => {
    router.replace({
      pathname: "/(tabs)/payments/deposit" as any,
      params: {
        source: "merry",
        merryId: String(merryId),
        amount: String(payableAfterWallet || rawSelectedAmount || 0),
        editableAmount: "true",
      },
    });
  }, [merryId, payableAfterWallet, rawSelectedAmount]);

  const openMembers = useCallback(() => {
    router.push({
      pathname: "/(tabs)/merry/members" as any,
      params: { merryId: String(merryId) },
    });
  }, [merryId]);

  if (!loading && (!merryId || Number.isNaN(merryId))) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Invalid merry"
            subtitle="The selected merry could not be opened."
            actionLabel="Go Back"
            onAction={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !user) {
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

  if (!loading && !detail) {
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
              <Ionicons name="people-outline" size={22} color={WHITE} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                MERRY <Text style={styles.brandWordmarkGreen}>DETAILS</Text>
              </Text>
              <Text style={styles.brandSub}>Community sharing space</Text>
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
              onPress={() => router.back()}
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

          <Text style={styles.heroTag}>COMMUNITY MERRY</Text>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageSubtitle}>
            {isMember
              ? `${seatCount} seat${seatCount === 1 ? "" : "s"}${
                  seatNumbers.length ? ` • ${seatNumbers.join(", ")}` : ""
                }`
              : `${detail?.payouts_per_period || 1} slot${
                  Number(detail?.payouts_per_period || 1) === 1 ? "" : "s"
                } per period • ${availableSeatText}`}
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="Members"
              value={String(detail?.members_count ?? 0)}
              icon="people-outline"
            />
            <SummaryTile
              label="Seats"
              value={String(detail?.seats_count ?? 0)}
              icon="grid-outline"
            />
            <SummaryTile
              label={isMember ? "Ready now" : "Per seat"}
              value={
                isMember
                  ? fmtKES(payableAfterWallet)
                  : fmtKES(detail?.contribution_amount)
              }
              icon="wallet-outline"
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons name="alert-circle-outline" size={18} color={DANGER_TEXT} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        {breakdownError && isMember ? (
          <View style={{ marginBottom: SPACING.md }}>
            <InfoStrip
              icon="warning-outline"
              text={`Contribution summary is not available right now. ${breakdownError}`}
              tone="warning"
            />
          </View>
        ) : null}

        <View style={styles.glassCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconWrap}>
              <Ionicons
                name={isMember ? "cash-outline" : "sparkles-outline"}
                size={18}
                color={BRAND}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>
                {isMember ? "Your merry contribution" : "About this merry"}
              </Text>
              <Text style={styles.sectionCardSubtitle}>
                {isMember
                  ? "See what is currently needed and continue contributing when ready."
                  : "Review this merry space and decide your next step."}
              </Text>
            </View>
          </View>

          {isMember ? (
            <>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={canPaySelected ? goToDeposit : undefined}
                style={[
                  styles.amountPanel,
                  canPaySelected ? styles.amountPanelPressable : null,
                ]}
              >
                <View style={styles.amountPanelTop}>
                  <Text style={styles.amountPanelLabel}>
                    {includeNext ? "Selected total" : "Required now"}
                  </Text>

                  {canPaySelected ? (
                    <View style={styles.amountPanelAction}>
                      <Text style={styles.amountPanelActionText}>Contribute</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={WHITE}
                      />
                    </View>
                  ) : null}
                </View>

                <Text style={styles.amountPanelValue}>
                  {fmtKES(rawSelectedAmount)}
                </Text>

                <View style={styles.panelDivider} />

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Wallet balance</Text>
                  <Text style={styles.kvValue}>{fmtKES(walletBalance)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={[styles.kvLabel, styles.strongText]}>
                    You pay now
                  </Text>
                  <Text style={[styles.kvValue, styles.strongText]}>
                    {fmtKES(payableAfterWallet)}
                  </Text>
                </View>

                {nextContributionDate ? (
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Next contribution</Text>
                    <Text style={styles.kvValue}>{nextContributionDate}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <View style={styles.actionRow}>
                <Button
                  title={canPaySelected ? "Contribute" : "Covered by Wallet"}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/merry/contribute" as any,
                      params: { merryId: String(merryId) },
                    })
                  }
                  disabled={!canPaySelected}
                  style={{ flex: 1 }}
                />
                <View style={{ width: SPACING.sm }} />
                <Button
                  title="History"
                  variant="secondary"
                  onPress={() => router.push(ROUTES.tabs.merryPayments as any)}
                  style={{ flex: 1 }}
                />
              </View>

              <View style={{ height: SPACING.sm }} />

              <Button
                title="View Members"
                variant="secondary"
                onPress={openMembers}
              />
            </>
          ) : (
            <>
              <View style={styles.amountPanel}>
                <Text style={styles.amountPanelLabel}>Contribution per seat</Text>
                <Text style={styles.amountPanelValue}>
                  {fmtKES(detail?.contribution_amount)}
                </Text>

                <View style={styles.panelDivider} />

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Status</Text>
                  <Text style={styles.kvValue}>{membershipLabel}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Cycle duration</Text>
                  <Text style={styles.kvValue}>
                    {detail?.cycle_duration_weeks} week
                    {Number(detail?.cycle_duration_weeks) === 1 ? "" : "s"}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: SPACING.md }}>
                <Button
                  title="View Members"
                  variant="secondary"
                  onPress={openMembers}
                />
              </View>
            </>
          )}
        </View>

        {isMember ? (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.sectionSubtitle}>
              Quick view of your merry contribution position.
            </Text>

            <View style={styles.summaryRow}>
              <SummaryTile
                label="Overdue"
                value={fmtKES(breakdown?.overdue)}
                icon="warning-outline"
              />
              <SummaryTile
                label="Due now"
                value={fmtKES(breakdown?.current_due)}
                icon="calendar-outline"
              />
              <SummaryTile
                label="Next due"
                value={fmtKES(breakdown?.next_due)}
                icon="arrow-forward-circle-outline"
              />
            </View>

            <View style={{ height: SPACING.sm }} />

            <View style={styles.summaryRow}>
              <SummaryTile
                label="Per seat"
                value={fmtKES(contributionPerSeat)}
                icon="grid-outline"
              />
              <SummaryTile
                label="Wallet"
                value={fmtKES(walletBalance)}
                icon="wallet-outline"
              />
              <SummaryTile
                label="You pay now"
                value={fmtKES(payableAfterWallet)}
                icon="cash-outline"
              />
            </View>

            {nextContributionDate ? (
              <View style={{ marginTop: SPACING.md, marginBottom: SPACING.lg }}>
                <InfoStrip
                  icon="time-outline"
                  text={`Next contribution date: ${nextContributionDate}`}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {isMember ? (
          <Section title="Option">
            <Card style={styles.glassCard} variant="default">
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="options-outline" size={18} color={BRAND} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionCardTitle}>Include next due</Text>
                  <Text style={styles.sectionCardSubtitle}>
                    Add the next contribution to this summary.
                  </Text>
                </View>

                <Switch
                  value={includeNext}
                  onValueChange={onToggleIncludeNext}
                  disabled={toggling || !!breakdownError}
                  thumbColor={COLORS.white}
                  trackColor={{
                    false: "rgba(255,255,255,0.18)",
                    true: BRAND_DARK,
                  }}
                />
              </View>

              {breakdown?.next_due_date ? (
                <Text style={styles.hintText}>
                  Next due date: {breakdown.next_due_date}
                </Text>
              ) : null}

              <View style={{ marginTop: SPACING.md }}>
                <InfoStrip
                  icon="information-circle-outline"
                  text="Your merry wallet is deducted first before new payment is needed."
                />
              </View>
            </Card>
          </Section>
        ) : (
          <Section title="Join">
            <Card style={styles.glassCard} variant="default">
              <Text style={styles.sectionCardTitle}>Join this merry</Text>
              <Text style={styles.sectionCardSubtitle}>
                Request seats and send your request to the admin for approval.
              </Text>

              <View style={{ height: SPACING.md }} />

              {joinStatus === "PENDING" ? (
                <Button
                  title="Request Pending"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/merry/join-request" as any,
                      params: { merryId: String(merryId) },
                    })
                  }
                />
              ) : canRequestJoin ? (
                <Button
                  title="Join Merry"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/merry/join-request" as any,
                      params: { merryId: String(merryId) },
                    })
                  }
                />
              ) : (
                <Button
                  title={detail?.is_open === false ? "Merry Closed" : "Unavailable"}
                  disabled
                  onPress={() => {}}
                />
              )}

              <View style={{ height: SPACING.sm }} />

              <Text style={styles.helperText}>
                Seats available: {availableSeatText}
              </Text>
              <Text style={styles.helperText}>
                Contribution: {fmtKES(detail?.contribution_amount)}
              </Text>

              {joinStatus === "PENDING" ? (
                <View style={{ marginTop: SPACING.md }}>
                  <InfoStrip
                    icon="time-outline"
                    text="Your join request has already been sent and is waiting for admin approval."
                    tone="warning"
                  />
                </View>
              ) : null}

              {joinStatus === "REJECTED" ? (
                <View style={{ marginTop: SPACING.md }}>
                  <InfoStrip
                    icon="close-circle-outline"
                    text="Your previous join request was rejected. You can submit another request if joining is still allowed."
                    tone="danger"
                  />
                </View>
              ) : null}
            </Card>
          </Section>
        )}

        <Section title="Included items">
          {!isMember ? (
            <Card style={styles.glassCard} variant="default">
              <EmptyState
                icon="receipt-outline"
                title="Contribution items appear after joining"
                subtitle="Once you become a member, your payable merry items will show here."
              />
            </Card>
          ) : !groupedPreview.length ? (
            <Card style={styles.glassCard} variant="default">
              <EmptyState
                icon="receipt-outline"
                title={
                  breakdownError
                    ? "Contribution summary unavailable"
                    : "Nothing open right now"
                }
                subtitle={
                  breakdownError
                    ? "Merry details are available, but the contribution summary could not be loaded."
                    : "This merry has no payable items at the moment."
                }
              />
            </Card>
          ) : (
            <Card style={styles.glassCard} variant="default">
              {groupedPreview.map((item, index) => (
                <View key={`due-${item.due_id}`}>
                  <DueLine item={item} />
                  {index < groupedPreview.length - 1 ? (
                    <View style={styles.lineDivider} />
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        </Section>

        <Section title="Details">
          <Card style={styles.glassCard} variant="default">
            <DetailRow
              label="Contribution per seat"
              value={fmtKES(detail?.contribution_amount)}
            />
            <DetailRow label="Frequency" value={detail?.payout_frequency} />
            <DetailRow
              label="Slots per period"
              value={detail?.payouts_per_period}
            />
            <DetailRow label="Next payout" value={detail?.next_payout_date} />
            <DetailRow
              label="Cycle duration"
              value={`${detail?.cycle_duration_weeks ?? "—"} week${
                Number(detail?.cycle_duration_weeks ?? 0) === 1 ? "" : "s"
              }`}
            />
            <DetailRow label="Members" value={detail?.members_count} />
            <DetailRow label="Seats" value={detail?.seats_count} />
            {isMember ? (
              <>
                <DetailRow
                  label="Wallet balance"
                  value={fmtKES(walletBalance)}
                />
                <DetailRow
                  label="Payable after wallet"
                  value={fmtKES(payableAfterWallet)}
                />
                <DetailRow
                  label="Next contribution date"
                  value={nextContributionDate}
                />
              </>
            ) : (
              <DetailRow label="Available seats" value={availableSeatText} />
            )}

            {!isMember &&
            Array.isArray(detail?.available_seat_numbers) &&
            detail.available_seat_numbers.length > 0 ? (
              <View style={{ marginTop: SPACING.md }}>
                <InfoStrip
                  icon="grid-outline"
                  text={`Available seat numbers: ${detail.available_seat_numbers.join(", ")}`}
                />
              </View>
            ) : null}

            <View style={{ marginTop: SPACING.md }}>
              <Button
                title="View Members"
                variant="secondary"
                onPress={openMembers}
              />
            </View>
          </Card>
        </Section>

        <View style={styles.bottomActions}>
          <Button
            title="Back to Merry"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.merry as any)}
            style={{ flex: 1 }}
          />
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
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
    padding: 24,
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
    width: 40,
    height: 40,
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
    backgroundColor: "rgba(42, 206, 180, 0.16)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 60,
    bottom: -55,
    width: 210,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.15)",
  },

  heroTag: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontFamily: FONT.bold,
    letterSpacing: 1.2,
  },

  pageTitle: {
    color: WHITE,
    fontSize: 25,
    lineHeight: 34,
    fontFamily: FONT.bold,
    marginTop: 12,
  },

  pageSubtitle: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: "95%",
    fontFamily: FONT.regular,
  },

  summaryRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    flexWrap: "wrap",
  },

  summaryTile: {
    flex: 1,
    minWidth: 100,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHITE,
    marginBottom: 10,
    alignSelf: "flex-start",
  },

  summaryLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 11,
    fontFamily: FONT.medium,
  },

  summaryValue: {
    color: WHITE,
    fontSize: 16,
    marginTop: 6,
    fontFamily: FONT.bold,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: DANGER_BG,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    color: DANGER_TEXT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  glassCard: {
    backgroundColor: SURFACE_CARD,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: 22,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
  },

  sectionCardTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  sectionCardSubtitle: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  amountPanel: {
    marginTop: SPACING.md,
    backgroundColor: SOFT_WHITE_2,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
  },

  amountPanelPressable: {
    borderColor: "rgba(255,255,255,0.20)",
  },

  amountPanelTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  amountPanelLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  amountPanelAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  amountPanelActionText: {
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  amountPanelValue: {
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 8,
    fontFamily: FONT.bold,
  },

  panelDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: SPACING.md,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: 10,
  },

  kvLabel: {
    flex: 1,
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  kvValue: {
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.bold,
    textAlign: "right",
  },

  strongText: {
    color: WHITE,
    fontFamily: FONT.bold,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.md,
  },

  sectionTitle: {
    color: WHITE,
    fontSize: 17,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  sectionSubtitle: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: SPACING.md,
    fontFamily: FONT.regular,
  },

  hintText: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
  },

  helperText: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  infoStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  infoStripText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  dueLine: {
    paddingVertical: SPACING.sm,
  },

  dueLineTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  dueLineTitle: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
    flex: 1,
  },

  dueLineSub: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  dueLineAmount: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
    marginTop: 8,
  },

  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  dueBadgeText: {
    fontSize: 11,
    fontFamily: FONT.medium,
  },

  lineDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: SPACING.sm,
  },

  bottomActions: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
});