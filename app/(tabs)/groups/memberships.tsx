// app/(tabs)/groups/memberships.tsx
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
  getApiErrorMessage,
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  Group,
  GroupMembership,
  listGroupMemberships,
  listGroups,
  removeGroupMember,
  updateGroupMembership,
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

function statusColor(active: boolean) {
  return active ? COLORS.success : COLORS.gray;
}

function roleColor(role: string) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return COLORS.info;
  if (r === "MEMBER") return COLORS.primary;
  return COLORS.gray;
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
  isAdmin,
  onToggleStatus,
  onToggleRole,
  onRemove,
}: {
  membership: GroupMembership;
  isAdmin: boolean;
  onToggleStatus: (m: GroupMembership) => void;
  onToggleRole: (m: GroupMembership) => void;
  onRemove: (m: GroupMembership) => void;
}) {
  const groupName = getGroupNameFromMembership(membership);
  const groupId = getGroupIdFromMembership(membership);

  return (
    <Card style={styles.membershipCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{groupName}</Text>
          <Text style={styles.sub}>
            Group ID: {groupId ?? "—"} {membership.joined_at ? `• Joined ${membership.joined_at}` : ""}
          </Text>
        </View>

        <View style={{ gap: 8, alignItems: "flex-end" }}>
          <Pill
            label={String(membership.role || "—").toUpperCase()}
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
          title="View Group"
          variant="secondary"
          onPress={() => {
            if (groupId != null) {
              router.push(ROUTES.dynamic.groupDetail(groupId) as any);
            }
          }}
          style={{ flex: 1 }}
        />

        {isAdmin ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={membership.is_active ? "Deactivate" : "Activate"}
              variant="secondary"
              onPress={() => onToggleStatus(membership)}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>

      {isAdmin ? (
        <>
          <View style={{ height: SPACING.sm }} />
          <View style={styles.actionsRow}>
            <Button
              title={
                String(membership.role).toUpperCase() === "ADMIN"
                  ? "Make Member"
                  : "Make Admin"
              }
              variant="secondary"
              onPress={() => onToggleRole(membership)}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Remove"
              onPress={() => onRemove(membership)}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : null}
    </Card>
  );
}

export default function GroupMembershipsScreen() {
  const [user, setUser] = useState<MembershipsUser | null>(null);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, membershipsRes, groupsRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listGroupMemberships(),
          listGroups(),
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
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const handleToggleStatus = useCallback(
    async (membership: GroupMembership) => {
      if (!isAdmin) return;

      try {
        setSubmittingId(membership.id);
        await updateGroupMembership(membership.id, {
          is_active: !membership.is_active,
        });
        await load();
      } catch (e: any) {
        Alert.alert("Membership", getApiErrorMessage(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [isAdmin, load]
  );

  const handleToggleRole = useCallback(
    async (membership: GroupMembership) => {
      if (!isAdmin) return;

      const nextRole =
        String(membership.role).toUpperCase() === "ADMIN" ? "MEMBER" : "ADMIN";

      try {
        setSubmittingId(membership.id);
        await updateGroupMembership(membership.id, {
          role: nextRole,
        });
        await load();
      } catch (e: any) {
        Alert.alert("Membership", getApiErrorMessage(e));
      } finally {
        setSubmittingId(null);
      }
    },
    [isAdmin, load]
  );

  const handleRemove = useCallback(
    async (membership: GroupMembership) => {
      if (!isAdmin) return;

      Alert.alert(
        "Remove Member",
        `Remove this membership from ${getGroupNameFromMembership(membership)}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                setSubmittingId(membership.id);
                await removeGroupMember(membership.id);
                await load();
              } catch (e: any) {
                Alert.alert("Membership", getApiErrorMessage(e));
              } finally {
                setSubmittingId(null);
              }
            },
          },
        ]
      );
    },
    [isAdmin, load]
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
          subtitle="Please login to access memberships."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
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
          <Text style={styles.hTitle}>Group Memberships</Text>
          <Text style={styles.hSub}>
            {isAdmin ? "Manage group members and roles" : "View your joined groups"}
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
              onPress={() => router.push(ROUTES.tabs.profileKyc)}
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
            title={joinAllowed ? "Add Membership" : "Complete KYC"}
            onPress={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAddMembership)
                : router.push(ROUTES.tabs.profileKyc)
            }
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Browse Groups"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groups)}
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
                ? "Join a group to start participating."
                : "Complete KYC before joining a group."
            }
            actionLabel={joinAllowed ? "Add Membership" : "Complete KYC"}
            onAction={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAddMembership)
                : router.push(ROUTES.tabs.profileKyc)
            }
          />
        ) : (
          grouped.active.map((m) => (
            <View key={m.id} style={{ opacity: submittingId === m.id ? 0.7 : 1 }}>
              <MembershipCard
                membership={m}
                isAdmin={isAdmin}
                onToggleStatus={handleToggleStatus}
                onToggleRole={handleToggleRole}
                onRemove={handleRemove}
              />
            </View>
          ))
        )}
      </Section>

      {grouped.inactive.length > 0 ? (
        <Section title="Inactive Memberships">
          {grouped.inactive.map((m) => (
            <View key={m.id} style={{ opacity: submittingId === m.id ? 0.7 : 1 }}>
              <MembershipCard
                membership={m}
                isAdmin={isAdmin}
                onToggleStatus={handleToggleStatus}
                onToggleRole={handleToggleRole}
                onRemove={handleRemove}
              />
            </View>
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

  link: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
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