// app/(tabs)/groups/available.tsx

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

function groupTypeLabel(group: Group) {
  return group.group_type_display || group.group_type || "Group";
}

function joinPolicyLabel(group: Group) {
  const value = String(group.join_policy || "").toUpperCase().trim();
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function contributionLabel(group: Group) {
  if (!group.requires_contributions) return "Optional";
  return `${group.contribution_amount || "0"} ${group.contribution_frequency || ""}`.trim();
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "member" | "pending" | "open" | "closed";
}) {
  const toneStyles =
    tone === "member"
      ? {
          bg: "rgba(46,125,50,0.12)",
          color: COLORS.success,
        }
      : tone === "pending"
      ? {
          bg: "rgba(245,158,11,0.12)",
          color: COLORS.warning,
        }
      : tone === "open"
      ? {
          bg: "rgba(37,99,235,0.12)",
          color: COLORS.primary,
        }
      : {
          bg: "rgba(107,114,128,0.12)",
          color: COLORS.gray,
        };

  return (
    <View style={[styles.statusPill, { backgroundColor: toneStyles.bg }]}>
      <Text style={[styles.statusPillText, { color: toneStyles.color }]}>
        {label}
      </Text>
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
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();

  const joinButtonLabel =
    joinPolicy === "OPEN"
      ? "Join Group"
      : joinPolicy === "APPROVAL"
      ? "Request Join"
      : "Closed";

  const footerText =
    joinPolicy === "OPEN"
      ? "Join instantly"
      : joinPolicy === "APPROVAL"
      ? "Request to join"
      : "Closed";

  const showJoinButton = !joined && !pending;
  const buttonDisabled = !canRequestJoin || busy || joinPolicy === "CLOSED";

  return (
    <Card
      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
      style={styles.groupCard}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={18} color={COLORS.white} />
        </View>

        <View style={styles.groupTextWrap}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.groupMeta}>
            {groupTypeLabel(group)} • {joinPolicyLabel(group)}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={COLORS.textMuted || COLORS.gray}
        />
      </View>

      {group.description ? (
        <Text style={styles.groupDescription} numberOfLines={2}>
          {group.description}
        </Text>
      ) : null}

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Members</Text>
          <Text style={styles.infoValue}>{group.member_count ?? "—"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contribution</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {contributionLabel(group)}
          </Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        {joined ? <StatusPill label="MEMBER" tone="member" /> : null}
        {!joined && pending ? <StatusPill label="PENDING" tone="pending" /> : null}
        {!joined && !pending && joinPolicy === "OPEN" ? (
          <StatusPill label="OPEN" tone="open" />
        ) : null}
        {joinPolicy === "CLOSED" ? (
          <StatusPill label="CLOSED" tone="closed" />
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardFooterText}>{footerText}</Text>
        <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
      </View>

      {showJoinButton ? (
        <View style={styles.joinActionWrap}>
          <Button
            title={busy ? "Please wait..." : joinButtonLabel}
            onPress={() => onJoin(group)}
            disabled={buttonDisabled}
          />
        </View>
      ) : null}
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

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: AvailableGroupsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
        ? { ...sessionUser }
        : null;

      setUser(mergedUser);

      const availableGroups =
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : [];
      setGroups(availableGroups);

      const memberships =
        membershipsRes.status === "fulfilled" &&
        Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : [];

      setJoinedGroupIds(
        toUniqueNumberArray(
          memberships.map((m: any) =>
            m.group_id ?? (typeof m.group === "number" ? m.group : m.group?.id)
          )
        )
      );

      const joinRequests =
        joinReqRes.status === "fulfilled" && Array.isArray(joinReqRes.value)
          ? joinReqRes.value
          : [];

      setPendingJoinGroupIds(
        toUniqueNumberArray(
          joinRequests
            .filter(
              (r: any) => String(r.status || "").toUpperCase().trim() === "PENDING"
            )
            .map((r: any) =>
              r.group_id ?? (typeof r.group === "number" ? r.group : r.group?.id)
            )
        )
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
    };
  }, [groups, joinedGroupIds]);

  const handleJoin = useCallback(
    async (group: Group) => {
      if (!joinAllowed) {
        Alert.alert("Groups", "Complete KYC before joining a group.");
        return;
      }

      const joinPolicy = String(group.join_policy || "").toUpperCase().trim();

      if (joinPolicy === "CLOSED") {
        Alert.alert("Groups", "This group is closed for joining.");
        return;
      }

      const isOpen = joinPolicy === "OPEN";
      const actionText = isOpen ? "join" : "send a join request for";

      Alert.alert(
        "Join Group",
        `Do you want to ${actionText} ${group.name}?`,
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
                  res?.message ||
                    (isOpen
                      ? "You joined the group successfully."
                      : "Join request submitted successfully.")
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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroTitle}>Available Groups</Text>
            <Text style={styles.heroSubtitle}>
              Explore support, savings, welfare, and community groups.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Available</Text>
            <Text style={styles.heroStatValue}>{stats.total}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Joined</Text>
            <Text style={styles.heroStatValue}>{stats.joined}</Text>
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
              onPress={() => router.push(ROUTES.tabs.profileKyc as any)}
            />
          </View>
        </Card>
      ) : null}

      <Section title="Browse Groups">
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

  heroTitle: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: COLORS.white,
  },

  heroSubtitle: {
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

  groupCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  cardTopRow: {
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
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  groupDescription: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  infoBox: {
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

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
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

  joinActionWrap: {
    marginTop: SPACING.md,
  },
});