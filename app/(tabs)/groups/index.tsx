// app/(tabs)/groups/index.tsx

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

import { getErrorMessage } from "@/services/api";
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
  return user.id != null || !!user.phone || !!user.username || !!user.email;
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
    : "Optional";

  return (
    <Card
      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
      style={styles.groupCard}
    >
      <View style={styles.groupTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={18} color={COLORS.white} />
        </View>

        <View style={styles.groupTextWrap}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.groupMeta}>
            {getGroupTypeLabel(group)} • {getJoinPolicyLabel(group)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textMuted || COLORS.gray}
        />
      </View>

      {group.description ? (
        <Text style={styles.groupDescription} numberOfLines={3}>
          {group.description}
        </Text>
      ) : null}

      <View style={styles.groupInfoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Members</Text>
          <Text style={styles.infoValue}>{group.member_count ?? "—"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contribution</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {contributionRule}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{fmtDate(group.created_at)}</Text>
        </View>
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
              PENDING
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

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>Open group</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
      </View>
    </Card>
  );
}

export default function GroupsIndexScreen() {
  const [user, setUser] = useState<GroupsUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [myMembershipGroupIds, setMyMembershipGroupIds] = useState<number[]>(
    []
  );
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAvailableGroups, setShowAvailableGroups] = useState(false);

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc as any);
  }, []);

  const load = useCallback(async (mountedRef?: { current: boolean }) => {
    const safeSet = (fn: () => void) => {
      if (!mountedRef || mountedRef.current) fn();
    };

    try {
      safeSet(() => setError(""));

      const [sessionRes, meRes, groupsRes, membershipsRes, joinReqRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listAvailableGroups(),
          listGroupMemberships(),
          listMyGroupJoinRequests(),
        ]);

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: GroupsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
        ? { ...sessionUser }
        : null;

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

      safeSet(() => {
        if (nextError) setError(nextError);
      });
    } catch (e: any) {
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
    };
  }, [groups, myMembershipGroupIds]);

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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.title}>Groups</Text>
            <Text style={styles.subtitle}>
              Join support, savings, welfare, and community groups.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Available</Text>
            <Text style={styles.heroStatValue}>{stats.totalGroups}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Joined</Text>
            <Text style={styles.heroStatValue}>{stats.myMemberships}</Text>
          </View>
        </View>
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
        <Card style={styles.noticeCard}>
          <View style={styles.noticeTop}>
            <View style={styles.noticeIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.warning}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.noticeTitle}>Complete KYC to join</Text>
              <Text style={styles.noticeText}>
                You can browse groups now. KYC is required before joining.
              </Text>
            </View>
          </View>

          <View style={{ marginTop: SPACING.md }}>
            <Button
              title="Complete KYC"
              variant="secondary"
              onPress={goToKyc}
            />
          </View>
        </Card>
      ) : null}

      <Section title="Actions">
        <View style={styles.actionsGrid}>
          <Card
            onPress={() =>
              joinAllowed
                ? setShowAvailableGroups((prev) => !prev)
                : goToKyc()
            }
            style={styles.primaryActionCard}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name={showAvailableGroups ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.primaryActionTitle}>
              {showAvailableGroups ? "Hide Available Groups" : "View Available Groups"}
            </Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={styles.primaryActionCardAlt}
          >
            <View style={styles.actionIconCircleAlt}>
              <Ionicons name="people-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.primaryActionTitleAlt}>My Groups</Text>
          </Card>
        </View>
      </Section>

      {showAvailableGroups ? (
        <Section title="Available Groups">
          {groups.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No groups found"
              subtitle="Available groups will appear here once created."
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
      ) : null}

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 28,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  title: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.85)",
    fontFamily: FONT.regular,
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(220,53,69,0.08)",
    borderWidth: 1,
    borderColor: "rgba(220,53,69,0.18)",
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  noticeCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
  },

  noticeTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  noticeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
    lineHeight: 18,
  },

  actionsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
  },

  primaryActionCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
    ...SHADOW.card,
  },

  primaryActionCardAlt: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  actionIconCircleAlt: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(37,99,235,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  primaryActionTitle: {
    color: COLORS.white,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  primaryActionTitleAlt: {
    color: COLORS.text,
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  groupCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  groupTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },

  groupTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.text,
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
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  groupInfoBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },

  infoRow: {
    paddingVertical: 8,
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
    color: COLORS.text,
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

  cardFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardFooterText: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
    fontSize: 12,
  },
});