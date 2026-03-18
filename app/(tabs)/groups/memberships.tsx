// app/(tabs)/groups/memberships.tsx
// ------------------------------------------------
// ✅ Updated to match latest groups flow
// ✅ Uses listGroupMemberships() only for my memberships
// ✅ Uses listAvailableGroups() instead of old listGroups()
// ✅ Removes old "Add Membership" direct flow
// ✅ Uses browse/join-request flow
// ✅ Uses richer Group type
// ✅ Uses ROUTES consistently
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
  View
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  Group,
  GroupMembership,
  listAvailableGroups,
  listGroupMemberships,
} from "@/services/groups";
import {
  canJoinGroup,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MembershipsUser = Partial<MeResponse> & Partial<SessionUser>;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function statusColor(active: boolean) {
  return active ? COLORS.success : COLORS.gray;
}

function roleColor(role: string) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return COLORS.info;
  if (r === "TREASURER") return COLORS.warning;
  if (r === "SECRETARY") return COLORS.primary;
  if (r === "MEMBER") return COLORS.primary;
  return COLORS.gray;
}

function roleText(role?: string) {
  const r = String(role || "").toUpperCase();
  return r ? r.replaceAll("_", " ") : "—";
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

function MembershipCard({
  membership,
}: {
  membership: GroupMembership;
}) {
  const groupName = getGroupNameFromMembership(membership);
  const groupId = getGroupIdFromMembership(membership);

  return (
    <Card style={styles.membershipCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{groupName}</Text>
          <Text style={styles.sub}>
            Group ID: {groupId ?? "—"}
            {membership.joined_at ? ` • Joined ${fmtDate(membership.joined_at)}` : ""}
          </Text>
        </View>

        <View style={{ gap: 8, alignItems: "flex-end" }}>
          <Pill
            label={roleText(membership.role).toUpperCase()}
            color={roleColor(String(membership.role))}
          />
          <Pill
            label={membership.is_active ? "ACTIVE" : "INACTIVE"}
            color={statusColor(!!membership.is_active)}
          />
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => {
            if (groupId != null) {
              router.push(ROUTES.dynamic.groupDetail(groupId) as any);
            }
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

export default function GroupMembershipsScreen() {
  const [user, setUser] = useState<MembershipsUser | null>(null);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, membershipsRes, groupsRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listGroupMemberships(),
          listAvailableGroups(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: MembershipsUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setMemberships(
        membershipsRes.status === "fulfilled" && Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : []
      );

      setGroups(
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : []
      );

      if (membershipsRes.status === "rejected") {
        setError(getApiErrorMessage(membershipsRes.reason));
      } else if (groupsRes.status === "rejected") {
        setError(getApiErrorMessage(groupsRes.reason));
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
    const active = memberships.filter((m) => !!m.is_active);
    const inactive = memberships.filter((m) => !m.is_active);
    return { active, inactive };
  }, [memberships]);

  const joinedGroupIds = useMemo(() => {
    return new Set(
      memberships
        .map((m) => getGroupIdFromMembership(m))
        .filter((id): id is number => typeof id === "number")
    );
  }, [memberships]);

  const availableGroupsCount = useMemo(() => {
    return groups.filter((g) => !joinedGroupIds.has(g.id)).length;
  }, [groups, joinedGroupIds]);

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
          subtitle="Please login to access memberships."
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
          <Text style={styles.hTitle}>My Group Memberships</Text>
          <Text style={styles.hSub}>
            {isAdmin
              ? "View your memberships and open groups you manage"
              : "View the groups you have joined"}
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
              You can view your memberships, but joining a new group requires completed KYC.
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
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{grouped.active.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Inactive</Text>
          <Text style={styles.summaryValue}>{grouped.inactive.length}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>All Memberships</Text>
          <Text style={styles.summaryValue}>{memberships.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available Groups</Text>
          <Text style={styles.summaryValue}>{availableGroupsCount}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsRow}>
          <Button
            title={joinAllowed ? "Browse Groups" : "Complete KYC"}
            onPress={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAvailable as any)
                : router.push(ROUTES.tabs.profileKyc as any)
            }
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

      <Section title="Active Memberships">
        {grouped.active.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No active memberships"
            subtitle={
              joinAllowed
                ? "Browse available groups and send a join request."
                : "Complete KYC before joining a group."
            }
            actionLabel={joinAllowed ? "Browse Groups" : "Complete KYC"}
            onAction={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAvailable as any)
                : router.push(ROUTES.tabs.profileKyc as any)
            }
          />
        ) : (
          grouped.active.map((m) => <MembershipCard key={m.id} membership={m} />)
        )}
      </Section>

      {grouped.inactive.length > 0 ? (
        <Section title="Inactive Memberships">
          {grouped.inactive.map((m) => (
            <MembershipCard key={m.id} membership={m} />
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

  membershipCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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