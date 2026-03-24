// app/(tabs)/merry/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, RADIUS, SPACING, TYPE } from "@/constants/theme";
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

const UI = {
  bg: "#EEF3F6",
  surface: "#F8FBFC",
  surfaceAlt: "#F3F7F9",
  card: "#F9FBFC",
  border: "#D8E2E8",
  text: "#344454",
  textSoft: "#607080",
  textMuted: "#7B8997",
  accent: "#5C7383",
  accentSoft: "#E5EDF2",
  successBg: "#EAF5EE",
  successText: "#466B58",
  warningBg: "#FFF3E6",
  warningText: "#9A6A33",
  dangerBg: "#FDEEEF",
  dangerText: "#A45555",
};

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
      return {
        bg: UI.dangerBg,
        text: UI.dangerText,
        label: "Overdue",
      };
    case "current":
      return {
        bg: UI.warningBg,
        text: UI.warningText,
        label: "Due now",
      };
    case "future":
      return {
        bg: UI.successBg,
        text: UI.successText,
        label: "Next due",
      };
    default:
      return {
        bg: UI.accentSoft,
        text: UI.accent,
        label: "Open",
      };
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
        <Ionicons name={icon} size={18} color={UI.accent} />
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
      ? { bg: UI.warningBg, border: "#F0DEC9", color: UI.warningText }
      : tone === "danger"
        ? { bg: UI.dangerBg, border: "#EBCBCF", color: UI.dangerText }
        : { bg: UI.accentSoft, border: UI.border, color: UI.text };

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

  const load = useCallback(
    async (includeNextValue = includeNext) => {
      if (!merryId || Number.isNaN(merryId)) {
        setError("Invalid merry selected.");
        setDetail(null);
        setBreakdown(null);
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
          setError(
            getApiErrorMessage(detailRes.reason) ||
              getErrorMessage(detailRes.reason)
          );
          return;
        }

        const nextDetail = detailRes.value;
        setDetail(nextDetail);

        if (nextDetail.is_member) {
          const breakdownRes = await getMerryPaymentBreakdown(
            merryId,
            includeNextValue
          );
          setBreakdown(breakdownRes);
        } else {
          setBreakdown(null);
        }
      } catch (e: any) {
        setDetail(null);
        setBreakdown(null);
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      }
    },
    [includeNext, merryId]
  );

  const initialLoad = useCallback(async () => {
    try {
      setLoading(true);
      await load(initialIncludeNext);
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
      await load(includeNext);
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
        await load(value);
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

  const groupedPreview = useMemo(() => {
    return isMember && breakdown?.items?.length ? breakdown.items : [];
  }, [breakdown, isMember]);

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

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={UI.accent} />
      </View>
    );
  }

  if (!merryId || Number.isNaN(merryId)) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Invalid merry"
          subtitle="The selected merry could not be opened."
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to continue."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Unable to load merry"
          subtitle={error || "This merry could not be loaded."}
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry as any)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      <Card style={styles.heroCard} variant="default">
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>MERRY</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>
              {isMember
                ? `${seatCount} seat${seatCount === 1 ? "" : "s"}${seatNumbers.length ? ` • ${seatNumbers.join(", ")}` : ""}`
                : `${detail.payouts_per_period || 1} slot${Number(detail.payouts_per_period || 1) === 1 ? "" : "s"} per period • ${availableSeatText}`}
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color={UI.accent} />
          </View>
        </View>

        {isMember ? (
          <>
            <View style={styles.heroAmountBox}>
              <Text style={styles.heroAmountLabel}>
                {includeNext ? "Selected total" : "Required now"}
              </Text>
              <Text style={styles.heroAmountValue}>{fmtKES(rawSelectedAmount)}</Text>

              <View style={styles.heroMiniDivider} />

              <View style={styles.heroMiniRow}>
                <Text style={styles.heroMiniLabel}>Wallet balance</Text>
                <Text style={styles.heroMiniValue}>{fmtKES(walletBalance)}</Text>
              </View>

              <View style={styles.heroMiniRow}>
                <Text style={[styles.heroMiniLabel, styles.heroMiniStrong]}>
                  You pay now
                </Text>
                <Text style={[styles.heroMiniValue, styles.heroMiniStrong]}>
                  {fmtKES(payableAfterWallet)}
                </Text>
              </View>
            </View>

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
                title="History"
                variant="secondary"
                onPress={() => router.push(ROUTES.tabs.merryPayments as any)}
                style={{ flex: 1 }}
              />
            </View>
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
          </View>
        )}
      </Card>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={UI.dangerText}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
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
                  disabled={toggling}
                  thumbColor={COLORS.white}
                  trackColor={{
                    false: "#C9D3DA",
                    true: UI.accent,
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
                  color={UI.accent}
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
              <EmptyState
                icon="receipt-outline"
                title="Nothing open now"
                subtitle="This merry has no payable items at the moment."
              />
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
        <>
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
        </>
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
            value={`${detail?.cycle_duration_weeks ?? "—"} week${Number(detail?.cycle_duration_weeks ?? 0) === 1 ? "" : "s"}`}
          />
          <DetailRow label="Members" value={detail?.members_count} />
          <DetailRow label="Seats" value={detail?.seats_count} />
          {isMember ? (
            <>
              <DetailRow label="Wallet balance" value={fmtKES(walletBalance)} />
              <DetailRow
                label="Payable after wallet"
                value={fmtKES(payableAfterWallet)}
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

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.bg,
  },

  heroCard: {
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderRadius: 24,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: UI.textMuted,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    ...TYPE.h2,
    color: UI.text,
    marginTop: 6,
    fontWeight: "900",
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 8,
    lineHeight: 19,
  },

  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: UI.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  heroAmountBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
  },

  heroAmountLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
    fontWeight: "700",
  },

  heroAmountValue: {
    ...(TYPE as any).h1 ? (TYPE as any).h1 : TYPE.h2,
    color: UI.text,
    marginTop: 6,
    fontWeight: "900",
  },

  heroMiniDivider: {
    height: 1,
    backgroundColor: UI.border,
    marginVertical: SPACING.sm,
  },

  heroMiniRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    gap: SPACING.md,
  },

  heroMiniLabel: {
    ...TYPE.caption,
    color: UI.textSoft,
  },

  heroMiniValue: {
    ...TYPE.bodyStrong,
    color: UI.text,
    textAlign: "right",
    flexShrink: 1,
  },

  heroMiniStrong: {
    fontWeight: "900",
  },

  heroActions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "#EAC9CF",
    backgroundColor: UI.dangerBg,
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: UI.dangerText,
  },

  summaryGrid: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  summaryBox: {
    flex: 1,
    backgroundColor: UI.card,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 20,
  },

  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
    backgroundColor: UI.accentSoft,
  },

  summaryLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
    fontWeight: "700",
  },

  summaryValue: {
    ...TYPE.title,
    marginTop: 4,
    fontWeight: "900",
    color: UI.text,
  },

  optionCard: {
    backgroundColor: UI.card,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
  },

  optionTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  optionTitle: {
    ...TYPE.title,
    fontWeight: "900",
    color: UI.text,
  },

  optionText: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 4,
  },

  nextDueHint: {
    ...TYPE.caption,
    color: UI.accent,
    marginTop: SPACING.sm,
    fontWeight: "800",
  },

  optionInfoBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: UI.accentSoft,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  optionInfoText: {
    flex: 1,
    ...TYPE.subtext,
    color: UI.text,
  },

  listCard: {
    backgroundColor: UI.card,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
  },

  dueLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
  },

  dueLineTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },

  dueLineTitle: {
    ...TYPE.bodyStrong,
    fontWeight: "800",
    color: UI.text,
  },

  dueLineSub: {
    ...TYPE.caption,
    color: UI.textMuted,
    marginTop: 4,
  },

  dueLineAmount: {
    ...TYPE.bodyStrong,
    fontWeight: "900",
    color: UI.text,
  },

  dueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
  },

  dueBadgeText: {
    ...TYPE.caption,
    fontWeight: "800",
  },

  lineDivider: {
    height: 1,
    backgroundColor: UI.border,
    marginVertical: SPACING.sm,
  },

  detailsCard: {
    backgroundColor: UI.card,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
  },

  ctaCard: {
    backgroundColor: UI.card,
    padding: SPACING.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: UI.border,
  },

  ctaTitle: {
    ...TYPE.title,
    color: UI.text,
    fontWeight: "900",
  },

  ctaText: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 6,
    lineHeight: 20,
  },

  helperText: {
    ...TYPE.caption,
    color: UI.textMuted,
    marginTop: 6,
  },

  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
    marginTop: 10,
  },

  kvLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
  },

  kvValue: {
    ...TYPE.bodyStrong,
    color: UI.text,
    textAlign: "right",
    flexShrink: 1,
  },

  infoStrip: {
    padding: SPACING.md,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
  },

  infoStripText: {
    flex: 1,
    ...TYPE.subtext,
  },

  bottomActions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});