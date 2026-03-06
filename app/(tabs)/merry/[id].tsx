// app/(tabs)/merry/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

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
    getMerryPayoutSchedule,
    getMerrySeats,
    getMyMerryDues,
    getMyMerryPayments,
    MerryDetail,
    MerryPaymentRow,
    MerrySeatRow,
    MyDuesRow,
    PayoutScheduleResponse
} from "@/services/merry";
import {
    getMe,
    isAdminUser,
    isKycComplete,
    MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryPageUser = Partial<MeResponse> & Partial<SessionUser>;

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (["PAID", "CONFIRMED", "SUCCESS", "APPROVED"].includes(s)) return COLORS.success;
  if (["PARTIAL", "PENDING", "PROCESSING", "INITIATED"].includes(s)) return COLORS.warning;
  if (["FAILED", "REJECTED", "CANCELLED"].includes(s)) return COLORS.danger;
  return COLORS.gray;
}

function StatusPill({ label }: { label: string }) {
  const color = statusColor(label);
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{String(label || "—").toUpperCase()}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SeatCard({ seat }: { seat: MerrySeatRow }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>Seat {seat.seat_no}</Text>
          <Text style={styles.itemMeta}>
            Position {seat.payout_position ?? "—"}
          </Text>
        </View>
        <Ionicons name="person-outline" size={18} color={COLORS.primary} />
      </View>
    </Card>
  );
}

function DueCard({ row }: { row: MyDuesRow }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>
            Seat {row.seat_no} • Slot {row.slot_no}
          </Text>
          <Text style={styles.itemMeta}>Period {row.period_key}</Text>
        </View>
        <StatusPill label={row.status} />
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Due</Text>
          <Text style={styles.metricValue}>{fmtKES(row.due_amount)}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Paid</Text>
          <Text style={styles.metricValue}>{fmtKES(row.paid_amount)}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricLabel}>Outstanding</Text>
          <Text style={styles.metricValue}>{fmtKES(row.outstanding)}</Text>
        </View>
      </View>
    </Card>
  );
}

function PaymentCard({ payment }: { payment: MerryPaymentRow }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{fmtKES(payment.amount)}</Text>
          <Text style={styles.itemMeta}>
            {payment.period_key}
            {payment.created_at ? ` • ${payment.created_at}` : ""}
          </Text>
        </View>
        <StatusPill label={payment.status} />
      </View>

      <View style={{ marginTop: SPACING.sm }}>
        <Text style={styles.smallText}>Phone: {payment.payer_phone}</Text>
        <Text style={styles.smallText}>
          Receipt: {payment.mpesa_receipt_number || "—"}
        </Text>
      </View>
    </Card>
  );
}

export default function MerryDetailScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    contributed?: string;
    baseAmount?: string;
    chargedAmount?: string;
    feeAmount?: string;
    notice?: string;
  }>();

  const merryId = Number(params.id ?? 0);

  const [user, setUser] = useState<MerryPageUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [seats, setSeats] = useState<MerrySeatRow[]>([]);
  const [dues, setDues] = useState<MyDuesRow[]>([]);
  const [payments, setPayments] = useState<MerryPaymentRow[]>([]);
  const [schedule, setSchedule] = useState<PayoutScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);

  const contributionNotice = useMemo(() => {
    if (params.contributed !== "1") return "";
    const base = params.baseAmount ? fmtKES(params.baseAmount) : "";
    const fee = params.feeAmount ? fmtKES(params.feeAmount) : "";
    const charged = params.chargedAmount ? fmtKES(params.chargedAmount) : "";
    const main = params.notice || "Contribution initiated successfully.";
    const extra = charged
      ? ` Base: ${base || "—"} • Fee: ${fee || "KES 0.00"} • Charged: ${charged}`
      : "";
    return `${main}${extra}`;
  }, [params.baseAmount, params.chargedAmount, params.contributed, params.feeAmount, params.notice]);

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, detailRes, seatsRes, duesRes, paymentsRes, scheduleRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMerryDetail(merryId),
          getMerrySeats(merryId),
          getMyMerryDues(merryId),
          getMyMerryPayments(),
          getMerryPayoutSchedule(merryId),
        ]);

      const sessionUser = sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (detailRes.status === "fulfilled") {
        setMerry(detailRes.value);
      } else {
        setMerry(null);
        setError(getApiErrorMessage(detailRes.reason));
      }

      const allSeats = seatsRes.status === "fulfilled" && Array.isArray(seatsRes.value)
        ? seatsRes.value
        : [];
      const myUserId = Number(meUser?.id || sessionUser?.id || 0);
      setSeats(
        myUserId
          ? allSeats.filter((s) => Number(s.user_id) === myUserId)
          : allSeats
      );

      const duesData =
        duesRes.status === "fulfilled"
          ? Array.isArray((duesRes.value as any)?.data)
            ? (duesRes.value as any).data
            : []
          : [];
      setDues(duesData);

      const allPayments =
        paymentsRes.status === "fulfilled" && Array.isArray(paymentsRes.value)
          ? paymentsRes.value
          : [];
      setPayments(
        allPayments.filter((p) => Number(p.merry_id) === merryId)
      );

      if (scheduleRes.status === "fulfilled") {
        setSchedule(scheduleRes.value);
      } else {
        setSchedule(null);
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
      setMerry(null);
    } finally {
      setLoading(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      load();
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

  const totals = useMemo(() => {
    const due = dues.reduce((sum, d) => sum + (Number(d.due_amount || 0) || 0), 0);
    const paid = dues.reduce((sum, d) => sum + (Number(d.paid_amount || 0) || 0), 0);
    const outstanding = dues.reduce((sum, d) => sum + (Number(d.outstanding || 0) || 0), 0);
    return { due, paid, outstanding };
  }, [dues]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!merryId || !Number.isFinite(merryId)) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Invalid merry"
          subtitle="No merry was selected."
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  if (!merry) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Unable to load merry"
          subtitle={error || "This merry could not be loaded."}
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{merry.name}</Text>
          <Text style={styles.hSub}>
            Merry details • {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />}
        />
      </View>

      {contributionNotice ? (
        <Card style={styles.successCard}>
          <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.success} />
          <Text style={styles.successText}>{contributionNotice}</Text>
        </Card>
      ) : null}

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {!kycComplete ? (
        <Card style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.info} />
          <Text style={styles.noticeText}>
            Contributions can continue, but some withdrawal-related actions remain limited until KYC is complete.
          </Text>
        </Card>
      ) : null}

      <Section title="Overview">
        <Card style={styles.sectionCard}>
          <SummaryRow label="Per Seat" value={fmtKES(merry.contribution_amount)} />
          <SummaryRow label="Order Type" value={String(merry.payout_order_type || "—")} />
          <SummaryRow label="Frequency" value={String(merry.payout_frequency || "—")} />
          <SummaryRow label="Slots / Period" value={String(merry.payouts_per_period || "1")} />
          <SummaryRow label="Next Payout" value={merry.next_payout_date || "—"} />
        </Card>
      </Section>

      <Section title="My Seats">
        {seats.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No seats assigned yet"
            subtitle="Your seat allocation will appear here after your join request is approved."
          />
        ) : (
          seats.map((seat) => <SeatCard key={seat.seat_id} seat={seat} />)
        )}
      </Section>

      <Section
        title="My Dues"
        right={
          <Button
            variant="ghost"
            title="Contribute"
            onPress={() =>
              router.push({
                pathname: ROUTES.tabs.merryContribute as any,
                params: { merryId: String(merry.id) },
              })
            }
          />
        }
      >
        <View style={styles.summaryMiniGrid}>
          <View style={styles.summaryMiniCard}>
            <Text style={styles.metricLabel}>Total Due</Text>
            <Text style={styles.metricValue}>{fmtKES(totals.due)}</Text>
          </View>
          <View style={styles.summaryMiniCard}>
            <Text style={styles.metricLabel}>Total Paid</Text>
            <Text style={styles.metricValue}>{fmtKES(totals.paid)}</Text>
          </View>
          <View style={styles.summaryMiniCard}>
            <Text style={styles.metricLabel}>Outstanding</Text>
            <Text style={styles.metricValue}>{fmtKES(totals.outstanding)}</Text>
          </View>
        </View>

        {dues.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No dues found"
            subtitle="When dues are generated for your seats and slots, they will appear here."
          />
        ) : (
          dues.map((row) => <DueCard key={row.due_id} row={row} />)
        )}
      </Section>

      <Section title="My Payments">
        {payments.length === 0 ? (
          <EmptyState
            icon="card-outline"
            title="No payments yet"
            subtitle="Your confirmed and pending merry payments will appear here."
            actionLabel="Contribute"
            onAction={() =>
              router.push({
                pathname: ROUTES.tabs.merryContribute as any,
                params: { merryId: String(merry.id) },
              })
            }
          />
        ) : (
          payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)
        )}
      </Section>

      <Section title="Payout Schedule">
        <Card style={styles.sectionCard}>
          <SummaryRow
            label="Current Period"
            value={schedule?.current_period_key || "—"}
          />
          <SummaryRow
            label="Used Slots"
            value={
              schedule?.used_slots_in_period?.length
                ? schedule.used_slots_in_period.join(", ")
                : "None"
            }
          />
          <SummaryRow
            label="Seats In Schedule"
            value={String(schedule?.seats?.length || 0)}
          />
        </Card>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  successCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  successText: {
    flex: 1,
    color: COLORS.success,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  noticeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeText: {
    flex: 1,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  sectionCard: {
    padding: SPACING.md,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: SPACING.md,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: COLORS.dark,
  },

  summaryMiniGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginBottom: SPACING.md,
  },

  summaryMiniCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    ...SHADOW.card,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  itemTitle: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: COLORS.dark,
  },

  itemMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  smallText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  metricsGrid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  metricBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metricLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  metricValue: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  pillText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },
});