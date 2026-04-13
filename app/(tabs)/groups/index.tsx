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
import { SafeAreaView } from "react-native-safe-area-context";

import EmptyState from "@/components/ui/EmptyState";
import { ROUTES } from "@/constants/routes";
import { SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
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

type GroupsUser = Partial<MeResponse> & Partial<SessionUser>;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function getGroupTypeLabel(group: Group) {
  return group.group_type_display || group.group_type || "Community space";
}

function getJoinPolicyLabel(group: Group) {
  const v = String(group.join_policy || "").toUpperCase().trim();
  if (!v) return "—";
  return v.replaceAll("_", " ");
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

function getContributionLabel(group: Group) {
  if (!group.requires_contributions) return "Flexible";
  const amount = group.contribution_amount || "0";
  const frequency = group.contribution_frequency || "";
  return `${amount} ${frequency}`.trim();
}

function getJoinActionLabel(group: Group) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();
  if (joinPolicy === "OPEN") return "Join now";
  if (joinPolicy === "APPROVAL") return "Request to join";
  return "Closed";
}

function getMemberIdentity(user: GroupsUser | null) {
  return (
    (user as any)?.full_name ||
    (user as any)?.name ||
    user?.username ||
    (typeof user?.phone === "string" ? user.phone : "") ||
    "Member"
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function StatPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.heroStatPill}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  primary = false,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.actionCard,
        primary ? styles.actionCardPrimary : styles.actionCardSecondary,
      ]}
    >
      <View
        style={[
          styles.actionIconWrap,
          primary
            ? styles.actionIconWrapPrimary
            : styles.actionIconWrapSecondary,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={primary ? "#0C6A80" : "#FFFFFF"}
        />
      </View>

      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

function GroupCard({
  group,
  isMember,
  hasPendingRequest,
  onJoin,
  onContribute,
  busy,
}: {
  group: Group;
  isMember: boolean;
  hasPendingRequest: boolean;
  onJoin: (group: Group) => void;
  onContribute: (group: Group) => void;
  busy: boolean;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();
  const isClosed = joinPolicy === "CLOSED";
  const canAct = !isMember && !hasPendingRequest && !isClosed;
  const actionTitle = getJoinActionLabel(group);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
      style={[styles.groupCard, isMember && styles.groupCardActive]}
    >
      <View style={styles.groupGlowTop} />
      <View style={styles.groupGlowBottom} />

      <View style={styles.groupTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons
            name={isMember ? "checkmark-circle-outline" : "people-outline"}
            size={22}
            color="#0A6E8A"
          />
        </View>

        <View style={styles.groupTextWrap}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.groupMeta}>
            {getGroupTypeLabel(group)} • {getJoinPolicyLabel(group)}
          </Text>
        </View>

        <View style={styles.groupArrowWrap}>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </View>
      </View>

      {!!group.description ? (
        <Text style={styles.groupDescription} numberOfLines={3}>
          {group.description}
        </Text>
      ) : null}

      <View style={styles.groupInfoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Members</Text>
          <Text style={styles.infoValue}>{group.member_count ?? "—"}</Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contribution</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {getContributionLabel(group)}
          </Text>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Created</Text>
          <Text style={styles.infoValue}>{fmtDate(group.created_at)}</Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        {isMember ? (
          <View style={[styles.badgePill, styles.badgeMember]}>
            <Text style={styles.badgeText}>ACTIVE</Text>
          </View>
        ) : null}

        {!isMember && hasPendingRequest ? (
          <View style={[styles.badgePill, styles.badgePending]}>
            <Text style={styles.badgeText}>REQUESTED</Text>
          </View>
        ) : null}

        {!isMember && !hasPendingRequest && joinPolicy === "OPEN" ? (
          <View style={[styles.badgePill, styles.badgeOpen]}>
            <Text style={styles.badgeText}>AVAILABLE</Text>
          </View>
        ) : null}

        {!isMember && !hasPendingRequest && joinPolicy === "APPROVAL" ? (
          <View style={[styles.badgePill, styles.badgeReview]}>
            <Text style={styles.badgeText}>REVIEW</Text>
          </View>
        ) : null}

        {!isMember && !hasPendingRequest && isClosed ? (
          <View style={[styles.badgePill, styles.badgeClosed]}>
            <Text style={styles.badgeText}>CLOSED</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.cardFooterLeft}>
          <Text style={styles.cardFooterText}>
            {isMember ? "You are active here" : "Enter space"}
          </Text>
          <Text style={styles.cardFooterSub}>
            {isMember
              ? "Continue contributing and participating in this group."
              : "Read more and continue with your community."}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            if (isMember) {
              onContribute(group);
              return;
            }

            if (!canAct) {
              router.push(ROUTES.dynamic.groupDetail(group.id) as any);
              return;
            }

            onJoin(group);
          }}
          disabled={busy || (!isMember && isClosed)}
          style={[
            styles.footerButton,
            isMember
              ? styles.footerButtonContribute
              : canAct
              ? styles.footerButtonPrimary
              : styles.footerButtonSecondary,
            (busy || (!isMember && isClosed)) && styles.footerButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.footerButtonText,
              isMember
                ? styles.footerButtonTextContribute
                : canAct
                ? styles.footerButtonTextPrimary
                : styles.footerButtonTextSecondary,
            ]}
          >
            {isMember
              ? "Contribute"
              : hasPendingRequest
              ? "View"
              : busy
              ? "Please wait..."
              : actionTitle}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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
  const [showAvailableGroups, setShowAvailableGroups] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState<number | null>(null);

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
            (r: any) =>
              String(r.status || "").toUpperCase().trim() === "PENDING"
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

  const handleJoinFromCard = useCallback(
    (group: Group) => {
      const joinPolicy = String(group.join_policy || "").toUpperCase().trim();
      const isOpen = joinPolicy === "OPEN";
      const isClosed = joinPolicy === "CLOSED";

      if (isClosed) {
        Alert.alert(
          "Space closed",
          "This community space is not accepting new members right now."
        );
        return;
      }

      Alert.alert(
        isOpen ? "Join this space" : "Send join request",
        isOpen
          ? `Would you like to join ${group.name} now?`
          : `Would you like to request to join ${group.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: isOpen ? "Join now" : "Send request",
            onPress: async () => {
              try {
                setJoiningGroupId(group.id);
                const res = await createGroupJoinRequest({
                  group_id: group.id,
                });

                Alert.alert(
                  "Community space",
                  res?.message ||
                    (isOpen
                      ? "You have joined successfully."
                      : "Your request has been sent.")
                );

                await load();
              } catch (e: any) {
                Alert.alert("Community space", getApiErrorMessage(e));
              } finally {
                setJoiningGroupId(null);
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const handleContribute = useCallback((group: Group) => {
    router.push({
      pathname: "/(tabs)/groups/contribute" as any,
      params: {
        groupId: String(group.id),
        group_id: String(group.id),
        group_name: group.name,
      },
    });
  }, []);

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      myMemberships: myMembershipGroupIds.length,
      pendingRequests: pendingJoinGroupIds.length,
    };
  }, [groups, myMembershipGroupIds, pendingJoinGroupIds]);

  const activeGroups = useMemo(
    () => groups.filter((g) => myMembershipGroupIds.includes(g.id)),
    [groups, myMembershipGroupIds]
  );

  const availableGroups = useMemo(
    () => groups.filter((g) => !myMembershipGroupIds.includes(g.id)),
    [groups, myMembershipGroupIds]
  );

  const memberName = useMemo(() => getMemberIdentity(user), [user]);

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.page}>
          <EmptyState
            title="Session unavailable"
            subtitle={error || "Please login again to continue."}
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
          <View style={styles.heroOrbOne} />
          <View style={styles.heroOrbTwo} />
          <View style={styles.heroOrbThree} />

          <Text style={styles.heroTag}>COMMUNITY GROUPS</Text>
          <Text style={styles.heroTitle}>Hello, {memberName || "Member"}</Text>
          <Text style={styles.heroCaption}>
            Open your active groups first, contribute easily, and explore more
            community spaces below.
          </Text>

          <View style={styles.heroStatsRow}>
            <StatPill label="All groups" value={stats.totalGroups} />
            <StatPill label="Active" value={stats.myMemberships} />
            <StatPill label="Requests" value={stats.pendingRequests} />
          </View>
        </View>

        {loading ? (
          <View style={styles.inlineLoader}>
            <ActivityIndicator size="small" color="#8CF0C7" />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIconWrap}>
              <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SectionTitle title="Quick actions" />
        <View style={styles.actionsGrid}>
          <ActionCard
            primary
            icon="people-outline"
            title="Your joined groups"
            subtitle="Open the groups you already belong to and continue contributing."
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
          />

          <ActionCard
            icon={showAvailableGroups ? "eye-off-outline" : "eye-outline"}
            title={showAvailableGroups ? "Hide available" : "Show available"}
            subtitle="Control whether available groups appear below."
            onPress={() => setShowAvailableGroups((prev) => !prev)}
          />
        </View>

        <SectionTitle title="Join requests" />
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push("/(tabs)/groups/join-requests" as any)}
          style={styles.requestSummaryCard}
        >
          <View style={styles.requestSummaryLeft}>
            <View style={styles.requestSummaryIcon}>
              <Ionicons
                name="git-pull-request-outline"
                size={18}
                color="#0A6E8A"
              />
            </View>

            <View style={styles.requestSummaryTextWrap}>
              <Text style={styles.requestSummaryTitle}>Your join requests</Text>
              <Text style={styles.requestSummarySub}>
                {stats.pendingRequests > 0
                  ? `${stats.pendingRequests} request${
                      stats.pendingRequests > 1 ? "s" : ""
                    } currently waiting`
                  : "Track current and past join requests here"}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <SectionTitle title="Your active groups" />
        {activeGroups.length === 0 ? (
          <View style={styles.emptyHolder}>
            <EmptyState
              icon="people-outline"
              title="No active groups yet"
              subtitle="The groups you join will appear here first."
            />
          </View>
        ) : (
          activeGroups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              isMember={true}
              hasPendingRequest={pendingJoinGroupIds.includes(g.id)}
              onJoin={handleJoinFromCard}
              onContribute={handleContribute}
              busy={joiningGroupId === g.id}
            />
          ))
        )}

        {showAvailableGroups ? (
          <>
            <SectionTitle title="Available groups" />
            {availableGroups.length === 0 ? (
              <View style={styles.emptyHolder}>
                <EmptyState
                  icon="people-outline"
                  title="No available groups"
                  subtitle="Available groups will appear here once ready."
                />
              </View>
            ) : (
              availableGroups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  isMember={false}
                  hasPendingRequest={pendingJoinGroupIds.includes(g.id)}
                  onJoin={handleJoinFromCard}
                  onContribute={handleContribute}
                  busy={joiningGroupId === g.id}
                />
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 12,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#062C49",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  heroCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  heroOrbOne: {
    position: "absolute",
    right: -30,
    top: -24,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -24,
    bottom: -32,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 34,
    bottom: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#E8FFF5",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
  },

  heroTitle: {
    fontSize: 26,
    color: "#FFFFFF",
    fontWeight: "900",
  },

  heroCaption: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
  },

  heroStatsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
    gap: 12,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 12,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 6,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: 22,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
  },

  actionsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  actionCard: {
    flex: 1,
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
  },

  actionCardPrimary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  actionCardSecondary: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.10)",
  },

  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  actionIconWrapPrimary: {
    backgroundColor: "rgba(236,251,255,0.95)",
  },

  actionIconWrapSecondary: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  actionTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },

  actionSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    fontSize: 11,
    lineHeight: 17,
  },

  requestSummaryCard: {
    padding: SPACING.md,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },

  requestSummaryLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingRight: 10,
  },

  requestSummaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.95)",
  },

  requestSummaryTextWrap: {
    flex: 1,
  },

  requestSummaryTitle: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "900",
  },

  requestSummarySub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },

  groupCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  groupCardActive: {
    backgroundColor: "rgba(29,196,182,0.20)",
    borderColor: "rgba(129,244,231,0.20)",
  },

  groupGlowTop: {
    position: "absolute",
    top: -30,
    right: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  groupGlowBottom: {
    position: "absolute",
    bottom: -26,
    left: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  groupTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  groupIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.92)",
    marginRight: 12,
  },

  groupArrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  groupTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  groupTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "900",
  },

  groupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
  },

  groupDescription: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.85)",
  },

  groupInfoBox: {
    marginTop: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
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
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  infoLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "700",
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
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  badgeMember: {
    backgroundColor: "rgba(140,240,199,0.18)",
  },

  badgePending: {
    backgroundColor: "rgba(255,204,102,0.18)",
  },

  badgeOpen: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  badgeReview: {
    backgroundColor: "rgba(12,192,183,0.18)",
  },

  badgeClosed: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  cardFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  cardFooterLeft: {
    flex: 1,
    paddingRight: 12,
  },

  cardFooterText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  cardFooterSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.88)",
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 16,
  },

  footerButton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  footerButtonPrimary: {
    backgroundColor: "#0C6A80",
    borderColor: "#0C6A80",
  },

  footerButtonContribute: {
    backgroundColor: "#197D71",
    borderColor: "#197D71",
  },

  footerButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.14)",
  },

  footerButtonDisabled: {
    opacity: 0.6,
  },

  footerButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },

  footerButtonTextPrimary: {
    color: "#FFFFFF",
  },

  footerButtonTextContribute: {
    color: "#FFFFFF",
  },

  footerButtonTextSecondary: {
    color: "#FFFFFF",
  },

  emptyHolder: {
    marginBottom: SPACING.lg,
  },

  inlineLoader: {
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});