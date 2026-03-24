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
    <View
      style={[
        styles.statusPill,
        { borderColor: color, backgroundColor: `${color}12` },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{String(label || "—").toUpperCase()}</Text>
    </View>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoBox}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
            ? 50
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

  const alreadyApproved =
    String(merry?.my_join_request?.status || "").toUpperCase() === "APPROVED";

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
    if (alreadyApproved) return false;
    if (isClosed) return false;
    if (noSeatsLeft) return false;
    if (!parsedRequestedSeats || parsedRequestedSeats < 1) return false;
    if (parsedRequestedSeats > maxRequestableSeats) return false;
    if (merry.can_request_join === false) return false;
    return true;
  }, [
    merry,
    alreadyPending,
    alreadyApproved,
    isClosed,
    noSeatsLeft,
    parsedRequestedSeats,
    maxRequestableSeats,
  ]);

  const seatNumbersText = useMemo(() => {
    if (!merry?.available_seat_numbers?.length) return "";
    return merry.available_seat_numbers.join(", ");
  }, [merry?.available_seat_numbers]);

  const helperMessage = useMemo(() => {
    if (!merry) return "";
    if (alreadyPending) return "You already have a pending join request for this merry.";
    if (alreadyApproved) return "Your join request has already been approved.";
    if (isClosed) return "This merry is currently closed for new join requests.";
    if (noSeatsLeft) return "There are no seats available at the moment.";
    if (merry.available_seats == null) {
      return "Choose how many seats you need and leave a short note for the admin.";
    }
    return `You can request up to ${maxRequestableSeats} seat(s).`;
  }, [
    merry,
    alreadyPending,
    alreadyApproved,
    isClosed,
    noSeatsLeft,
    maxRequestableSeats,
  ]);

  const doSubmit = useCallback(async () => {
    if (!merry) {
      Alert.alert("Join request", "This merry could not be found.");
      return;
    }

    try {
      setSubmitting(true);

      const finalNote =
        note.trim() || `Requesting ${parsedRequestedSeats} seat(s).`;

      const res = await requestToJoinMerry(merry.id, {
        requested_seats: parsedRequestedSeats,
        note: finalNote,
      });

      Alert.alert(
        "Request submitted",
        `Your request for ${res.requested_seats} seat(s) has been sent to the admin.`,
        [
          {
            text: "OK",
            onPress: () => router.replace(ROUTES.tabs.merry as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Join request", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [merry, note, parsedRequestedSeats]);

  const openConfirmPopup = useCallback(() => {
    if (!merry) {
      Alert.alert("Join request", "This merry could not be found.");
      return;
    }

    if (!canSubmit) {
      let msg = "This request cannot be submitted.";

      if (alreadyPending) {
        msg = "You already have a pending join request.";
      } else if (alreadyApproved) {
        msg = "This join request has already been approved.";
      } else if (isClosed) {
        msg = "This merry is currently closed for joining.";
      } else if (noSeatsLeft) {
        msg = "No seats are currently available.";
      } else if (!parsedRequestedSeats || parsedRequestedSeats < 1) {
        msg = "Requested seats must be at least 1.";
      } else if (parsedRequestedSeats > maxRequestableSeats) {
        msg = `You can request up to ${maxRequestableSeats} seat(s).`;
      }

      Alert.alert("Join request", msg);
      return;
    }

    const finalNote =
      note.trim() || `Requesting ${parsedRequestedSeats} seat(s).`;

    Alert.alert(
      "Confirm join request",
      `Merry: ${merry.name}\n\nSeats requested: ${parsedRequestedSeats}\n\nNote: ${finalNote}\n\nDo you want to send this request?`,
      [
        {
          text: "Edit",
          style: "cancel",
        },
        {
          text: "Confirm",
          onPress: doSubmit,
        },
      ]
    );
  }, [
    merry,
    canSubmit,
    note,
    parsedRequestedSeats,
    maxRequestableSeats,
    alreadyPending,
    alreadyApproved,
    isClosed,
    noSeatsLeft,
    doSubmit,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
          onAction={() => router.replace(ROUTES.tabs.merry as any)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Button
          title="Back"
          variant="ghost"
          onPress={() => router.back()}
          leftIcon={
            <Ionicons
              name="arrow-back-outline"
              size={16}
              color={COLORS.primary}
            />
          }
        />
      </View>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="people-outline" size={20} color={COLORS.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>{merry.name}</Text>
            <Text style={styles.summarySubtitle}>
              Send a simple join request to the admin.
            </Text>
          </View>

          {merry.my_join_request?.status ? (
            <StatusPill label={merry.my_join_request.status} />
          ) : null}
        </View>

        <View style={styles.infoGrid}>
          <InfoBox
            icon="cash-outline"
            label="Contribution"
            value={fmtKES(merry.contribution_amount)}
          />
          <InfoBox
            icon="grid-outline"
            label="Available Seats"
            value={
              merry.available_seats == null
                ? "Open"
                : String(merry.available_seats)
            }
          />
        </View>
      </Card>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Request details</Text>
        <Text style={styles.formSubtitle}>{helperMessage}</Text>

        <View style={{ height: SPACING.md }} />

        <Input
          label="Number of seats"
          placeholder="Enter seats"
          keyboardType="number-pad"
          value={requestedSeats}
          onChangeText={(text: string) =>
            setRequestedSeats(text.replace(/[^\d]/g, ""))
          }
        />

        <View style={{ height: SPACING.md }} />

        <Input
          label="Note to admin"
          placeholder="Example: I need 2 seats. If possible I prefer seat 3 and 4."
          value={note}
          onChangeText={setNote}
          multiline
        />

        <View style={styles.tipBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={COLORS.primary}
          />
          <Text style={styles.tipText}>
            After tapping submit, you will first see a popup summary to confirm
            exactly what is being sent.
          </Text>
        </View>

        <View style={{ height: SPACING.lg }} />

        <Button
          title={
            submitting
              ? "Submitting..."
              : alreadyPending
                ? "Request Pending"
                : alreadyApproved
                  ? "Already Approved"
                  : "Submit Join Request"
          }
          onPress={openConfirmPopup}
          disabled={!canSubmit || submitting}
          leftIcon={
            !submitting ? (
              <Ionicons
                name="paper-plane-outline"
                size={18}
                color={COLORS.white}
              />
            ) : undefined
          }
        />
      </Card>

      {(seatNumbersText ||
        merry.next_payout_date ||
        merry.members_count != null ||
        merry.seats_count != null) && (
        <Card style={styles.bottomCard}>
          <Text style={styles.bottomTitle}>Merry summary</Text>

          <View style={{ marginTop: SPACING.sm }}>
            <DetailRow
              label="Contribution"
              value={fmtKES(merry.contribution_amount)}
            />
            <DetailRow
              label="Frequency"
              value={String(merry.payout_frequency || "—")}
            />
            <DetailRow
              label="Next payout"
              value={merry.next_payout_date || "—"}
            />
            <DetailRow
              label="Members"
              value={String(merry.members_count ?? 0)}
            />
            <DetailRow
              label="Seats"
              value={String(merry.seats_count ?? 0)}
            />
            <DetailRow
              label="Available seats"
              value={
                merry.available_seats == null
                  ? "Open"
                  : String(merry.available_seats)
              }
            />
          </View>

          {seatNumbersText ? (
            <View style={styles.availableSeatsWrap}>
              <Text style={styles.availableSeatsLabel}>
                Available seat numbers
              </Text>
              <Text style={styles.availableSeatsValue}>{seatNumbersText}</Text>
            </View>
          ) : null}
        </Card>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 28,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FB",
  },

  topBar: {
    marginBottom: SPACING.sm,
    alignItems: "flex-start",
  },

  summaryCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },

  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}12`,
  },

  summaryTitle: {
    fontFamily: FONT.bold,
    fontSize: 17,
    color: COLORS.dark,
  },

  summarySubtitle: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  infoGrid: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#F8FAFF",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },

  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${COLORS.primary}12`,
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 2,
  },

  infoValue: {
    fontFamily: FONT.semiBold,
    fontSize: 13,
    color: COLORS.dark,
  },

  formCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  formTitle: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  formSubtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  tipBox: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: `${COLORS.primary}10`,
  },

  tipText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.dark,
    lineHeight: 18,
  },

  bottomCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.white,
    ...SHADOW.card,
  },

  bottomTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: COLORS.dark,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
    paddingVertical: 8,
  },

  detailLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  detailValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: COLORS.dark,
  },

  availableSeatsWrap: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: "#F8FAFF",
  },

  availableSeatsLabel: {
    fontFamily: FONT.semiBold,
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 6,
  },

  availableSeatsValue: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "#FFF4F4",
  },

  errorText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.danger,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  statusText: {
    fontFamily: FONT.semiBold,
    fontSize: 11,
    color: COLORS.dark,
  },
});