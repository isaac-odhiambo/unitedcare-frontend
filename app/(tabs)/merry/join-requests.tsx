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
  TextInput,
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
  adminApproveJoinRequest,
  adminListJoinRequests,
  adminRejectJoinRequest,
  getApiErrorMessage,
  getMerryDetail,
  JoinRequestRow,
  MerryDetail,
} from "@/services/merry";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type AdminJoinUser = Partial<MeResponse> & Partial<SessionUser>;
type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return COLORS.success;
  if (s === "PENDING") return COLORS.warning;
  if (["REJECTED", "CANCELLED"].includes(s)) return COLORS.danger;
  return COLORS.gray;
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status);

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{String(status || "—").toUpperCase()}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: FilterStatus;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
        {label}
      </Text>
    </Card>
  );
}

export default function AdminJoinRequestsScreen() {
  const params = useLocalSearchParams<{ merryId?: string }>();
  const merryId = Number(params.merryId ?? 0);

  const [user, setUser] = useState<AdminJoinUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [requests, setRequests] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});

  const isAdmin = isAdminUser(user);

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, merryRes, reqRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMerryDetail(merryId),
        adminListJoinRequests(merryId, filter === "ALL" ? undefined : filter),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser =
        meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (merryRes.status === "fulfilled") {
        setMerry(merryRes.value);
      } else {
        setMerry(null);
        setError(getApiErrorMessage(merryRes.reason) || getErrorMessage(merryRes.reason));
      }

      if (reqRes.status === "fulfilled") {
        setRequests(Array.isArray(reqRes.value) ? reqRes.value : []);
      } else {
        setRequests([]);
        setError(getApiErrorMessage(reqRes.reason) || getErrorMessage(reqRes.reason));
      }
    } catch (e: any) {
      setRequests([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filter, merryId]);

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
    return {
      total: requests.length,
      pending: requests.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
      approved: requests.filter((r) => String(r.status).toUpperCase() === "APPROVED").length,
      rejected: requests.filter((r) =>
        ["REJECTED", "CANCELLED"].includes(String(r.status).toUpperCase())
      ).length,
    };
  }, [requests]);

  const handleApprove = useCallback(
    async (req: JoinRequestRow) => {
      try {
        setSubmittingId(req.id);
        await adminApproveJoinRequest(req.id);

        Alert.alert("Approved", "Join request approved successfully.");
        await load();
      } catch (e: any) {
        Alert.alert("Approve failed", getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [load]
  );

  const handleReject = useCallback(
    async (req: JoinRequestRow) => {
      try {
        setSubmittingId(req.id);
        const note = (rejectNotes[req.id] || "").trim();

        await adminRejectJoinRequest(req.id, note ? { note } : {});
        Alert.alert("Rejected", "Join request rejected.");
        await load();
      } catch (e: any) {
        Alert.alert("Reject failed", getApiErrorMessage(e) || getErrorMessage(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [load, rejectNotes]
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
      <View style={styles.container}>
        <EmptyState
          title="Invalid merry"
          subtitle="No merry was selected."
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Admin access required"
          subtitle="Only admins can manage merry join requests."
          actionLabel="Back to Merry"
          onAction={() => router.replace(ROUTES.tabs.merry)}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Join Requests</Text>
          <Text style={styles.hSub}>
            {merry?.name || `Merry #${merryId}`} • Admin Review
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Back"
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

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Requests</Text>
          <Text style={styles.summaryValue}>{totals.total}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{totals.pending}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Approved</Text>
          <Text style={styles.summaryValue}>{totals.approved}</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Rejected</Text>
          <Text style={styles.summaryValue}>{totals.rejected}</Text>
        </View>
      </View>

      <Section title="Filter">
        <View style={styles.filterRow}>
          {(["ALL", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as FilterStatus[]).map(
            (item) => (
              <FilterChip
                key={item}
                label={item}
                active={filter === item}
                onPress={() => setFilter(item)}
              />
            )
          )}
        </View>
      </Section>

      <Section title="Requests">
        {requests.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No join requests"
            subtitle="No requests were found for this filter."
          />
        ) : (
          requests.map((req) => {
            const pending = String(req.status).toUpperCase() === "PENDING";
            const busy = submittingId === req.id;

            return (
              <Card key={req.id} style={styles.itemCard}>
                <View style={styles.topRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.title}>
                      {req.username || `User #${req.user_id ?? "—"}`}
                    </Text>
                    <Text style={styles.sub}>
                      {req.phone || "No phone"} {req.created_at ? `• ${req.created_at}` : ""}
                    </Text>
                  </View>

                  <StatusPill status={req.status} />
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Requested seats</Text>
                  <Text style={styles.kvValue}>{String(req.requested_seats ?? 0)}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Note</Text>
                  <Text style={styles.kvValue}>{req.note || "—"}</Text>
                </View>

                {pending ? (
                  <>
                    <Text style={styles.inputLabel}>Reject note (optional)</Text>
                    <TextInput
                      value={rejectNotes[req.id] || ""}
                      onChangeText={(text) =>
                        setRejectNotes((prev) => ({ ...prev, [req.id]: text }))
                      }
                      placeholder="Reason for rejection"
                      placeholderTextColor={COLORS.gray}
                      style={styles.input}
                    />

                    <View style={styles.actionsRow}>
                      <Button
                        title={busy ? "Working..." : "Approve"}
                        onPress={() => handleApprove(req)}
                        disabled={busy}
                        style={{ flex: 1 }}
                        leftIcon={
                          <Ionicons
                            name="checkmark-outline"
                            size={18}
                            color={COLORS.white}
                          />
                        }
                      />
                      <View style={{ width: SPACING.sm }} />
                      <Button
                        title={busy ? "Working..." : "Reject"}
                        variant="secondary"
                        onPress={() => handleReject(req)}
                        disabled={busy}
                        style={{ flex: 1 }}
                        leftIcon={
                          <Ionicons
                            name="close-outline"
                            size={18}
                            color={COLORS.dark}
                          />
                        }
                      />
                    </View>
                  </>
                ) : (
                  <View style={styles.actionsRow}>
                    <Button
                      title="Open Merry"
                      variant="secondary"
                      onPress={() =>
                        router.push(ROUTES.dynamic.merryDetail(merryId) as any)
                      }
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  summaryLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  summaryValue: {
    marginTop: 6,
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.dark,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm as any,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },

  filterChipText: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },

  filterChipTextActive: {
    color: COLORS.primary,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  kvRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  kvLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.dark,
  },

  inputLabel: {
    marginTop: SPACING.md,
    marginBottom: 8,
    fontFamily: FONT.medium,
    fontSize: 12,
    color: COLORS.dark,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    color: COLORS.dark,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    marginRight: 6,
  },

  pillText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: COLORS.text,
  },
});