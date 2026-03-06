// app/(tabs)/groups/add-membership.tsx
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
  TouchableOpacity,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  createMembership,
  getApiErrorMessage,
  Group,
  GroupMembership,
  listGroupMemberships,
  listGroups,
} from "@/services/groups";
import {
  canJoinGroup,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type AddMembershipUser = Partial<MeResponse> & Partial<SessionUser>;

function GroupCard({
  group,
  selected,
  disabled,
  onPress,
  alreadyJoined,
}: {
  group: Group;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  alreadyJoined?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.groupCard,
        selected && styles.groupCardSelected,
        disabled && styles.groupCardDisabled,
      ]}
    >
      <View style={styles.groupCardTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.groupTitle}>{group.name}</Text>
          <Text style={styles.groupSub}>
            {alreadyJoined
              ? "You already belong to this group"
              : group.created_at
              ? `Created ${group.created_at}`
              : "Available to join"}
          </Text>
        </View>

        <View style={styles.groupRight}>
          {alreadyJoined ? (
            <Text style={styles.joinedBadge}>JOINED</Text>
          ) : selected ? (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={COLORS.success}
            />
          ) : (
            <Ionicons
              name="ellipse-outline"
              size={20}
              color={COLORS.gray}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AddMembershipScreen() {
  const [user, setUser] = useState<AddMembershipUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);
  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const joinedGroupIds = useMemo(() => {
    return new Set(
      memberships
        .map((m: any) => {
          const g = m?.group;
          if (typeof g === "number") return g;
          if (g && typeof g === "object" && typeof g.id === "number") return g.id;
          return null;
        })
        .filter((id: number | null): id is number => typeof id === "number")
    );
  }, [memberships]);

  const availableGroups = useMemo(() => {
    return groups.filter((g) => !joinedGroupIds.has(g.id));
  }, [groups, joinedGroupIds]);

  const selectedGroup = useMemo(() => {
    return groups.find((g) => g.id === selectedGroupId) ?? null;
  }, [groups, selectedGroupId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, groupsRes, membershipsRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          listGroups(),
          listGroupMemberships(),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: AddMembershipUser | null =
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null;

      setUser(mergedUser);

      setGroups(
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : []
      );

      setMemberships(
        membershipsRes.status === "fulfilled" && Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : []
      );

      if (groupsRes.status === "rejected") {
        setError(getApiErrorMessage(groupsRes.reason));
      } else if (membershipsRes.status === "rejected") {
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

  const handleSubmit = useCallback(async () => {
    if (!user) {
      router.replace(ROUTES.auth.login);
      return;
    }

    if (!joinAllowed) {
      router.push(ROUTES.tabs.profileKyc);
      return;
    }

    if (!selectedGroupId) {
      Alert.alert("Group Membership", "Please select a group first.");
      return;
    }

    if (!user.id) {
      Alert.alert(
        "Group Membership",
        "Your user profile is incomplete. Please refresh and try again."
      );
      return;
    }

    try {
      setSubmitting(true);

      await createMembership({
        group: selectedGroupId,
        user: Number(user.id),
        role: "MEMBER",
        is_active: true,
      });

      Alert.alert(
        "Success",
        "Group membership created successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace(ROUTES.tabs.groupsMemberships),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Group Membership", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [joinAllowed, selectedGroupId, user]);

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
          subtitle="Please login to add a group membership."
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
          <Text style={styles.hTitle}>Add Membership</Text>
          <Text style={styles.hSub}>
            {isAdmin
              ? "Create a group membership record"
              : "Join an available group"}
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
        <Section title="KYC Required">
          <Card style={styles.noticeCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              You can browse groups, but completing KYC is required before joining a group.
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
          <Text style={styles.summaryLabel}>All Groups</Text>
          <Text style={styles.summaryValue}>{groups.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available</Text>
          <Text style={styles.summaryValue}>{availableGroups.length}</Text>
        </View>
      </View>

      <Section title="Available Groups">
        {availableGroups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No available groups"
            subtitle="You already belong to all listed groups, or no groups have been created yet."
            actionLabel="View Memberships"
            onAction={() => router.push(ROUTES.tabs.groupsMemberships)}
          />
        ) : (
          availableGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              selected={selectedGroupId === group.id}
              onPress={() => setSelectedGroupId(group.id)}
            />
          ))
        )}
      </Section>

      {groups.some((g) => joinedGroupIds.has(g.id)) ? (
        <Section title="Already Joined">
          {groups
            .filter((g) => joinedGroupIds.has(g.id))
            .map((group) => (
              <GroupCard
                key={`joined-${group.id}`}
                group={group}
                selected={false}
                disabled
                alreadyJoined
                onPress={() => {}}
              />
            ))}
        </Section>
      ) : null}

      <Section title="Selection">
        <Card style={styles.selectionCard}>
          <View style={styles.selectionRow}>
            <Text style={styles.selectionLabel}>Selected group</Text>
            <Text style={styles.selectionValue}>
              {selectedGroup?.name ?? "None"}
            </Text>
          </View>

          <View style={styles.selectionRow}>
            <Text style={styles.selectionLabel}>Role</Text>
            <Text style={styles.selectionValue}>MEMBER</Text>
          </View>

          <View style={styles.selectionRow}>
            <Text style={styles.selectionLabel}>Status</Text>
            <Text style={styles.selectionValue}>ACTIVE</Text>
          </View>

          <View style={{ height: SPACING.md }} />

          <Button
            title={
              !joinAllowed
                ? "Complete KYC"
                : submitting
                ? "Saving..."
                : "Create Membership"
            }
            onPress={
              !joinAllowed
                ? () => router.push(ROUTES.tabs.profileKyc)
                : handleSubmit
            }
            disabled={submitting || (!selectedGroupId && joinAllowed)}
          />
        </Card>
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
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  groupCardSelected: {
    borderColor: COLORS.primary,
  },

  groupCardDisabled: {
    opacity: 0.72,
  },

  groupCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  groupSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  groupRight: {
    alignItems: "flex-end",
  },

  joinedBadge: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: COLORS.success,
  },

  selectionCard: {
    padding: SPACING.md,
  },

  selectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },

  selectionLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  selectionValue: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },
});