// app/(tabs)/merry/join-request.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  AvailableMerryRow,
  fmtKES,
  getApiErrorMessage,
  getAvailableMerries,
  requestToJoinMerry,
} from "@/services/merry";

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return COLORS.success;
  if (s === "PENDING") return COLORS.warning;
  if (s === "REJECTED" || s === "CANCELLED") return COLORS.danger;
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

export default function MerryJoinRequestScreen() {
  const params = useLocalSearchParams<{ merryId?: string; id?: string }>();
  const merryId = useMemo(
    () => Number(params.merryId || params.id || 0),
    [params.merryId, params.id]
  );

  const [merry, setMerry] = useState<AvailableMerryRow | null>(null);
  const [requestedSeats, setRequestedSeats] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const rows = await getAvailableMerries();
      const row = Array.isArray(rows)
        ? rows.find((r) => Number(r.id) === merryId) || null
        : null;

      setMerry(row);

      if (!row) {
        setError("This merry is not available to join.");
      } else {
        const maxSeatsAllowed =
          row.available_seats == null
            ? 1
            : Math.max(1, Math.min(Number(row.available_seats || 1), 50));
        setRequestedSeats((prev) => {
          const n = Number(prev || 1);
          if (!Number.isFinite(n) || n < 1) return "1";
          if (row.available_seats != null && n > maxSeatsAllowed) {
            return String(maxSeatsAllowed);
          }
          return String(n);
        });
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
      setMerry(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const parsedRequestedSeats = useMemo(() => {
    const n = Number(requestedSeats || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }, [requestedSeats]);

  const alreadyPending =
    String(merry?.my_join_request?.status || "").toUpperCase() === "PENDING";

  const isClosed = merry?.is_open === false;
  const noSeatsLeft = merry?.available_seats === 0;

  const maxRequestableSeats = useMemo(() => {
    if (!merry) return 0;
    if (merry.available_seats == null) return 50;
    return Math.max(0, Math.min(Number(merry.available_seats || 0), 50));
  }, [merry]);

  const canSubmit = useMemo(() => {
    if (!merry) return false;
    if (alreadyPending) return false;
    if (isClosed) return false;
    if (noSeatsLeft) return false;
    if (!parsedRequestedSeats || parsedRequestedSeats < 1) return false;
    if (parsedRequestedSeats > maxRequestableSeats) return false;
    if (merry.can_request_join === false) return false;
    return true;
  }, [
    merry,
    alreadyPending,
    isClosed,
    noSeatsLeft,
    parsedRequestedSeats,
    maxRequestableSeats,
  ]);

  const seatNumbersText = useMemo(() => {
    if (!merry?.available_seat_numbers?.length) return "";
    return merry.available_seat_numbers.join(", ");
  }, [merry?.available_seat_numbers]);

  const submit = useCallback(async () => {
    if (!merry) {
      Alert.alert("Join request", "This merry could not be found.");
      return;
    }

    if (!canSubmit) {
      let msg = "This request cannot be submitted.";
      if (alreadyPending) msg = "You already have a pending join request.";
      else if (isClosed) msg = "This merry is currently closed for joining.";
      else if (noSeatsLeft) msg = "No seats are currently available.";
      else if (!parsedRequestedSeats || parsedRequestedSeats < 1) {
        msg = "Requested seats must be at least 1.";
      } else if (parsedRequestedSeats > maxRequestableSeats) {
        msg = `You can request up to ${maxRequestableSeats} seat(s).`;
      }
      Alert.alert("Join request", msg);
      return;
    }

    try {
      setSubmitting(true);

      const res = await requestToJoinMerry(merry.id, {
        note: note.trim() || undefined,
        requested_seats: parsedRequestedSeats,
      });

      Alert.alert(
        "Join request sent",
        `Your request for ${res.requested_seats} seat(s) has been submitted.`
      );

      router.replace({
        pathname: ROUTES.tabs.merry as any,
      });
    } catch (e: any) {
      Alert.alert("Join request", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    merry,
    canSubmit,
    note,
    parsedRequestedSeats,
    alreadyPending,
    isClosed,
    noSeatsLeft,
    maxRequestableSeats,
  ]);

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
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (!merry) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Merry not available"
          subtitle={error || "This merry is not available for joining."}
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
          <Text style={styles.hTitle}>Join Merry</Text>
          <Text style={styles.hSub}>{merry.name}</Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
          onPress={() => router.back()}
          leftIcon={<Ionicons name="arrow-back-outline" size={16} color={COLORS.primary} />}
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {alreadyPending ? (
        <Card style={styles.noticeCard}>
          <View style={styles.noticeTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Request already pending</Text>
              <Text style={styles.noticeText}>
                Your earlier join request is still waiting for admin review.
              </Text>
            </View>
            <StatusPill label={merry.my_join_request?.status || "PENDING"} />
          </View>
        </Card>
      ) : null}

      {isClosed ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Joining is closed</Text>
          <Text style={styles.noticeText}>
            This merry is currently not accepting new join requests.
          </Text>
        </Card>
      ) : null}

      {noSeatsLeft ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>No seats available</Text>
          <Text style={styles.noticeText}>
            All available seats have already been allocated.
          </Text>
        </Card>
      ) : null}

      <Section title="Overview">
        <Card style={styles.sectionCard}>
          <SummaryRow label="Contribution / Seat" value={fmtKES(merry.contribution_amount)} />
          <SummaryRow label="Order Type" value={String(merry.payout_order_type || "—")} />
          <SummaryRow label="Frequency" value={String(merry.payout_frequency || "—")} />
          <SummaryRow label="Slots / Period" value={String(merry.payouts_per_period || 1)} />
          <SummaryRow label="Members" value={String(merry.members_count || 0)} />
          <SummaryRow label="Seats" value={String(merry.seats_count || 0)} />
          <SummaryRow
            label="Open for Joining"
            value={merry.is_open === false ? "No" : "Yes"}
          />
          <SummaryRow
            label="Available Seats"
            value={merry.available_seats == null ? "Unlimited" : String(merry.available_seats)}
          />
          <SummaryRow label="Next Payout" value={merry.next_payout_date || "—"} />
        </Card>
      </Section>

      {seatNumbersText ? (
        <Section title="Available Seat Numbers">
          <Card style={styles.sectionCard}>
            <Text style={styles.seatNumbersText}>{seatNumbersText}</Text>
            <Text style={styles.helpText}>
              Seat numbers are assigned during approval. This list helps you know what is still free.
            </Text>
          </Card>
        </Section>
      ) : null}

      <Section title="Request Details">
        <Card style={styles.formCard}>
          <Input
            label="Requested Seats"
            placeholder="Enter number of seats"
            keyboardType="number-pad"
            value={requestedSeats}
            onChangeText={(text: string) => setRequestedSeats(text.replace(/[^\d]/g, ""))}
          />

          <Text style={styles.helpText}>
            {merry.available_seats == null
              ? "You may request one or more seats, up to 50."
              : `You may request up to ${maxRequestableSeats} seat(s).`}
          </Text>

          <View style={{ height: SPACING.md }} />

          <Input
            label="Note (optional)"
            placeholder="Add a note for the admin"
            value={note}
            onChangeText={setNote}
            multiline
          />
        </Card>
      </Section>

      <Section title="Actions">
        <Card style={styles.actionCard}>
          <Button
            title={submitting ? "Submitting..." : alreadyPending ? "Request Pending" : "Submit Join Request"}
            onPress={submit}
            disabled={!canSubmit || submitting}
            leftIcon={
              !submitting ? (
                <Ionicons name="paper-plane-outline" size={18} color={COLORS.white} />
              ) : undefined
            }
          />

          <View style={{ height: SPACING.sm }} />

          <Button
            title="Back to Merry List"
            variant="secondary"
            onPress={() => router.replace(ROUTES.tabs.merry)}
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

  sectionCard: {
    padding: SPACING.md,
  },

  formCard: {
    padding: SPACING.md,
  },

  actionCard: {
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

  noticeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  noticeTitle: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: COLORS.dark,
  },

  noticeText: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  seatNumbersText: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: COLORS.dark,
    lineHeight: 20,
  },

  helpText: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    lineHeight: 17,
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

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    ...SHADOW.card,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },
});