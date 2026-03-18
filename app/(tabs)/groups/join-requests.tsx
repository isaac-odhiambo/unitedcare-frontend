// app/(tabs)/groups/join-requests.tsx
// ------------------------------------------------
// ✅ New screen for my group join requests
// ✅ Matches latest services/groups.ts
// ✅ Uses listMyGroupJoinRequests()
// ✅ Uses cancelGroupJoinRequest()
// ✅ Opens related group detail
// ------------------------------------------------

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
    cancelGroupJoinRequest,
    getApiErrorMessage,
    GroupJoinRequest,
    listMyGroupJoinRequests,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type JoinRequestsUser = Partial<MeResponse> & Partial<SessionUser>;

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

function statusLabel(status?: string) {
  return String(status || "PENDING").replaceAll("_", " ").toUpperCase();
}

function StatusPill({ status }: { status?: string }) {
  const color = statusColor(status);

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{statusLabel(status)}</Text>
    </View>
  );
}

function JoinRequestCard({
  item,
  busy,
  onCancel,
}: {
  item: GroupJoinRequest;
  busy: boolean;
  onCancel: (item: GroupJoinRequest) => void;
}) {
  const isPending = String(item.status || "").toUpperCase() === "PENDING";

  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{item.group_name || `Group #${item.group_id}`}</Text>
          <Text style={styles.sub}>
            Request #{item.id} • Created {fmtDate(item.created_at)}
          </Text>
        </View>

        <StatusPill status={item.status} />
      </View>

      {item.note ? <Text style={styles.note}>Note: {item.note}</Text> : null}

      {item.reviewed_at ? (
        <Text style={styles.meta}>Reviewed: {fmtDate(item.reviewed_at)}</Text>
      ) : null}

      <View style={styles.actionsRow}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => {
            if (item.group_id) {
              router.push(ROUTES.dynamic.groupDetail(item.group_id) as any);
            }
          }}
          style={{ flex: 1 }}
        />

        {isPending ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={busy ? "Cancelling..." : "Cancel"}
              onPress={() => onCancel(item)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

export default function GroupJoinRequestsScreen() {
  const [user, setUser] = useState<JoinRequestsUser | null>(null);
  const [rows, setRows] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, rowsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMyGroupJoinRequests(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: JoinRequestsUser | null =
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null;

      setUser(mergedUser);

      setRows(
        rowsRes.status === "fulfilled" && Array.isArray(rowsRes.value)
          ? rowsRes.value
          : []
      );

      if (rowsRes.status === "rejected") {
        setError(getApiErrorMessage(rowsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    }
  }, []);

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

  const handleCancel = useCallback(
    async (item: GroupJoinRequest) => {
      Alert.alert(
        "Cancel Request",
        `Cancel your join request for ${item.group_name || `Group #${item.group_id}`}?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                setSubmittingId(item.id);
                await cancelGroupJoinRequest(item.id);
                await load();
              } catch (e: any) {
                Alert.alert("Join Request", getApiErrorMessage(e));
              } finally {
                setSubmittingId(null);
              }
            },
          },
        ]
      );
    },
    [load]
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to view your group join requests."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
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
          <Text style={styles.hTitle}>My Join Requests</Text>
          <Text style={styles.hSub}>
            Track pending and reviewed requests for group membership.
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
            title="Browse Groups"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="My Memberships"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="Pending Requests">
        {grouped.pending.length === 0 ? (
          <EmptyState
            icon="git-pull-request-outline"
            title="No pending requests"
            subtitle="Any new group join requests you send will appear here."
          />
        ) : (
          grouped.pending.map((item) => (
            <View
              key={item.id}
              style={{ opacity: submittingId === item.id ? 0.7 : 1 }}
            >
              <JoinRequestCard
                item={item}
                busy={submittingId === item.id}
                onCancel={handleCancel}
              />
            </View>
          ))
        )}
      </Section>

      {grouped.reviewed.length > 0 ? (
        <Section title="Reviewed Requests">
          {grouped.reviewed.map((item) => (
            <JoinRequestCard
              key={item.id}
              item={item}
              busy={false}
              onCancel={handleCancel}
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