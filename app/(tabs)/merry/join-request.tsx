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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";

import { ROUTES } from "@/constants/routes";
import { RADIUS, SPACING, TYPE } from "@/constants/theme";
import {
  AvailableMerryRow,
  getApiErrorMessage,
  getAvailableMerries,
  requestToJoinMerry,
} from "@/services/merry";

const UI = {
  bg: "#EEF3F7",
  surface: "#F7FAFC",
  surfaceAlt: "#EAF1F5",
  card: "#F8FBFD",
  border: "#D6E0E8",
  text: "#29404E",
  textSoft: "#5F7382",
  textMuted: "#7B8C98",
  accent: "#4F6F82",
  accentSoft: "#DFEAF1",
  successBg: "#E8F5EC",
  successText: "#35624A",
  warningBg: "#FFF3E5",
  warningText: "#9B6431",
  dangerBg: "#FDECEC",
  dangerText: "#A14C4C",
};

function toPositiveInt(value: string) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function getFrequencyLabel(merry?: AvailableMerryRow | null) {
  if (!merry) return "";

  const freq = String(merry.payout_frequency || "").toUpperCase();
  const perPeriod = Number(merry.payouts_per_period || 1);

  if (freq === "MONTHLY") {
    return perPeriod > 1 ? `${perPeriod} times monthly` : "Monthly";
  }

  return perPeriod > 1 ? `${perPeriod} times weekly` : "Weekly";
}

export default function MerryJoinRequestScreen() {
  const insets = useSafeAreaInsets();

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
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<
    "success" | "warning" | "danger" | "neutral"
  >("neutral");

  const load = useCallback(async () => {
    if (!merryId || Number.isNaN(merryId)) {
      setError("Invalid merry selected.");
      setMerry(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError("");

      const rows = await getAvailableMerries();
      const found =
        Array.isArray(rows) && rows.length
          ? rows.find((item) => Number(item.id) === merryId) || null
          : null;

      setMerry(found);

      if (!found) {
        setError("This merry could not be loaded for join request.");
        return;
      }

      const availableSeats =
        found.available_seats == null ? null : Number(found.available_seats);

      setRequestedSeats((prev) => {
        const current = toPositiveInt(prev || "1") || 1;
        if (availableSeats == null) return String(current);
        return String(Math.max(1, Math.min(current, availableSeats || 1)));
      });
    } catch (e: any) {
      setMerry(null);
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const parsedRequestedSeats = useMemo(
    () => toPositiveInt(requestedSeats),
    [requestedSeats]
  );

  const joinStatus = String(merry?.my_join_request?.status || "").toUpperCase();
  const availableSeats =
    merry?.available_seats == null ? null : Number(merry.available_seats);

  const maxRequestableSeats = useMemo(() => {
    if (!merry) return 0;
    if (availableSeats == null) return 50;
    return Math.max(0, availableSeats);
  }, [availableSeats, merry]);

  const canDecreaseSeats = parsedRequestedSeats > 1;
  const canIncreaseSeats =
    maxRequestableSeats > 0 && parsedRequestedSeats < maxRequestableSeats;

  const canSubmit = useMemo(() => {
    if (!merry) return false;
    if (merry.can_request_join === false) return false;
    if (merry.is_open === false) return false;
    if (joinStatus === "PENDING") return false;
    if (joinStatus === "APPROVED") return false;
    if (availableSeats !== null && availableSeats <= 0) return false;
    if (parsedRequestedSeats < 1) return false;
    if (parsedRequestedSeats > maxRequestableSeats) return false;
    return true;
  }, [
    merry,
    joinStatus,
    availableSeats,
    parsedRequestedSeats,
    maxRequestableSeats,
  ]);

  const helperText = useMemo(() => {
    if (!merry) return "";

    if (joinStatus === "PENDING") {
      return "Your join request is already pending admin approval.";
    }

    if (joinStatus === "APPROVED") {
      return "Your join request has already been approved.";
    }

    if (merry.is_open === false) {
      return "This merry is currently closed for new join requests.";
    }

    if (availableSeats !== null && availableSeats <= 0) {
      return "There are no seats available right now.";
    }

    if (availableSeats == null) {
      return "Choose how many seats you want and leave a short note for the admin.";
    }

    return `You can request up to ${maxRequestableSeats} seat(s).`;
  }, [merry, joinStatus, availableSeats, maxRequestableSeats]);

  const blockedMessage = useMemo(() => {
    if (joinStatus === "PENDING") {
      return "You already have a pending join request.";
    }

    if (joinStatus === "APPROVED") {
      return "Your join request has already been approved.";
    }

    if (merry?.is_open === false) {
      return "This merry is currently closed for joining.";
    }

    if (availableSeats !== null && availableSeats <= 0) {
      return "No seats are available right now.";
    }

    if (parsedRequestedSeats < 1) {
      return "Requested seats must be at least 1.";
    }

    if (parsedRequestedSeats > maxRequestableSeats) {
      return `You can request up to ${maxRequestableSeats} seat(s).`;
    }

    if (merry?.can_request_join === false) {
      return "You cannot request to join this merry right now.";
    }

    return "This request cannot be submitted right now.";
  }, [
    joinStatus,
    merry?.is_open,
    merry?.can_request_join,
    availableSeats,
    parsedRequestedSeats,
    maxRequestableSeats,
  ]);

  const joinBadge = useMemo(() => {
    if (joinStatus === "PENDING") {
      return {
        label: "Request Pending",
        wrapStyle: styles.badgeWarning,
        textStyle: styles.badgeWarningText,
      };
    }

    if (joinStatus === "APPROVED") {
      return {
        label: "Approved",
        wrapStyle: styles.badgeSuccess,
        textStyle: styles.badgeSuccessText,
      };
    }

    if (merry?.is_open === false) {
      return {
        label: "Closed",
        wrapStyle: styles.badgeDanger,
        textStyle: styles.badgeDangerText,
      };
    }

    if (availableSeats !== null && availableSeats <= 0) {
      return {
        label: "Full",
        wrapStyle: styles.badgeDanger,
        textStyle: styles.badgeDangerText,
      };
    }

    return {
      label: "Open to Join",
      wrapStyle: styles.badgeAccent,
      textStyle: styles.badgeAccentText,
    };
  }, [joinStatus, merry?.is_open, availableSeats]);

  const increaseSeats = useCallback(() => {
    if (!canIncreaseSeats) return;
    const next = Math.min(parsedRequestedSeats + 1, maxRequestableSeats);
    setRequestedSeats(String(next));
  }, [canIncreaseSeats, parsedRequestedSeats, maxRequestableSeats]);

  const decreaseSeats = useCallback(() => {
    if (!canDecreaseSeats) return;
    const next = Math.max(1, parsedRequestedSeats - 1);
    setRequestedSeats(String(next));
  }, [canDecreaseSeats, parsedRequestedSeats]);

  const handleSubmit = useCallback(async () => {
    if (!merry) {
      setStatusTone("danger");
      setStatusMessage("This merry could not be found.");
      return;
    }

    if (!canSubmit) {
      setStatusTone("warning");
      setStatusMessage(blockedMessage);
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setStatusTone("neutral");
      setStatusMessage("Sending your join request...");

      const finalNote =
        note.trim() || `Requesting ${parsedRequestedSeats} seat(s).`;

      const response = await requestToJoinMerry(merry.id, {
        requested_seats: parsedRequestedSeats,
        note: finalNote,
      });

      setStatusTone("success");
      setStatusMessage(
        response?.message ||
          "Your join request has been sent successfully. Redirecting..."
      );

      setRedirecting(true);

      setTimeout(() => {
        router.replace(ROUTES.tabs.dashboard as any);
      }, 1400);
    } catch (e: any) {
      const msg = getApiErrorMessage(e) || "Join request failed.";
      setError(msg);
      setStatusTone("danger");
      setStatusMessage(msg);
    } finally {
      setSubmitting(false);
    }
  }, [merry, canSubmit, blockedMessage, note, parsedRequestedSeats]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={UI.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!merryId || Number.isNaN(merryId)) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.container}>
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

  if (!merry) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.container}>
          <EmptyState
            title="Unable to load join request"
            subtitle={error || "This merry could not be loaded."}
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
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
              <Ionicons name="arrow-back-outline" size={16} color={UI.text} />
            }
          />
        </View>

        <Card style={styles.headerCard} variant="default">
          <View style={styles.headerTop}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="people-outline" size={20} color={UI.accent} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>JOIN REQUEST</Text>
              <Text style={styles.headerTitle}>{merry.name}</Text>
              <Text style={styles.headerMeta}>
                {getFrequencyLabel(merry)}
                {merry.contribution_amount != null ? " • Contribution set" : ""}
              </Text>
            </View>

            <View style={[styles.badgeBase, joinBadge.wrapStyle]}>
              <Text style={[styles.badgeText, joinBadge.textStyle]}>
                {joinBadge.label}
              </Text>
            </View>
          </View>

          <Text style={styles.headerText}>{helperText}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="albums-outline" size={14} color={UI.accent} />
              <Text style={styles.metaPillText}>
                {merry.seats_count} total seat
                {Number(merry.seats_count) === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.metaPill}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color={UI.accent}
              />
              <Text style={styles.metaPillText}>
                {availableSeats == null
                  ? "Seats available"
                  : `${availableSeats} seat${availableSeats === 1 ? "" : "s"} left`}
              </Text>
            </View>
          </View>
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

        {statusMessage ? (
          <Card
            style={[
              styles.statusCard,
              statusTone === "success"
                ? styles.statusSuccess
                : statusTone === "warning"
                  ? styles.statusWarning
                  : statusTone === "danger"
                    ? styles.statusDanger
                    : styles.statusNeutral,
            ]}
            variant="default"
          >
            <View style={styles.statusRow}>
              <Ionicons
                name={
                  statusTone === "success"
                    ? "checkmark-circle-outline"
                    : statusTone === "warning"
                      ? "alert-circle-outline"
                      : statusTone === "danger"
                        ? "close-circle-outline"
                        : "information-circle-outline"
                }
                size={18}
                color={
                  statusTone === "success"
                    ? UI.successText
                    : statusTone === "warning"
                      ? UI.warningText
                      : statusTone === "danger"
                        ? UI.dangerText
                        : UI.text
                }
              />
              <Text
                style={[
                  styles.statusText,
                  statusTone === "success"
                    ? styles.statusTextSuccess
                    : statusTone === "warning"
                      ? styles.statusTextWarning
                      : statusTone === "danger"
                        ? styles.statusTextDanger
                        : styles.statusTextNeutral,
                ]}
              >
                {statusMessage}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.formCard} variant="default">
          <Text style={styles.sectionTitle}>Seat request</Text>
          <Text style={styles.sectionSubtitle}>
            Choose the number of seats you want the admin to review and assign.
          </Text>

          <View style={styles.stepperCard}>
            <Text style={styles.stepperLabel}>Number of seats</Text>

            <View style={styles.stepperRow}>
              <Button
                title="-"
                variant="secondary"
                onPress={decreaseSeats}
                disabled={!canDecreaseSeats || submitting || redirecting}
                style={styles.stepperButton}
              />

              <View style={styles.stepperValueBox}>
                <Text style={styles.stepperValue}>{parsedRequestedSeats || 1}</Text>
              </View>

              <Button
                title="+"
                variant="secondary"
                onPress={increaseSeats}
                disabled={!canIncreaseSeats || submitting || redirecting}
                style={styles.stepperButton}
              />
            </View>

            <Text style={styles.formHelp}>
              You are requesting {parsedRequestedSeats || 1} seat
              {(parsedRequestedSeats || 1) === 1 ? "" : "s"}.
            </Text>
          </View>

          <View style={{ height: SPACING.md }} />

          <Input
            label="Seat count"
            placeholder="Enter seat count"
            keyboardType="number-pad"
            value={requestedSeats}
            onChangeText={(text: string) =>
              setRequestedSeats(text.replace(/[^\d]/g, ""))
            }
          />

          <Text style={styles.formHelp}>
            You can also type the exact number if preferred.
          </Text>

          <View style={{ height: SPACING.lg }} />

          <Input
            label="Note to admin"
            placeholder="Example: Please assign 2 seats together if possible."
            value={note}
            onChangeText={setNote}
            multiline
          />

          <Text style={styles.formHelp}>
            Add any seat preference or short message for the admin.
          </Text>

          <View style={{ height: SPACING.lg }} />

          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Request summary</Text>
            <Text style={styles.summaryValue}>
              {parsedRequestedSeats || 1} seat
              {(parsedRequestedSeats || 1) === 1 ? "" : "s"} requested
            </Text>
            <Text style={styles.summaryNote}>
              {note.trim()
                ? note.trim()
                : `Requesting ${parsedRequestedSeats || 1} seat(s).`}
            </Text>
          </View>

          <View style={{ height: SPACING.lg }} />

          {!canSubmit ? (
            <Text style={styles.blockedText}>{blockedMessage}</Text>
          ) : null}

          <Button
            title={
              redirecting
                ? "Redirecting..."
                : submitting
                  ? "Submitting..."
                  : joinStatus === "PENDING"
                    ? "Request Pending"
                    : joinStatus === "APPROVED"
                      ? "Already Approved"
                      : "Submit Join Request"
            }
            onPress={handleSubmit}
            disabled={submitting || redirecting}
          />

          <View style={{ height: SPACING.sm }} />

          <Button
            title="Back to Merry"
            variant="secondary"
            onPress={() => router.replace(ROUTES.tabs.merry as any)}
            disabled={redirecting}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },

  content: {
    padding: SPACING.md,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.bg,
  },

  topBar: {
    marginBottom: SPACING.sm,
    alignItems: "flex-start",
  },

  headerCard: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 24,
    marginBottom: SPACING.md,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  headerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: UI.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  headerEyebrow: {
    ...TYPE.caption,
    color: UI.textMuted,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  headerTitle: {
    ...TYPE.h2,
    color: UI.text,
    marginTop: 4,
    fontWeight: "900",
  },

  headerMeta: {
    ...TYPE.caption,
    color: UI.textSoft,
    marginTop: 4,
  },

  headerText: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: SPACING.md,
    lineHeight: 20,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
  },

  metaPillText: {
    ...TYPE.caption,
    color: UI.text,
    fontWeight: "700",
  },

  badgeBase: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  badgeAccent: {
    backgroundColor: UI.accentSoft,
  },

  badgeSuccess: {
    backgroundColor: UI.successBg,
  },

  badgeWarning: {
    backgroundColor: UI.warningBg,
  },

  badgeDanger: {
    backgroundColor: UI.dangerBg,
  },

  badgeText: {
    ...TYPE.caption,
    fontWeight: "800",
  },

  badgeAccentText: {
    color: UI.accent,
  },

  badgeSuccessText: {
    color: UI.successText,
  },

  badgeWarningText: {
    color: UI.warningText,
  },

  badgeDangerText: {
    color: UI.dangerText,
  },

  formCard: {
    backgroundColor: UI.card,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 24,
  },

  sectionTitle: {
    ...TYPE.title,
    color: UI.text,
    fontWeight: "900",
  },

  sectionSubtitle: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 4,
    marginBottom: SPACING.md,
  },

  stepperCard: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 20,
    padding: SPACING.md,
  },

  stepperLabel: {
    ...TYPE.bodyStrong,
    color: UI.text,
    fontWeight: "800",
    marginBottom: SPACING.sm,
  },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  stepperButton: {
    flex: 1,
  },

  stepperValueBox: {
    minWidth: 90,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
  },

  stepperValue: {
    ...TYPE.h2,
    color: UI.text,
    fontWeight: "900",
  },

  formHelp: {
    ...TYPE.caption,
    color: UI.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },

  summaryBox: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 20,
    padding: SPACING.md,
  },

  summaryLabel: {
    ...TYPE.caption,
    color: UI.textMuted,
    fontWeight: "800",
  },

  summaryValue: {
    ...TYPE.bodyStrong,
    color: UI.text,
    fontWeight: "900",
    marginTop: 6,
  },

  summaryNote: {
    ...TYPE.subtext,
    color: UI.textSoft,
    marginTop: 6,
    lineHeight: 20,
  },

  blockedText: {
    ...TYPE.caption,
    color: UI.warningText,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "#EBCACA",
    backgroundColor: UI.dangerBg,
    borderRadius: RADIUS.xl,
  },

  errorText: {
    flex: 1,
    ...TYPE.subtext,
    color: UI.dangerText,
  },

  statusCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  statusNeutral: {
    backgroundColor: UI.surface,
    borderColor: UI.border,
  },

  statusSuccess: {
    backgroundColor: UI.successBg,
    borderColor: "#CFE5D6",
  },

  statusWarning: {
    backgroundColor: UI.warningBg,
    borderColor: "#F0DEC9",
  },

  statusDanger: {
    backgroundColor: UI.dangerBg,
    borderColor: "#EBCACA",
  },

  statusText: {
    ...TYPE.subtext,
    flex: 1,
    lineHeight: 20,
  },

  statusTextNeutral: {
    color: UI.text,
  },

  statusTextSuccess: {
    color: UI.successText,
  },

  statusTextWarning: {
    color: UI.warningText,
  },

  statusTextDanger: {
    color: UI.dangerText,
  },
});