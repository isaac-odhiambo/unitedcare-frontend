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
import { FONT, SPACING } from "@/constants/theme";

import { getErrorMessage } from "@/services/api";
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

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SoftActionCard({
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
      style={[styles.actionCard, primary ? styles.actionCardPrimary : styles.actionCardSecondary]}
    >
      <View
        style={[
          styles.actionIconWrap,
          primary ? styles.actionIconWrapPrimary : styles.actionIconWrapSecondary,
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
  joinAllowed,
  onRequireProfile,
  onJoin,
  busy,
}: {
  group: Group;
  isMember: boolean;
  hasPendingRequest: boolean;
  joinAllowed: boolean;
  onRequireProfile: () => void;
  onJoin: (group: Group) => void;
  busy: boolean;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();
  const isClosed = joinPolicy === "CLOSED";
  const canAct = !isMember && !hasPendingRequest && !isClosed;

  const actionTitle = !joinAllowed
    ? "Complete profile"
    : getJoinActionLabel(group);

  return (
    <TouchableOpacity
      activeOpacity={0.94}
      onPress={() => router.push(ROUTES.dynamic.groupDetail(group.id) as any)}
      style={styles.groupCard}
    >
      <View style={styles.groupGlowTop} />
      <View style={styles.groupGlowBottom} />

      <View style={styles.groupTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={20} color="#0A6E8A" />
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
            <Text style={styles.badgeText}>JOINED</Text>
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
          <Text style={styles.cardFooterText}>Enter space</Text>
          <Text style={styles.cardFooterSub}>
            Read more and continue with your community.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            if (!joinAllowed) {
              onRequireProfile();
              return;
            }

            if (!canAct) {
              router.push(ROUTES.dynamic.groupDetail(group.id) as any);
              return;
            }

            onJoin(group);
          }}
          disabled={busy || isClosed}
          style={[
            styles.footerButton,
            joinAllowed && canAct ? styles.footerButtonPrimary : styles.footerButtonSecondary,
            (busy || isClosed) && styles.footerButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.footerButtonText,
              joinAllowed && canAct
                ? styles.footerButtonTextPrimary
                : styles.footerButtonTextSecondary,
            ]}
          >
            {isMember
              ? "Open"
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
  const [myMembershipGroupIds, setMyMembershipGroupIds] = useState<number[]>([]);
  const [pendingJoinGroupIds, setPendingJoinGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAvailableGroups, setShowAvailableGroups] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState<number | null>(null);

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profile as any);
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
          getApiErrorMessage(groupsRes.reason) || getErrorMessage(groupsRes.reason);
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

      if (!joinAllowed) {
        goToKyc();
        return;
      }

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
    [goToKyc, joinAllowed, load]
  );

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      myMemberships: myMembershipGroupIds.length,
      pendingRequests: pendingJoinGroupIds.length,
    };
  }, [groups, myMembershipGroupIds, pendingJoinGroupIds]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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

          <Text style={styles.heroTag}>COMMUNITY SPACES</Text>

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTitle}>Your community spaces</Text>
              <Text style={styles.heroCaption}>
                Join, belong, contribute together, and stay active in the spaces
                that matter to your community.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons name="people-outline" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <StatPill label="Available" value={stats.totalGroups} />
            <StatPill label="Joined" value={stats.myMemberships} />
            <StatPill label="Requests" value={stats.pendingRequests} />
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

        {!kycComplete ? (
          <View style={styles.noticeCard}>
            <View style={styles.noticeTop}>
              <View style={styles.noticeIconWrap}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color="#0C6A80"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.noticeTitle}>Complete profile to join</Text>
                <Text style={styles.noticeText}>
                  You can explore community spaces now. Complete your profile
                  before joining or sending requests.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={goToKyc}
              style={styles.noticeButton}
            >
              <Text style={styles.noticeButtonText}>Complete profile</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SectionTitle title="Quick actions" />
        <View style={styles.actionsGrid}>
          <SoftActionCard
            primary
            icon={showAvailableGroups ? "eye-off-outline" : "eye-outline"}
            title={showAvailableGroups ? "Hide spaces" : "Explore spaces"}
            subtitle="Browse the spaces where your community connects and contributes."
            onPress={() => setShowAvailableGroups((prev) => !prev)}
          />

          <SoftActionCard
            icon="people-outline"
            title="Your spaces"
            subtitle="Open the community spaces you already belong to."
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
          />
        </View>

        <SectionTitle title="Requests" />
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

            <View style={{ flex: 1 }}>
              <Text style={styles.requestSummaryTitle}>Your join requests</Text>
              <Text style={styles.requestSummarySub}>
                {stats.pendingRequests > 0
                  ? `${stats.pendingRequests} request${
                      stats.pendingRequests > 1 ? "s" : ""
                    } currently waiting`
                  : "Track current and past requests here"}
              </Text>
            </View>
          </View>

          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {showAvailableGroups ? (
          <>
            <SectionTitle title="Open community spaces" />
            {groups.length === 0 ? (
              <View style={styles.emptyHolder}>
                <EmptyState
                  icon="people-outline"
                  title="No spaces yet"
                  subtitle="Community spaces will appear here once available."
                />
              </View>
            ) : (
              groups.map((g) => (
                <GroupCard
                  key={g.id}
                  group={g}
                  isMember={myMembershipGroupIds.includes(g.id)}
                  hasPendingRequest={pendingJoinGroupIds.includes(g.id)}
                  joinAllowed={joinAllowed}
                  onRequireProfile={goToKyc}
                  onJoin={handleJoinFromCard}
                  busy={joiningGroupId === g.id}
                />
              ))
            )}
          </>
        ) : null}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

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
    backgroundColor: "rgba(12, 192, 183, 0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140, 240, 199, 0.08)",
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

  heroOrbOne: {
    position: "absolute",
    right: -30,
    top: -24,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -24,
    bottom: -32,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(140,240,199,0.10)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 34,
    bottom: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
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

  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  heroIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroTitle: {
    fontSize: 24,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  heroCaption: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.88)",
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
    paddingVertical: 12,
    paddingHorizontal: 12,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.74)",
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 17,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
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
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  noticeCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.90)",
  },

  noticeTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  noticeText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    fontFamily: FONT.regular,
    lineHeight: 18,
  },

  noticeButton: {
    alignSelf: "flex-start",
    marginTop: SPACING.md,
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  noticeButtonText: {
    color: "#0C6A80",
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  actionsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  actionCard: {
    flex: 1,
    borderRadius: 24,
    padding: SPACING.md,
    borderWidth: 1,
  },

  actionCardPrimary: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.12)",
  },

  actionCardSecondary: {
    backgroundColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(236, 251, 255, 0.92)",
  },

  actionIconWrapSecondary: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  actionTitle: {
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  actionSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.82)",
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 17,
  },

  requestSummaryCard: {
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(236, 251, 255, 0.92)",
  },

  requestSummaryTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  requestSummarySub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    fontFamily: FONT.regular,
    lineHeight: 18,
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

  groupGlowTop: {
    position: "absolute",
    top: -30,
    right: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  groupGlowBottom: {
    position: "absolute",
    bottom: -26,
    left: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.08)",
  },

  groupTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  groupIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
    marginRight: 12,
  },

  groupArrowWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  groupTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },

  groupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
  },

  groupDescription: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
    fontFamily: FONT.regular,
  },

  groupInfoBox: {
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

  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  badgeMember: {
    backgroundColor: "rgba(140,240,199,0.18)",
  },

  badgePending: {
    backgroundColor: "rgba(255,204,102,0.18)",
  },

  badgeOpen: {
    backgroundColor: "rgba(236,251,255,0.18)",
  },

  badgeReview: {
    backgroundColor: "rgba(12,192,183,0.18)",
  },

  badgeClosed: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },

  cardFooter: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardFooterLeft: {
    flex: 1,
    paddingRight: 8,
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

  footerButton: {
    minWidth: 118,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  footerButtonPrimary: {
    backgroundColor: "#FFFFFF",
  },

  footerButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  footerButtonDisabled: {
    opacity: 0.65,
  },

  footerButtonText: {
    fontFamily: FONT.bold,
    fontSize: 12,
  },

  footerButtonTextPrimary: {
    color: "#0C6A80",
  },

  footerButtonTextSecondary: {
    color: "#FFFFFF",
  },

  emptyHolder: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
});