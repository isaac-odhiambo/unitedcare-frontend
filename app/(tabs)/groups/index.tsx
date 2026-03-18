// app/(tabs)/groups/index.tsx
// ------------------------------------------------
// ✅ Updated to match latest groups logic
// ✅ Added deep debug logs for session/auth issues
// ✅ Uses listAvailableGroups() instead of old listGroups()
// ✅ Uses richer Group type fields
// ✅ Uses join requests flow instead of old add-membership idea
// ✅ Uses ROUTES consistently
// ✅ Safer session fallback when getMe() fails
// ------------------------------------------------

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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

import { getAccessToken, getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  Group,
  listAvailableGroups,
  listGroupMemberships,
  listMyGroupJoinRequests,
} from "@/services/groups";
import {
  canJoinGroup,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type GroupsUser = Partial<MeResponse> & Partial<SessionUser>;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function getGroupTypeLabel(group: Group) {
  return group.group_type_display || group.group_type || "Group";
}

function getJoinPolicyLabel(group: Group) {
  const v = String(group.join_policy || "").toUpperCase().trim();
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

function toUniqueNumberArray(values: any[]) {
  return Array.from(
    new Set(
      values
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n))
    )
  );
}

function hasUsefulUserIdentity(user: any) {
  if (!user || typeof user !== "object") return false;
  return (
    user.id != null ||
    !!user.phone ||
    !!user.username ||
    !!user.email
  );
}

function GroupCard({
  group,
  isMember,
  hasPendingRequest,
}: {
  group: Group;
  isMember: boolean;
  hasPendingRequest: boolean;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();

  const contributionRule = group.requires_contributions
    ? `${group.contribution_amount || "0"} ${group.contribution_frequency || ""}`.trim()
    : "Optional contributions";

  return (
    <Card style={styles.groupCard}>
      <View style={styles.groupTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.groupTitle}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {getGroupTypeLabel(group)} • {getJoinPolicyLabel(group)}
          </Text>
        </View>

        <Ionicons name="people-outline" size={18} color={COLORS.primary} />
      </View>

      {group.description ? (
        <Text style={styles.groupDescription}>{group.description}</Text>
      ) : null}

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Members</Text>
        <Text style={styles.infoValue}>{group.member_count ?? "—"}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Contribution</Text>
        <Text style={styles.infoValue}>{contributionRule}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Created</Text>
        <Text style={styles.infoValue}>{fmtDate(group.created_at)}</Text>
      </View>

      <View style={styles.badgesRow}>
        {isMember ? (
          <View style={[styles.badgePill, styles.badgeMember]}>
            <Text style={[styles.badgeText, { color: COLORS.success }]}>
              MEMBER
            </Text>
          </View>
        ) : null}

        {!isMember && hasPendingRequest ? (
          <View style={[styles.badgePill, styles.badgePending]}>
            <Text style={[styles.badgeText, { color: COLORS.warning }]}>
              REQUEST PENDING
            </Text>
          </View>
        ) : null}

        {!isMember && !hasPendingRequest && joinPolicy === "OPEN" ? (
          <View style={[styles.badgePill, styles.badgeOpen]}>
            <Text style={[styles.badgeText, { color: COLORS.primary }]}>
              OPEN
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        <Text
          style={styles.link}
          onPress={() =>
            router.push(ROUTES.dynamic.groupDetail(group.id) as any)
          }
        >
          View details
        </Text>

        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </View>
    </Card>
  );
}

export default function GroupsIndexScreen() {
  const [user, setUser] = useState<GroupsUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myMembershipGroupIds, setMyMembershipGroupIds] = useState<number[]>([]);
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);
  const isAdmin = isAdminUser(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc as any);
  }, []);

  const load = useCallback(async (mountedRef?: { current: boolean }) => {
    const safeSet = (fn: () => void) => {
      if (!mountedRef || mountedRef.current) fn();
    };

    try {
      safeSet(() => setError(""));

      console.log("========================================");
      console.log("GROUPS DEBUG: START LOAD");

      const token = await getAccessToken();
      console.log("GROUPS DEBUG: access token exists =", !!token);
      console.log(
        "GROUPS DEBUG: access token preview =",
        token ? `${String(token).slice(0, 18)}...` : null
      );

      const [sessionRes, meRes, groupsRes, membershipsRes, joinReqRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listAvailableGroups(),
          listGroupMemberships(),
          listMyGroupJoinRequests(),
        ]);

      console.log("GROUPS DEBUG: sessionRes.status =", sessionRes.status);
      if (sessionRes.status === "fulfilled") {
        console.log("GROUPS DEBUG: sessionRes.value =", sessionRes.value);
        console.log(
          "GROUPS DEBUG: session has useful identity =",
          hasUsefulUserIdentity(sessionRes.value)
        );
      } else {
        console.log("GROUPS DEBUG: sessionRes.reason =", sessionRes.reason);
      }

      console.log("GROUPS DEBUG: meRes.status =", meRes.status);
      if (meRes.status === "fulfilled") {
        console.log("GROUPS DEBUG: meRes.value =", meRes.value);
        console.log(
          "GROUPS DEBUG: me has useful identity =",
          hasUsefulUserIdentity(meRes.value)
        );
      } else {
        console.log("GROUPS DEBUG: meRes.reason =", meRes.reason);
        console.log(
          "GROUPS DEBUG: me error message =",
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason)
        );
      }

      console.log("GROUPS DEBUG: groupsRes.status =", groupsRes.status);
      if (groupsRes.status === "fulfilled") {
        console.log(
          "GROUPS DEBUG: groups count =",
          Array.isArray(groupsRes.value) ? groupsRes.value.length : "not-array"
        );
      } else {
        console.log("GROUPS DEBUG: groupsRes.reason =", groupsRes.reason);
        console.log(
          "GROUPS DEBUG: groups error =",
          getApiErrorMessage(groupsRes.reason) || getErrorMessage(groupsRes.reason)
        );
      }

      console.log("GROUPS DEBUG: membershipsRes.status =", membershipsRes.status);
      if (membershipsRes.status === "fulfilled") {
        console.log(
          "GROUPS DEBUG: memberships count =",
          Array.isArray(membershipsRes.value)
            ? membershipsRes.value.length
            : "not-array"
        );
        console.log("GROUPS DEBUG: memberships raw =", membershipsRes.value);
      } else {
        console.log("GROUPS DEBUG: membershipsRes.reason =", membershipsRes.reason);
        console.log(
          "GROUPS DEBUG: memberships error =",
          getApiErrorMessage(membershipsRes.reason) ||
            getErrorMessage(membershipsRes.reason)
        );
      }

      console.log("GROUPS DEBUG: joinReqRes.status =", joinReqRes.status);
      if (joinReqRes.status === "fulfilled") {
        console.log(
          "GROUPS DEBUG: join requests count =",
          Array.isArray(joinReqRes.value) ? joinReqRes.value.length : "not-array"
        );
        console.log("GROUPS DEBUG: join requests raw =", joinReqRes.value);
      } else {
        console.log("GROUPS DEBUG: joinReqRes.reason =", joinReqRes.reason);
        console.log(
          "GROUPS DEBUG: join requests error =",
          getApiErrorMessage(joinReqRes.reason) ||
            getErrorMessage(joinReqRes.reason)
        );
      }

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;

      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      console.log("GROUPS DEBUG: normalized sessionUser =", sessionUser);
      console.log("GROUPS DEBUG: normalized meUser =", meUser);

      const mergedUser: GroupsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
        ? { ...sessionUser }
        : null;

      console.log("GROUPS DEBUG: final mergedUser =", mergedUser);
      console.log(
        "GROUPS DEBUG: final mergedUser has identity =",
        hasUsefulUserIdentity(mergedUser)
      );

      const availableGroups =
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : [];

      const memberships =
        membershipsRes.status === "fulfilled" &&
        Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : [];

      const membershipIds = toUniqueNumberArray(
        memberships.map((m: any) =>
          m.group_id ?? (typeof m.group === "number" ? m.group : m.group?.id)
        )
      );

      const joinRequests =
        joinReqRes.status === "fulfilled" && Array.isArray(joinReqRes.value)
          ? joinReqRes.value
          : [];

      const pendingIds = toUniqueNumberArray(
        joinRequests
          .filter(
            (r: any) => String(r.status || "").toUpperCase().trim() === "PENDING"
          )
          .map((r: any) =>
            r.group_id ?? (typeof r.group === "number" ? r.group : r.group?.id)
          )
      );

      console.log("GROUPS DEBUG: membershipIds =", membershipIds);
      console.log("GROUPS DEBUG: pendingIds =", pendingIds);

      safeSet(() => {
        setUser(mergedUser);
        setGroups(availableGroups);
        setMyMembershipGroupIds(membershipIds);
        setPendingJoinGroupIds(pendingIds);
      });

      let nextError = "";

      if (meRes.status === "rejected" && !sessionUser) {
        nextError =
          getApiErrorMessage(meRes.reason) || getErrorMessage(meRes.reason);
      } else if (groupsRes.status === "rejected") {
        nextError =
          getApiErrorMessage(groupsRes.reason) ||
          getErrorMessage(groupsRes.reason);
      } else if (membershipsRes.status === "rejected") {
        nextError =
          getApiErrorMessage(membershipsRes.reason) ||
          getErrorMessage(membershipsRes.reason);
      } else if (joinReqRes.status === "rejected") {
        nextError =
          getApiErrorMessage(joinReqRes.reason) ||
          getErrorMessage(joinReqRes.reason);
      }

      console.log("GROUPS DEBUG: nextError =", nextError || null);

      safeSet(() => {
        if (nextError) setError(nextError);
      });

      console.log("GROUPS DEBUG: END LOAD");
      console.log("========================================");
    } catch (e: any) {
      console.log("GROUPS DEBUG: CATCH ERROR =", e);
      console.log(
        "GROUPS DEBUG: CATCH MESSAGE =",
        getApiErrorMessage(e) || getErrorMessage(e)
      );

      safeSet(() => {
        setError(getApiErrorMessage(e) || getErrorMessage(e));
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true };

      const run = async () => {
        try {
          if (mountedRef.current) setLoading(true);
          await load(mountedRef);
        } finally {
          if (mountedRef.current) setLoading(false);
        }
      };

      run();

      return () => {
        mountedRef.current = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    const mountedRef = { current: true };

    try {
      setRefreshing(true);
      await load(mountedRef);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [load]);

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      myMemberships: myMembershipGroupIds.length,
      pending: pendingJoinGroupIds.length,
    };
  }, [groups, myMembershipGroupIds, pendingJoinGroupIds]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    console.log("GROUPS DEBUG: rendering empty auth state because user is null");
    console.log("GROUPS DEBUG: current error =", error || null);

    return (
      <View style={styles.page}>
        <EmptyState
          title="Session unavailable"
          subtitle={error || "Please login again to continue."}
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
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.subtitle}>
            Browse welfare, savings, investment, and community groups.
          </Text>
        </View>

        <Ionicons name="people-outline" size={22} color={COLORS.primary} />
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

      {!kycComplete ? (
        <Section title="KYC Required">
          <Card style={styles.noticeCard}>
            <View style={styles.noticeTop}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.warning}
              />
              <Text style={styles.noticeText}>
                You can browse groups, but joining a group requires completed KYC.
              </Text>
            </View>

            <View style={{ marginTop: SPACING.sm }}>
              <Button
                title="Complete KYC"
                variant="secondary"
                onPress={goToKyc}
              />
            </View>
          </Card>
        </Section>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Available Groups</Text>
          <Text style={styles.summaryValue}>{stats.totalGroups}</Text>
        </View>

        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>My Memberships</Text>
          <Text style={styles.summaryValue}>{stats.myMemberships}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Pending Requests</Text>
          <Text style={styles.summaryValue}>{stats.pending}</Text>
        </View>

        <View style={[styles.summaryCard, SHADOW.card]}>
          <Text style={styles.summaryLabel}>Admin Status</Text>
          <Text style={styles.summaryValue}>{isAdmin ? "Yes" : "No"}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsGrid}>
          <Card
            onPress={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAvailable as any)
                : goToKyc()
            }
            style={styles.actionCard}
          >
            <Ionicons name="search-outline" size={22} color={COLORS.white} />
            <Text style={styles.actionTitle}>
              {joinAllowed ? "Browse Groups" : "Complete KYC"}
            </Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={styles.actionCard}
          >
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
            <Text style={styles.actionTitle}>My Memberships</Text>
          </Card>
        </View>

        <View style={[styles.actionsGrid, { marginTop: SPACING.md }]}>
          <Card
            onPress={() => router.push(ROUTES.tabs.groupsJoinRequests as any)}
            style={styles.secondaryActionCard}
          >
            <Ionicons
              name="git-pull-request-outline"
              size={22}
              color={COLORS.primary}
            />
            <Text style={styles.secondaryActionTitle}>My Join Requests</Text>
          </Card>

          {isAdmin ? (
            <Card
              onPress={() =>
                router.push(ROUTES.tabs.groupsAdminJoinRequests as any)
              }
              style={styles.secondaryActionCard}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.secondaryActionTitle}>Admin Requests</Text>
            </Card>
          ) : (
            <Card
              onPress={() => router.push(ROUTES.tabs.groupsMySavings as any)}
              style={styles.secondaryActionCard}
            >
              <Ionicons
                name="wallet-outline"
                size={22}
                color={COLORS.primary}
              />
              <Text style={styles.secondaryActionTitle}>My Group Savings</Text>
            </Card>
          )}
        </View>
      </Section>

      <Section title="Available Groups">
        {groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No groups found"
            subtitle="Available groups will appear here once created by admin."
          />
        ) : (
          groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              isMember={myMembershipGroupIds.includes(g.id)}
              hasPendingRequest={pendingJoinGroupIds.includes(g.id)}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
  },

  noticeCard: {
    padding: SPACING.md,
    ...SHADOW.card,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
    lineHeight: 18,
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

  actionsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
  },

  actionCard: {
    flex: 1,
    padding: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  actionTitle: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    textAlign: "center",
    fontSize: 13,
  },

  secondaryActionCard: {
    flex: 1,
    padding: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  secondaryActionTitle: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    textAlign: "center",
    fontSize: 13,
  },

  groupCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  groupTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  groupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  groupDescription: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  infoRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  infoValue: {
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

  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  badgeMember: {
    backgroundColor: "rgba(46,125,50,0.12)",
  },

  badgePending: {
    backgroundColor: "rgba(245,158,11,0.12)",
  },

  badgeOpen: {
    backgroundColor: "rgba(37,99,235,0.12)",
  },

  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  link: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
  },
});