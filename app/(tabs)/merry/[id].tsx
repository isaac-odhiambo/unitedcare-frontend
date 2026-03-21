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
        bg: COLORS.dangerSoft,
        text: COLORS.danger,
        label: "Overdue",
      };
    case "current":
      return {
        bg: COLORS.warningSoft,
        text: COLORS.warning,
        label: "Due now",
      };
    case "future":
      return {
        bg: COLORS.successSoft,
        text: COLORS.success,
        label: "Next due",
      };
    default:
      return {
        bg: COLORS.primarySoft,
        text: COLORS.primary,
        label: "Open",
      };
  }
}

function SummaryBox({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "warning" | "danger" | "success";
}) {
  const tones = {
    primary: {
      bg: COLORS.primarySoft,
      icon: COLORS.primary,
      border: "rgba(14, 94, 111, 0.10)",
    },
    warning: {
      bg: COLORS.warningSoft,
      icon: COLORS.warning,
      border: "rgba(245, 158, 11, 0.10)",
    },
    danger: {
      bg: COLORS.dangerSoft,
      icon: COLORS.danger,
      border: "rgba(239, 68, 68, 0.10)",
    },
    success: {
      bg: COLORS.successSoft,
      icon: COLORS.success,
      border: "rgba(34, 197, 94, 0.10)",
    },
  };

  const t = tones[tone];

  return (
    <Card style={[styles.summaryBox, { borderColor: t.border }]} variant="default">
      <View style={[styles.summaryIconWrap, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={18} color={t.icon} />
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

        const [sessionRes, meRes, detailRes, breakdownRes] =
          await Promise.allSettled([
            getSessionUser(),
            getMe(),
            getMerryDetail(merryId),
            getMerryPaymentBreakdown(merryId, includeNextValue),
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

        let nextError = "";

        if (detailRes.status === "fulfilled") {
          setDetail(detailRes.value);
        } else {
          setDetail(null);
          nextError =
            getApiErrorMessage(detailRes.reason) ||
            getErrorMessage(detailRes.reason);
        }

        if (breakdownRes.status === "fulfilled") {
          setBreakdown(breakdownRes.value);
        } else {
          setBreakdown(null);
          if (!nextError) {
            nextError =
              getApiErrorMessage(breakdownRes.reason) ||
              getErrorMessage(breakdownRes.reason);
          }
        }

        if (nextError) setError(nextError);
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
      try {
        setToggling(true);
        setIncludeNext(value);
        await load(value);
      } finally {
        setToggling(false);
      }
    },
    [load]
  );

  const rawSelectedAmount = useMemo(() => {
    if (!breakdown) return "0.00";
    return includeNext ? breakdown.pay_with_next : breakdown.required_now;
  }, [breakdown, includeNext]);

  const walletBalance = useMemo(() => {
    return Number(breakdown?.wallet_balance || 0) || 0;
  }, [breakdown]);

  const payableAfterWallet = useMemo(() => {
    if (!breakdown) return 0;

    if (!includeNext && breakdown.net_required_now_after_wallet != null) {
      const n = Number(breakdown.net_required_now_after_wallet || 0);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    }

    const gross = Number(rawSelectedAmount || 0);
    if (!Number.isFinite(gross)) return 0;
    return Math.max(0, gross - walletBalance);
  }, [breakdown, includeNext, rawSelectedAmount, walletBalance]);

  const canPaySelected = hasAmount(payableAfterWallet);

  const groupedPreview = useMemo(() => {
    return breakdown?.items?.length ? breakdown.items : [];
  }, [breakdown]);

  const title = breakdown?.merry_name || detail?.name || "Merry";
  const seatCount = breakdown?.seat_count ?? 0;
  const seatNumbers = breakdown?.seat_numbers ?? [];
  const contributionPerSeat = breakdown?.amount_per_seat || detail?.contribution_amount;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
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

  if (!detail && !breakdown) {
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
      <Card style={styles.heroCard} variant="elevated">
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: SPACING.md }}>
            <Text style={styles.heroEyebrow}>MERRY</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSubtitle}>
              {seatCount} seat{seatCount === 1 ? "" : "s"}
              {seatNumbers.length ? ` • ${seatNumbers.join(", ")}` : ""}
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="repeat-outline" size={22} color={COLORS.white} />
          </View>
        </View>

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
      </Card>

      {error ? (
        <Card style={styles.errorCard} variant="default">
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Summary">
        <View style={styles.summaryGrid}>
          <SummaryBox
            label="Overdue"
            value={fmtKES(breakdown?.overdue)}
            icon="warning-outline"
            tone="danger"
          />
          <View style={{ width: SPACING.sm }} />
          <SummaryBox
            label="Due now"
            value={fmtKES(breakdown?.current_due)}
            icon="calendar-outline"
            tone="warning"
          />
        </View>

        <View style={{ height: SPACING.sm }} />

        <View style={styles.summaryGrid}>
          <SummaryBox
            label="Next due"
            value={fmtKES(breakdown?.next_due)}
            icon="arrow-forward-circle-outline"
            tone="success"
          />
          <View style={{ width: SPACING.sm }} />
          <SummaryBox
            label="Per seat"
            value={fmtKES(contributionPerSeat)}
            icon="grid-outline"
            tone="primary"
          />
        </View>

        <View style={{ height: SPACING.sm }} />

        <View style={styles.summaryGrid}>
          <SummaryBox
            label="Wallet"
            value={fmtKES(walletBalance)}
            icon="wallet-outline"
            tone="success"
          />
          <View style={{ width: SPACING.sm }} />
          <SummaryBox
            label="You pay now"
            value={fmtKES(payableAfterWallet)}
            icon="cash-outline"
            tone={canPaySelected ? "primary" : "success"}
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
                false: COLORS.gray300,
                true: COLORS.primary,
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
              color={COLORS.primary}
            />
            <Text style={styles.optionInfoText}>
              Your merry wallet is deducted first before new payment is needed.
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

      <Section title="Details">
        <Card style={styles.detailsCard} variant="default">
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Contribution per seat</Text>
            <Text style={styles.kvValue}>
              {fmtKES(detail?.contribution_amount)}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Frequency</Text>
            <Text style={styles.kvValue}>
              {detail?.payout_frequency || "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Slots per period</Text>
            <Text style={styles.kvValue}>
              {detail?.payouts_per_period ?? "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Next payout</Text>
            <Text style={styles.kvValue}>
              {detail?.next_payout_date || "—"}
            </Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Wallet balance</Text>
            <Text style={styles.kvValue}>{fmtKES(walletBalance)}</Text>
          </View>

          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Payable after wallet</Text>
            <Text style={styles.kvValue}>{fmtKES(payableAfterWallet)}</Text>
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

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.md,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderWidth: 0,
    marginBottom: SPACING.lg,
    overflow: "hidden",
    borderRadius: 28,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroEyebrow: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.76)",
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  heroTitle: {
    ...TYPE.h2,
    color: COLORS.white,
    marginTop: 6,
    fontWeight: "900",
  },

  heroSubtitle: {
    ...TYPE.subtext,
    color: "rgba(255,255,255,0.84)",
    marginTop: 8,
    lineHeight: 19,
  },

  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroAmountBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  heroAmountLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.76)",
    fontWeight: "700",
  },

  heroAmountValue: {
    ...(TYPE as any).h1 ? (TYPE as any).h1 : TYPE.h2,
    color: COLORS.white,
    marginTop: 6,
    fontWeight: "900",
  },

  heroMiniDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
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
    color: "rgba(255,255,255,0.82)",
  },

  heroMiniValue: {
    ...TYPE.bodyStrong,
    color: COLORS.white,
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.danger,
  },

  summaryGrid: {
    flexDirection: "row",
    alignItems: "stretch",
  },

  summaryBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderRadius: 22,
  },

  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },

  summaryLabel: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    fontWeight: "700",
  },

  summaryValue: {
    ...TYPE.title,
    marginTop: 4,
    fontWeight: "900",
    color: COLORS.text,
  },

  optionCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  optionTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  optionTitle: {
    ...TYPE.title,
    fontWeight: "900",
    color: COLORS.text,
  },

  optionText: {
    ...TYPE.subtext,
    color: COLORS.textSoft,
    marginTop: 4,
  },

  nextDueHint: {
    ...TYPE.caption,
    color: COLORS.primary,
    marginTop: SPACING.sm,
    fontWeight: "800",
  },

  optionInfoBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  optionInfoText: {
    flex: 1,
    ...TYPE.subtext,
    color: COLORS.text,
  },

  listCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
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
    color: COLORS.text,
  },

  dueLineSub: {
    ...TYPE.caption,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  dueLineAmount: {
    ...TYPE.bodyStrong,
    fontWeight: "900",
    color: COLORS.text,
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
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },

  detailsCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
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
    color: COLORS.textMuted,
  },

  kvValue: {
    ...TYPE.bodyStrong,
    color: COLORS.text,
    textAlign: "right",
    flexShrink: 1,
  },

  bottomActions: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});