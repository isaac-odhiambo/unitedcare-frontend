// app/(tabs)/groups/admin-join-requests.tsx
// ------------------------------------------------
// ✅ Admin screen for group join requests
// ✅ Matches latest services/groups.ts
// ✅ Uses listGroupJoinRequests(groupId)
// ✅ Uses approveGroupJoinRequest()
// ✅ Uses rejectGroupJoinRequest()
// ✅ Expects groupId from query params
// ------------------------------------------------

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
import {
    approveGroupJoinRequest,
    getApiErrorMessage,
    getGroup,
    Group,
    GroupJoinRequest,
    listGroupJoinRequests,
    rejectGroupJoinRequest,
} from "@/services/groups";

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function statusColor(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return COLORS.success;
    case "REJECTED":
      return COLORS.danger;
    case "CANCELLED":
      return COLORS.gray;
    case "PENDING":
    default:
      return COLORS.warning;
  }
}

function statusLabel(status?: string | null) {
  return String(status || "PENDING").replaceAll("_", " ").toUpperCase();
}

function groupTypeLabel(group?: Group | null) {
  return group?.group_type_display || group?.group_type || "Group";
}

function Pill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function RequestCard({
  item,
  busy,
  rejecting,
  rejectNote,
  onChangeRejectNote,
  onStartReject,
  onCancelReject,
  onApprove,
  onConfirmReject,
}: {
  item: GroupJoinRequest;
  busy: boolean;
  rejecting: boolean;
  rejectNote: string;
  onChangeRejectNote: (v: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onConfirmReject: () => void;
}) {
  const isPending = String(item.status || "").toUpperCase() === "PENDING";
  const pillColor = statusColor(item.status);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{item.user_name || `User #${item.user_id}`}</Text>
          <Text style={styles.sub}>
            Request #{item.id} • {fmtDate(item.created_at)}
          </Text>
        </View>

        <Pill label={statusLabel(item.status)} color={pillColor} />
      </View>

      {item.note ? <Text style={styles.note}>Member note: {item.note}</Text> : null}

      {item.reviewed_at ? (
        <Text style={styles.meta}>Reviewed: {fmtDate(item.reviewed_at)}</Text>
      ) : null}

      {isPending ? (
        <>
          {!rejecting ? (
            <View style={styles.actionsRow}>
              <Button
                title={busy ? "Approving..." : "Approve"}
                onPress={onApprove}
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
                title="Reject"
                variant="secondary"
                onPress={onStartReject}
                disabled={busy}
                style={{ flex: 1 }}
                leftIcon={
                  <Ionicons
                    name="close-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                }
              />
            </View>
          ) : (
            <View style={styles.rejectBox}>
              <Text style={styles.inputLabel}>Reject note</Text>
              <TextInput
                value={rejectNote}
                onChangeText={onChangeRejectNote}
                placeholder="Optional reason for rejection"
                style={styles.input}
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.actionsRow}>
                <Button
                  title={busy ? "Rejecting..." : "Confirm Reject"}
                  onPress={onConfirmReject}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
                <View style={{ width: SPACING.sm }} />
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={onCancelReject}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          )}
        </>
      ) : null}
    </Card>
  );
}

export default function GroupAdminJoinRequestsScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.groupId ?? params.group_id);

  const [group, setGroup] = useState<Group | null>(null);
  const [rows, setRows] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState("");

  const isValidGroupId = useMemo(
    () => Number.isFinite(groupId) && groupId > 0,
    [groupId]
  );

  const load = useCallback(async () => {
    if (!isValidGroupId) {
      setError("Invalid group id.");
      setGroup(null);
      setRows([]);
      return;
    }

    try {
      setError("");

      const [groupRes, rowsRes] = await Promise.allSettled([
        getGroup(groupId),
        listGroupJoinRequests(groupId),
      ]);

      setGroup(groupRes.status === "fulfilled" ? groupRes.value : null);
      setRows(
        rowsRes.status === "fulfilled" && Array.isArray(rowsRes.value)
          ? rowsRes.value
          : []
      );

      if (groupRes.status === "rejected") {
        setError(getApiErrorMessage(groupRes.reason));
      } else if (rowsRes.status === "rejected") {
        setError(getApiErrorMessage(rowsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, [groupId, isValidGroupId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        try {
          setLoading(true);
          await load();
        } finally {
          if (mounted) setLoading(false);
        }
      };

      run();

      return () => {
        mounted = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const grouped = useMemo(() => {
    const pending = rows.filter(
      (r) => String(r.status || "").toUpperCase() === "PENDING"
    );
    const reviewed = rows.filter(
      (r) => String(r.status || "").toUpperCase() !== "PENDING"
    );
    return { pending, reviewed };
  }, [rows]);

  const handleApprove = useCallback(
    async (item: GroupJoinRequest) => {
      Alert.alert(
        "Approve Request",
        `Approve ${item.user_name || `User #${item.user_id}`} for ${
          group?.name || `Group #${groupId}`
        }?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Approve",
            onPress: async () => {
              try {
                setSubmittingId(item.id);
                await approveGroupJoinRequest(item.id);
                await load();
              } catch (e: any) {
                Alert.alert("Join Requests", getApiErrorMessage(e));
              } finally {
                setSubmittingId(null);
              }
            },
          },
        ]
      );
    },
    [group?.name, groupId, load]
  );

  const handleConfirmReject = useCallback(
    async (item: GroupJoinRequest) => {
      try {
        setSubmittingId(item.id);
        await rejectGroupJoinRequest(item.id, rejectNote.trim());
        setRejectingId(null);
        setRejectNote("");
        await load();
      } catch (e: any) {
        Alert.alert("Join Requests", getApiErrorMessage(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [load, rejectNote]
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!isValidGroupId) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Invalid group"
          subtitle="Open this screen from a valid group."
          actionLabel="Back to Groups"
          onAction={() => router.replace(ROUTES.tabs.groups as any)}
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
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>Admin Join Requests</Text>
          <Text style={styles.hSub}>
            {group?.name || `Group #${groupId}`} • {groupTypeLabel(group)}
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Refresh"
          onPress={onRefresh}
          leftIcon={
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          }
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending</Text>
          <Text style={styles.summaryValue}>{grouped.pending.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Reviewed</Text>
          <Text style={styles.summaryValue}>{grouped.reviewed.length}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsRow}>
          <Button
            title="Open Group"
            onPress={() => router.push(ROUTES.dynamic.groupDetail(groupId) as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="My Memberships"
            variant="secondary"
            onPress={() => router.push(ROUTES.dynamic.groupMemberships(groupId) as any)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="Pending Requests">
        {grouped.pending.length === 0 ? (
          <EmptyState
            icon="git-pull-request-outline"
            title="No pending requests"
            subtitle="New member requests awaiting review will appear here."
          />
        ) : (
          grouped.pending.map((item) => (
            <View
              key={item.id}
              style={{ opacity: submittingId === item.id ? 0.7 : 1 }}
            >
              <RequestCard
                item={item}
                busy={submittingId === item.id}
                rejecting={rejectingId === item.id}
                rejectNote={rejectingId === item.id ? rejectNote : ""}
                onChangeRejectNote={setRejectNote}
                onStartReject={() => {
                  setRejectingId(item.id);
                  setRejectNote(item.note || "");
                }}
                onCancelReject={() => {
                  setRejectingId(null);
                  setRejectNote("");
                }}
                onApprove={() => handleApprove(item)}
                onConfirmReject={() => handleConfirmReject(item)}
              />
            </View>
          ))
        )}
      </Section>

      {grouped.reviewed.length > 0 ? (
        <Section title="Reviewed Requests">
          {grouped.reviewed.map((item) => (
            <RequestCard
              key={item.id}
              item={item}
              busy={false}
              rejecting={false}
              rejectNote=""
              onChangeRejectNote={() => {}}
              onStartReject={() => {}}
              onCancelReject={() => {}}
              onApprove={() => {}}
              onConfirmReject={() => {}}
            />
          ))}
        </Section>
      ) : null}

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

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
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
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  meta: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  rejectBox: {
    marginTop: SPACING.md,
  },

  inputLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textMuted,
  },

  input: {
    minHeight: 84,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
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
    color: COLORS.text,
    fontFamily: FONT.medium,
  },
});