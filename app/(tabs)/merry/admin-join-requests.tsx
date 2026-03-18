// app/(tabs)/merry/admin-join-requests.tsx
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

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  adminApproveJoinRequest,
  adminListJoinRequests,
  adminRejectJoinRequest,
  fmtKES,
  getApiErrorMessage,
  getMerryDetail,
  JoinRequestRow,
  MerryDetail,
} from "@/services/merry";
import { getSessionUser, SessionUser } from "@/services/session";

type FilterType = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "ALL";

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return COLORS.success;
  if (s === "PENDING") return COLORS.warning;
  if (s === "REJECTED" || s === "CANCELLED") return COLORS.danger;
  return COLORS.gray;
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusText}>{String(status || "—").toUpperCase()}</Text>
    </View>
  );
}

function parseSeatNumbers(input: string): number[] {
  const clean = String(input || "").trim();
  if (!clean) return [];

  const parts = clean
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const nums = parts.map((p) => Number(p));

  if (nums.some((n) => !Number.isInteger(n) || n < 1)) {
    throw new Error("Seat numbers must be positive integers separated by commas.");
  }

  const unique = Array.from(new Set(nums));
  if (unique.length !== nums.length) {
    throw new Error("Seat numbers must not contain duplicates.");
  }

  return unique;
}

export default function AdminJoinRequestsScreen() {
  const params = useLocalSearchParams<{ merryId?: string; id?: string }>();
  const merryId = useMemo(
    () => Number(params.merryId || params.id || 0),
    [params.merryId, params.id]
  );

  const [me, setMe] = useState<SessionUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [filter, setFilter] = useState<FilterType>("PENDING");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const [manualSeatMode, setManualSeatMode] = useState<Record<number, boolean>>({});
  const [seatInputByRequest, setSeatInputByRequest] = useState<Record<number, string>>({});
  const [rejectNoteByRequest, setRejectNoteByRequest] = useState<Record<number, string>>({});

  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

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

      const [sessionRes, merryRes, requestsRes] = await Promise.allSettled([
        getSessionUser(),
        getMerryDetail(merryId),
        adminListJoinRequests(merryId, filter === "ALL" ? undefined : filter),
      ]);

      if (sessionRes.status === "fulfilled") {
        setMe(sessionRes.value);
      } else {
        setMe(null);
      }

      if (merryRes.status === "fulfilled") {
        setMerry(merryRes.value);
      } else {
        setMerry(null);
      }

      if (requestsRes.status === "fulfilled") {
        setRequests(Array.isArray(requestsRes.value) ? requestsRes.value : []);
      } else {
        setRequests([]);
        setError(getApiErrorMessage(requestsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merryId, filter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const toggleManualSeatMode = useCallback((requestId: number) => {
    setManualSeatMode((prev) => ({ ...prev, [requestId]: !prev[requestId] }));
  }, []);

  const onApprove = useCallback(
    async (row: JoinRequestRow) => {
      try {
        setApprovingId(row.id);

        const useManual = !!manualSeatMode[row.id];
        const seatInput = seatInputByRequest[row.id] || "";

        if (useManual) {
          const seatNumbers = parseSeatNumbers(seatInput);

          if (seatNumbers.length !== Number(row.requested_seats || 0)) {
            throw new Error(
              `You must enter exactly ${row.requested_seats} seat number(s).`
            );
          }

          await adminApproveJoinRequest(row.id, {
            assigned_seat_numbers: seatNumbers,
          });

          Alert.alert(
            "Approved",
            `Join request approved with seat numbers: ${seatNumbers.join(", ")}`
          );
        } else {
          await adminApproveJoinRequest(row.id);
          Alert.alert("Approved", "Join request approved successfully.");
        }

        setSeatInputByRequest((prev) => ({ ...prev, [row.id]: "" }));
        setManualSeatMode((prev) => ({ ...prev, [row.id]: false }));
        await load();
      } catch (e: any) {
        Alert.alert("Approve request", e?.message || getApiErrorMessage(e));
      } finally {
        setApprovingId(null);
      }
    },
    [load, manualSeatMode, seatInputByRequest]
  );

  const onReject = useCallback(
    async (row: JoinRequestRow) => {
      try {
        setRejectingId(row.id);
        const note = (rejectNoteByRequest[row.id] || "").trim();

        await adminRejectJoinRequest(row.id, note ? { note } : {});
        Alert.alert("Rejected", "Join request rejected.");

        setRejectNoteByRequest((prev) => ({ ...prev, [row.id]: "" }));
        await load();
      } catch (e: any) {
        Alert.alert("Reject request", getApiErrorMessage(e));
      } finally {
        setRejectingId(null);
      }
    },
    [load, rejectNoteByRequest]
  );

  const pendingCount = useMemo(
    () => requests.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
    [requests]
  );

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
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Admin only"
          subtitle="You do not have permission to manage join requests."
          actionLabel="Back"
          onAction={() => router.back()}
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
          <Text style={styles.hTitle}>Join Requests</Text>
          <Text style={styles.hSub}>
            {merry?.name || "Merry"} • Pending {pendingCount}
          </Text>
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

      <Section title="Overview">
        <Card style={styles.sectionCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Contribution / Seat</Text>
            <Text style={styles.summaryValue}>
              {fmtKES(merry?.contribution_amount || 0)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Open for Joining</Text>
            <Text style={styles.summaryValue}>
              {merry?.is_open === false ? "No" : "Yes"}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Available Seats</Text>
            <Text style={styles.summaryValue}>
              {merry?.available_seats == null ? "Unlimited" : String(merry.available_seats)}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Members</Text>
            <Text style={styles.summaryValue}>{String(merry?.members_count ?? "—")}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Seats</Text>
            <Text style={styles.summaryValue}>{String(merry?.seats_count ?? "—")}</Text>
          </View>
        </Card>
      </Section>

      <Section title="Filter">
        <View style={styles.filterRow}>
          {(["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"] as FilterType[]).map(
            (item) => {
              const active = filter === item;
              return (
                <Button
                  key={item}
                  title={item}
                  variant={active ? "primary" : "secondary"}
                  onPress={() => setFilter(item)}
                />
              );
            }
          )}
        </View>
      </Section>

      <Section title="Requests">
        {requests.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No join requests"
            subtitle="There are no join requests for this filter."
          />
        ) : (
          requests.map((row) => {
            const isPending = String(row.status).toUpperCase() === "PENDING";
            const isApproving = approvingId === row.id;
            const isRejecting = rejectingId === row.id;
            const useManual = !!manualSeatMode[row.id];

            return (
              <Card key={row.id} style={styles.requestCard}>
                <View style={styles.requestTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestTitle}>
                      {row.username || `User #${row.user_id ?? "—"}`}
                    </Text>
                    <Text style={styles.requestMeta}>
                      {row.phone ? `Phone: ${row.phone}` : "Phone: —"}
                    </Text>
                    <Text style={styles.requestMeta}>
                      Requested Seats: {row.requested_seats}
                    </Text>
                    <Text style={styles.requestMeta}>
                      Created: {row.created_at || "—"}
                    </Text>
                    {row.reviewed_at ? (
                      <Text style={styles.requestMeta}>Reviewed: {row.reviewed_at}</Text>
                    ) : null}
                    {row.note ? (
                      <Text style={styles.noteText}>Note: {row.note}</Text>
                    ) : null}
                  </View>

                  <StatusPill status={row.status} />
                </View>

                {isPending ? (
                  <>
                    <View style={styles.divider} />

                    <View style={styles.inlineRow}>
                      <Button
                        title={useManual ? "Auto Assign Seats" : "Manual Seat Assign"}
                        variant="secondary"
                        onPress={() => toggleManualSeatMode(row.id)}
                      />
                    </View>

                    {useManual ? (
                      <View style={{ marginTop: SPACING.md }}>
                        <Input
                          label={`Seat numbers (${row.requested_seats} needed)`}
                          placeholder="Example: 2,5,19"
                          value={seatInputByRequest[row.id] || ""}
                          onChangeText={(text: string) =>
                            setSeatInputByRequest((prev) => ({
                              ...prev,
                              [row.id]: text,
                            }))
                          }
                        />
                        <Text style={styles.helpText}>
                          Enter exactly {row.requested_seats} unique seat number(s), comma-separated.
                        </Text>
                      </View>
                    ) : null}

                    <View style={{ marginTop: SPACING.md }}>
                      <Input
                        label="Reject note (optional)"
                        placeholder="Reason for rejection"
                        value={rejectNoteByRequest[row.id] || ""}
                        onChangeText={(text: string) =>
                          setRejectNoteByRequest((prev) => ({
                            ...prev,
                            [row.id]: text,
                          }))
                        }
                      />
                    </View>

                    <View style={styles.actionsRow}>
                      <Button
                        title={isApproving ? "Approving..." : "Approve"}
                        onPress={() => onApprove(row)}
                        disabled={isApproving || isRejecting}
                        leftIcon={
                          !isApproving ? (
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={18}
                              color={COLORS.white}
                            />
                          ) : undefined
                        }
                      />

                      <Button
                        title={isRejecting ? "Rejecting..." : "Reject"}
                        variant="secondary"
                        onPress={() => onReject(row)}
                        disabled={isApproving || isRejecting}
                        leftIcon={
                          !isRejecting ? (
                            <Ionicons
                              name="close-circle-outline"
                              size={18}
                              color={COLORS.dark}
                            />
                          ) : undefined
                        }
                      />
                    </View>
                  </>
                ) : null}
              </Card>
            );
          })
        )}
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

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  requestCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },

  requestTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  requestTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  requestMeta: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  noteText: {
    marginTop: 8,
    fontFamily: FONT.medium,
    fontSize: 12,
    color: COLORS.text,
  },

  helpText: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 11,
    color: COLORS.gray,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },

  inlineRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  statusText: {
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