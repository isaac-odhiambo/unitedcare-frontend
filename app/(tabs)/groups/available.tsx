import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import {
  createGroupJoinRequest,
  getApiErrorMessage,
  Group,
  listAvailableGroups,
  listGroupMemberships,
  listMyGroupJoinRequests,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type AvailableGroupsUser = Partial<MeResponse> & Partial<SessionUser>;

function groupTypeLabel(group: Group) {
  return group.group_type_display || group.group_type || "Community space";
}

function joinPolicyLabel(group: Group) {
  const value = String(group.join_policy || "").toUpperCase().trim();
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function contributionLabel(group: Group) {
  if (!group.requires_contributions) return "Flexible";
  return `${group.contribution_amount || "0"} ${
    group.contribution_frequency || ""
  }`.trim();
}

function toUniqueNumberArray(values: any[]) {
  return Array.from(
    new Set(values.map((v) => Number(v)).filter((n) => Number.isFinite(n)))
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
  tone: "member" | "pending" | "open" | "closed" | "review";
}) {
  const toneStyles =
    tone === "member"
      ? {
          bg: "rgba(140,240,199,0.18)",
          color: "#FFFFFF",
        }
      : tone === "pending"
      ? {
          bg: "rgba(255,204,102,0.18)",
          color: "#FFFFFF",
        }
      : tone === "review"
      ? {
          bg: "rgba(12,192,183,0.18)",
          color: "#FFFFFF",
        }
      : tone === "open"
      ? {
          bg: "rgba(236,251,255,0.18)",
          color: "#FFFFFF",
        }
      : {
          bg: "rgba(255,255,255,0.12)",
          color: "#FFFFFF",
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
  busy,
  onJoin,
}: {
  group: Group;
  joined: boolean;
  pending: boolean;
  busy: boolean;
  onJoin: (group: Group) => void;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();

  const joinButtonLabel =
    joinPolicy === "OPEN"
      ? "Join this space"
      : joinPolicy === "APPROVAL"
      ? "Send request"
      : "Not open";

  const footerText =
    joinPolicy === "OPEN"
      ? "Open for new members"
      : joinPolicy === "APPROVAL"
      ? "Requests are reviewed before joining"
      : "Not open right now";

  const showJoinButton = !joined && !pending;
  const buttonDisabled = busy || joinPolicy === "CLOSED";

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
      style={styles.groupCard}
    >
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={18} color="#0A6E8A" />
        </View>

        <View style={styles.groupTextWrap}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.groupMeta}>
            {groupTypeLabel(group)} • {joinPolicyLabel(group)}
          </Text>
        </View>

        <View style={styles.arrowWrap}>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </View>
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

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contribution</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {contributionLabel(group)}
          </Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        {joined ? <StatusPill label="JOINED" tone="member" /> : null}
        {!joined && pending ? (
          <StatusPill label="REQUESTED" tone="pending" />
        ) : null}
        {!joined && !pending && joinPolicy === "OPEN" ? (
          <StatusPill label="AVAILABLE" tone="open" />
        ) : null}
        {!joined && !pending && joinPolicy === "APPROVAL" ? (
          <StatusPill label="REVIEW" tone="review" />
        ) : null}
        {joinPolicy === "CLOSED" ? (
          <StatusPill label="CLOSED" tone="closed" />
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.cardFooterText}>Enter space</Text>
          <Text style={styles.cardFooterSub}>{footerText}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </View>

      {showJoinButton ? (
        <View style={styles.joinActionWrap}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onJoin(group)}
            disabled={buttonDisabled}
            style={[
              styles.joinButton,
              buttonDisabled
                ? styles.joinButtonDisabled
                : styles.joinButtonActive,
            ]}
          >
            <Text style={styles.joinButtonText}>
              {busy ? "Please wait..." : joinButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

export default function AvailableGroupsScreen() {
  const [user, setUser] = useState<AvailableGroupsUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<number[]>([]);
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingGroupId, setSubmittingGroupId] = useState<number | null>(
    null
  );
  const [error, setError] = useState("");

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
            m.group_id ??
            (typeof m.group === "number" ? m.group : m.group?.id)
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
              (r: any) =>
                String(r.status || "").toUpperCase().trim() === "PENDING"
            )
            .map((r: any) =>
              r.group_id ??
              (typeof r.group === "number" ? r.group : r.group?.id)
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
          if (mounted) {
            setLoading(false);
            setHasBootstrapped(true);
          }
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
      const joinPolicy = String(group.join_policy || "").toUpperCase().trim();

      if (joinPolicy === "CLOSED") {
        Alert.alert("Community space", "This space is not open right now.");
        return;
      }

      const isOpen = joinPolicy === "OPEN";
      const title = isOpen ? "Join community space" : "Send join request";
      const message = isOpen
        ? `Would you like to be part of ${group.name}?`
        : `Would you like to request to join ${group.name}?`;

      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        {
          text: isOpen ? "Join this space" : "Send request",
          onPress: async () => {
            try {
              setSubmittingGroupId(group.id);

              const res = await createGroupJoinRequest({
                group_id: group.id,
                note: "",
              });

              Alert.alert(
                "Community space",
                res?.message ||
                  (isOpen
                    ? "You are now part of the space."
                    : "Your request has been sent successfully.")
              );

              await load();
            } catch (e: any) {
              Alert.alert("Community space", getApiErrorMessage(e));
            } finally {
              setSubmittingGroupId(null);
            }
          },
        },
      ]);
    },
    [load]
  );

  if (!hasBootstrapped) {
    return <View style={styles.page} />;
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to explore community spaces."
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
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#8CF0C7"
          colors={["#8CF0C7", "#0CC0B7"]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.backgroundBlobTop} />
      <View style={styles.backgroundBlobMiddle} />
      <View style={styles.backgroundBlobBottom} />
      <View style={styles.backgroundGlowOne} />
      <View style={styles.backgroundGlowTwo} />

      <View style={styles.heroCard}>
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />
        <View style={styles.heroGlowThree} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroTag}>COMMUNITY SPACES</Text>
            <Text style={styles.heroTitle}>Open community spaces</Text>
            <Text style={styles.heroSubtitle}>
              Explore spaces where members support each other, contribute
              together, and grow as a community.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color="#FFFFFF" />
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

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Requested</Text>
            <Text style={styles.heroStatValue}>{stats.pending}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Browse spaces</Text>

      {groups.length === 0 ? (
        <View style={styles.emptyHolder}>
          <EmptyState
            icon="people-outline"
            title="No spaces found"
            subtitle="Community spaces created by admins will appear here."
          />
        </View>
      ) : (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            joined={joinedGroupIds.includes(group.id)}
            pending={pendingJoinGroupIds.includes(group.id)}
            busy={submittingGroupId === group.id}
            onJoin={handleJoin}
          />
        ))
      )}

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 28,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C6A80",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThree: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
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
    color: "#FFFFFF",
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
    borderRadius: 18,
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
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
  },

  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  groupCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -22,
    left: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.08)",
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
    backgroundColor: "rgba(236, 251, 255, 0.88)",
    marginRight: 12,
  },

  groupTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  groupMeta: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
  },

  groupDescription: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
  },

  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  infoBox: {
    marginTop: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: SPACING.sm,
  },

  infoRow: {
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#FFFFFF",
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
    borderTopColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  cardFooterText: {
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  cardFooterSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 16,
  },

  joinActionWrap: {
    marginTop: SPACING.md,
  },

  joinButton: {
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  joinButtonActive: {
    backgroundColor: "#FFFFFF",
  },

  joinButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    opacity: 0.65,
  },

  joinButtonText: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  emptyHolder: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});