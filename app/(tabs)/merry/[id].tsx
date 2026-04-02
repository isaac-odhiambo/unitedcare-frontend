import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { COLORS, FONT, SHADOW, SPACING } from "@/constants/theme";
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
const WHITE = "#FFFFFF";
const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
const SOFT_WHITE = "rgba(255,255,255,0.10)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const MERRY_CARD = "rgba(98, 192, 98, 0.23)";
const MERRY_BORDER = "rgba(194, 255, 188, 0.16)";
const MERRY_ICON_BG = "rgba(236, 255, 235, 0.76)";
const MERRY_ICON = "#379B4A";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const DANGER_BG = "rgba(239,68,68,0.18)";
const DANGER_TEXT = "#FECACA";
const ACCENT_BG = "rgba(12,106,128,0.20)";
const ACCENT_TEXT = "#D9F3F9";

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

function SummaryBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card style={styles.summaryBox} variant="default">
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={18} color={BRAND} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </Card>
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
  tone?: "neutral" | "warning" | "danger";
}) {
  const toneStyle =
    tone === "warning"
      ? {
          bg: WARNING_BG,
          border: "rgba(245,158,11,0.22)",
          color: WARNING_TEXT,
        }
      : tone === "danger"
        ? {
            bg: DANGER_BG,
            border: "rgba(239,68,68,0.22)",
            color: DANGER_TEXT,
          }
        : { bg: SOFT_WHITE, border: CARD_BORDER, color: TEXT_ON_DARK };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!merryId || Number.isNaN(merryId)) {
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

  if (!user) {
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

  if (!detail) {
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
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
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
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Card style={styles.heroCard} variant="default">
          <View style={styles.spaceGlowTop} />
          <View style={styles.spaceGlowBottom} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: SPACING.md }}>
              <Text style={styles.heroEyebrow}>MERRY</Text>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroSubtitle}>
                {isMember
                  ? `${seatCount} seat${seatCount === 1 ? "" : "s"}${
                      seatNumbers.length ? ` • ${seatNumbers.join(", ")}` : ""
                    }`
                  : `${detail.payouts_per_period || 1} slot${
                      Number(detail.payouts_per_period || 1) === 1 ? "" : "s"
                    } per period • ${availableSeatText}`}
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="people-outline" size={22} color={MERRY_ICON} />
            </View>
          </View>

          {isMember ? (
            <>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={canPaySelected ? goToDeposit : undefined}
                style={[
                  styles.heroAmountBox,
                  canPaySelected ? styles.heroAmountBoxPressable : null,
                ]}
              >
                <View style={styles.heroAmountTopRow}>
                  <Text style={styles.heroAmountLabel}>
                    {includeNext ? "Selected total" : "Required now"}
                  </Text>

                  {canPaySelected ? (
                    <View style={styles.heroAmountAction}>
                      <Text style={styles.heroAmountActionText}>Deposit</Text>
                      <Ionicons name="chevron-forward" size={14} color={WHITE} />
                    </View>
                  ) : null}
                </View>

                <Text style={styles.heroAmountValue}>
                  {fmtKES(rawSelectedAmount)}
                </Text>

                <View style={styles.heroMiniDivider} />

                <View style={styles.heroMiniRow}>
                  <Text style={styles.heroMiniLabel}>Wallet balance</Text>
                  <Text style={styles.heroMiniValue}>
                    {fmtKES(walletBalance)}
                  </Text>
                </View>

                <View style={styles.heroMiniRow}>
                  <Text style={[styles.heroMiniLabel, styles.heroMiniStrong]}>
                    You pay now
                  </Text>
                  <Text style={[styles.heroMiniValue, styles.heroMiniStrong]}>
                    {fmtKES(payableAfterWallet)}
                  </Text>
                </View>

                {nextContributionDate ? (
                  <View style={styles.heroMiniRow}>
                    <Text style={styles.heroMiniLabel}>Next contribution</Text>
                    <Text style={styles.heroMiniValue}>
                      {nextContributionDate}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <View style={styles.heroActions}>
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
                  title="Contribution Records"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: ROUTES.tabs.merryPayments as any,
                      params: { merryId: String(merryId) },
                    })
                  }
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
            <View style={styles.heroAmountBox}>
              <Text style={styles.heroAmountLabel}>Contribution per seat</Text>
              <Text style={styles.heroAmountValue}>
                {fmtKES(detail.contribution_amount)}
              </Text>

              <View style={styles.heroMiniDivider} />

              <View style={styles.heroMiniRow}>
                <Text style={styles.heroMiniLabel}>Status</Text>
                <Text style={styles.heroMiniValue}>{membershipLabel}</Text>
              </View>

              <View style={styles.heroMiniRow}>
                <Text style={styles.heroMiniLabel}>Cycle duration</Text>
                <Text style={styles.heroMiniValue}>
                  {detail.cycle_duration_weeks} week
                  {Number(detail.cycle_duration_weeks) === 1 ? "" : "s"}
                </Text>
              </View>

              <View style={{ marginTop: SPACING.md }}>
                <Button
                  title="View Members"
                  variant="secondary"
                  onPress={openMembers}
                />
              </View>
            </View>
          )}
        </Card>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons name="alert-circle-outline" size={18} color="#FECACA" />
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

        {isMember ? (
          <>
            <Section title="Summary">
              <View style={styles.summaryGrid}>
                <SummaryBox
                  label="Overdue"
                  value={fmtKES(breakdown?.overdue)}
                  icon="warning-outline"
                />
                <View style={{ width: SPACING.sm }} />
                <SummaryBox
                  label="Due now"
                  value={fmtKES(breakdown?.current_due)}
                  icon="calendar-outline"
                />
              </View>

              <View style={{ height: SPACING.sm }} />

              <View style={styles.summaryGrid}>
                <SummaryBox
                  label="Next due"
                  value={fmtKES(breakdown?.next_due)}
                  icon="arrow-forward-circle-outline"
                />
                <View style={{ width: SPACING.sm }} />
                <SummaryBox
                  label="Per seat"
                  value={fmtKES(contributionPerSeat)}
                  icon="grid-outline"
                />
              </View>

              <View style={{ height: SPACING.sm }} />

              <View style={styles.summaryGrid}>
                <SummaryBox
                  label="Wallet"
                  value={fmtKES(walletBalance)}
                  icon="wallet-outline"
                />
                <View style={{ width: SPACING.sm }} />
                <SummaryBox
                  label="You pay now"
                  value={fmtKES(payableAfterWallet)}
                  icon="cash-outline"
                />
              </View>

              {nextContributionDate ? (
                <View style={{ marginTop: SPACING.sm }}>
                  <InfoStrip
                    icon="time-outline"
                    text={`Next contribution date: ${nextContributionDate}`}
                  />
                </View>
              ) : null}
            </Section>

            <Section title="Option">
              <Card style={styles.optionCard} variant="default">
                <View style={styles.optionTop}>
                  <View style={{ flex: 1, paddingRight: SPACING.md }}>
                    <Text style={styles.optionTitle}>Include next due</Text>
                    <Text style={styles.optionText}>
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
                      true: BRAND,
                    }}
                  />
                </View>

                {breakdown?.next_due_date ? (
                  <Text style={styles.nextDueHint}>
                    Next due date: {breakdown.next_due_date}
                  </Text>
                ) : null}

                <View style={styles.optionInfoBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={18}
                    color={WHITE}
                  />
                  <Text style={styles.optionInfoText}>
                    Your merry wallet is deducted first before new payment is
                    needed.
                  </Text>
                </View>
              </Card>
            </Section>

            <Section title="Included items">
              {!groupedPreview.length ? (
                <Card style={styles.emptyCard} variant="default">
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
                <Card style={styles.listCard} variant="default">
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
          </>
        ) : (
          <Section title="Join">
            <Card style={styles.ctaCard} variant="default">
              <Text style={styles.ctaTitle}>Join this merry</Text>
              <Text style={styles.ctaText}>
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
                  title={detail.is_open === false ? "Merry Closed" : "Unavailable"}
                  disabled
                  onPress={() => {}}
                />
              )}

              <View style={{ height: SPACING.sm }} />

              <Text style={styles.helperText}>
                Seats available: {availableSeatText}
              </Text>

              <Text style={styles.helperText}>
                Contribution: {fmtKES(detail.contribution_amount)}
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

        <Section title="Details">
          <Card style={styles.detailsCard} variant="default">
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
            Array.isArray(detail.available_seat_numbers) &&
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
    padding: SPACING.md,
    position: "relative",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
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

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: MERRY_CARD,
    borderWidth: 1,
    borderColor: MERRY_BORDER,
    marginBottom: SPACING.lg,
    borderRadius: 24,
    ...SHADOW.card,
  },

  spaceGlowTop: {
    position: "absolute",
    top: -18,
    right: -10,
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  spaceGlowBottom: {
    position: "absolute",
    bottom: -24,
    left: -8,
    width: 120,
    height: 70,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroEyebrow: {
    color: "#D8FFF0",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  heroTitle: {
    color: WHITE,
    fontSize: 24,
    lineHeight: 30,
    marginTop: 6,
    fontFamily: FONT.bold,
  },

  heroSubtitle: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    fontFamily: FONT.regular,
  },

  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: MERRY_ICON_BG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroAmountBox: {
    marginTop: SPACING.lg,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    padding: SPACING.md,
  },

  heroAmountBoxPressable: {
    borderColor: "rgba(255,255,255,0.16)",
  },

  heroAmountTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  heroAmountLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  heroAmountAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  heroAmountActionText: {
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  heroAmountValue: {
    color: WHITE,
    fontSize: 28,
    lineHeight: 34,
    marginTop: 8,
    fontFamily: FONT.bold,
  },

  heroMiniDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: SPACING.md,
  },

  heroMiniRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginTop: 6,
  },

  heroMiniLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  heroMiniValue: {
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  heroMiniStrong: {
    fontFamily: FONT.bold,
    color: WHITE,
  },

  heroActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    backgroundColor: DANGER_BG,
  },

  errorText: {
    flex: 1,
    color: "#FECACA",
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  summaryGrid: {
    flexDirection: "row",
  },

  summaryBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
  },

  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WHITE,
    marginBottom: 10,
  },

  summaryLabel: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  summaryValue: {
    color: WHITE,
    fontSize: 16,
    marginTop: 6,
    fontFamily: FONT.bold,
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

  optionCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  optionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  optionTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  optionText: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  nextDueHint: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    marginTop: SPACING.md,
    fontFamily: FONT.medium,
  },

  optionInfoBox: {
    marginTop: SPACING.md,
    borderRadius: 16,
    padding: SPACING.md,
    backgroundColor: ACCENT_BG,
    flexDirection: "row",
    gap: SPACING.sm,
  },

  optionInfoText: {
    flex: 1,
    color: WHITE,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  listCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  dueLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm,
  },

  dueLineTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  dueLineTitle: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.medium,
  },

  dueLineSub: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 11,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  dueBadgeText: {
    fontSize: 10,
    fontFamily: FONT.bold,
  },

  dueLineAmount: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  lineDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: SPACING.xs,
  },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  ctaCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  ctaTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  ctaText: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  helperText: {
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    marginTop: 6,
    fontFamily: FONT.regular,
  },

  detailsCard: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 20,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  kvLabel: {
    flex: 1,
    color: TEXT_ON_DARK_SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  kvValue: {
    flex: 1,
    textAlign: "right",
    color: WHITE,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  bottomActions: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
});