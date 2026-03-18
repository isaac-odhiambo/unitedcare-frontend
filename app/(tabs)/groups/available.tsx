// app/(tabs)/groups/available.tsx
// ------------------------------------------------
// ✅ New available groups screen
// ✅ Matches latest services/groups.ts
// ✅ Uses listAvailableGroups()
// ✅ Uses listGroupMemberships() to mark joined groups
// ✅ Uses listMyGroupJoinRequests() to mark pending requests
// ✅ Uses createGroupJoinRequest() for join flow
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
    createGroupJoinRequest,
    getApiErrorMessage,
    Group,
    listAvailableGroups,
    listGroupMemberships,
    listMyGroupJoinRequests,
} from "@/services/groups";
import {
    canJoinGroup,
    getMe,
    isKycComplete,
    MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type AvailableGroupsUser = Partial<MeResponse> & Partial<SessionUser>;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function groupTypeLabel(group: Group) {
  return group.group_type_display || group.group_type || "Group";
}

function joinPolicyLabel(group: Group) {
  return String(group.join_policy || "—").replaceAll("_", " ");
}

function contributionLabel(group: Group) {
  if (!group.requires_contributions) return "Optional contributions";
  return `${group.contribution_amount || "0"} ${group.contribution_frequency || ""}`.trim();
}

function pillColor(type: "joined" | "pending" | "open" | "closed") {
  switch (type) {
    case "joined":
      return COLORS.success;
    case "pending":
      return COLORS.warning;
    case "open":
      return COLORS.primary;
    case "closed":
    default:
      return COLORS.gray;
  }
}

function Pill({
  label,
  type,
}: {
  label: string;
  type: "joined" | "pending" | "open" | "closed";
}) {
  const color = pillColor(type);

  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function GroupCard({
  group,
  joined,
  pending,
  canRequestJoin,
  busy,
  onJoin,
}: {
  group: Group;
  joined: boolean;
  pending: boolean;
  canRequestJoin: boolean;
  busy: boolean;
  onJoin: (group: Group) => void;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase();

  return (
    <Card style={styles.groupCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.sub}>
            {groupTypeLabel(group)} • {joinPolicyLabel(group)}
          </Text>
        </View>

        <Ionicons name="people-outline" size={18} color={COLORS.primary} />
      </View>

      {group.description ? (
        <Text style={styles.description}>{group.description}</Text>
      ) : null}

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Members</Text>
        <Text style={styles.kvValue}>{group.member_count ?? "—"}</Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Contribution</Text>
        <Text style={styles.kvValue}>{contributionLabel(group)}</Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Created</Text>
        <Text style={styles.kvValue}>{fmtDate(group.created_at)}</Text>
      </View>

      <View style={styles.badgesRow}>
        {joined ? <Pill label="MEMBER" type="joined" /> : null}
        {!joined && pending ? <Pill label="REQUEST PENDING" type="pending" /> : null}
        {!joined && !pending && joinPolicy === "OPEN" ? (
          <Pill label="OPEN" type="open" />
        ) : null}
        {joinPolicy === "CLOSED" ? <Pill label="CLOSED" type="closed" /> : null}
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
          style={{ flex: 1 }}
        />

        {!joined && !pending ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={busy ? "Please wait..." : joinPolicy === "OPEN" ? "Join" : "Request Join"}
              onPress={() => onJoin(group)}
              disabled={!canRequestJoin || busy || joinPolicy === "CLOSED"}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

export default function AvailableGroupsScreen() {
  const [user, setUser] = useState<AvailableGroupsUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<number[]>([]);
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingGroupId, setSubmittingGroupId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, groupsRes, membershipsRes, joinReqRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listAvailableGroups(),
          listGroupMemberships(),
          listMyGroupJoinRequests(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: AvailableGroupsUser | null =
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null;

      setUser(mergedUser);

      setGroups(
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : []
      );

      const memberships =
        membershipsRes.status === "fulfilled" && Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : [];
      setJoinedGroupIds(
        memberships
          .map((m: any) =>
            Number(m.group_id ?? (typeof m.group === "number" ? m.group : m.group?.id))
          )
          .filter((n: number) => Number.isFinite(n))
      );

      const joinRequests =
        joinReqRes.status === "fulfilled" && Array.isArray(joinReqRes.value)
          ? joinReqRes.value
          : [];
      setPendingJoinGroupIds(
        joinRequests
          .filter((r: any) => String(r.status || "").toUpperCase() === "PENDING")
          .map((r: any) => Number(r.group_id ?? r.group))
          .filter((n: number) => Number.isFinite(n))
      );

      if (groupsRes.status === "rejected") {
        setError(getApiErrorMessage(groupsRes.reason));
      } else if (membershipsRes.status === "rejected") {
        setError(getApiErrorMessage(membershipsRes.reason));
      } else if (joinReqRes.status === "rejected") {
        setError(getApiErrorMessage(joinReqRes.reason));
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

  const stats = useMemo(() => {
    return {
      total: groups.length,
      joined: joinedGroupIds.length,
      pending: pendingJoinGroupIds.length,
    };
  }, [groups, joinedGroupIds, pendingJoinGroupIds]);

  const handleJoin = useCallback(
    async (group: Group) => {
      if (!joinAllowed) {
        Alert.alert("Groups", "Complete KYC before joining a group.");
        return;
      }

      const actionLabel =
        String(group.join_policy || "").toUpperCase() === "OPEN"
          ? "join"
          : "send a join request for";

      Alert.alert(
        "Join Group",
        `Do you want to ${actionLabel} ${group.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: async () => {
              try {
                setSubmittingGroupId(group.id);
                const res = await createGroupJoinRequest({
                  group_id: group.id,
                  note: "",
                });

                Alert.alert(
                  "Groups",
                  res?.message || "Request submitted successfully."
                );
                await load();
              } catch (e: any) {
                Alert.alert("Groups", getApiErrorMessage(e));
              } finally {
                setSubmittingGroupId(null);
              }
            },
          },
        ]
      );
    },
    [joinAllowed, load]
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
          subtitle="Please login to browse groups."
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
          <Text style={styles.hTitle}>Available Groups</Text>
          <Text style={styles.hSub}>
            Browse groups and submit a join request.
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

      {!kycComplete ? (
        <Section title="KYC Notice">
          <Card style={styles.noticeCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              You can browse groups, but joining requires completed KYC.
            </Text>
            <View style={{ height: SPACING.sm }} />
            <Button
              title="Complete KYC"
              variant="secondary"
              onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
            />
          </Card>
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available</Text>
          <Text style={styles.summaryValue}>{stats.total}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Joined</Text>
          <Text style={styles.summaryValue}>{stats.joined}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Pending Requests</Text>
          <Text style={styles.summaryValue}>{stats.pending}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Join Status</Text>
          <Text style={styles.summaryValue}>{joinAllowed ? "Allowed" : "KYC Needed"}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsRow}>
          <Button
            title="My Memberships"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="My Join Requests"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsJoinRequests as any)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="Groups">
        {groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No groups found"
            subtitle="Groups created by admin will appear here."
          />
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              joined={joinedGroupIds.includes(group.id)}
              pending={pendingJoinGroupIds.includes(group.id)}
              canRequestJoin={joinAllowed}
              busy={submittingGroupId === group.id}
              onJoin={handleJoin}
            />
          ))
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

  noticeCard: {
    padding: SPACING.md,
  },

  noticeText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
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

  groupCard: {
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

  description: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  badgesRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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