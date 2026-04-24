import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
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

function toSafeAmount(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const n = Number(String(value).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function GroupCard({
  group,
  isMember,
  hasPendingRequest,
  onJoin,
  onContribute,
  busy,
  navigationLocked,
}: {
  group: Group;
  isMember: boolean;
  hasPendingRequest: boolean;
  onJoin: (group: Group) => void;
  onContribute: (group: Group) => void;
  busy: boolean;
  navigationLocked: boolean;
}) {
  const joinPolicy = String(group.join_policy || "").toUpperCase().trim();
  const isClosed = joinPolicy === "CLOSED";
  const canJoin = !isMember && !hasPendingRequest && !isClosed;

  const openGroupDetail = useCallback(() => {
    if (navigationLocked || busy) return;

    const groupId = Number(group?.id);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      Alert.alert("Group unavailable", "This group is not ready yet.");
      return;
    }

    try {
      router.push({
        pathname: ROUTES.dynamic.groupDetail(groupId) as any,
        params: {
          groupId: String(groupId),
          group_id: String(groupId),
          group: JSON.stringify(group),
        },
      });
    } catch {
      Alert.alert("Group unavailable", "Unable to open this group right now.");
    }
  }, [busy, group, navigationLocked]);

  const handleFooterPress = useCallback(
    (e: GestureResponderEvent) => {
      e.stopPropagation();

      if (navigationLocked || busy) return;

      if (isMember) {
        onContribute(group);
        return;
      }

      if (canJoin) {
        onJoin(group);
        return;
      }

      openGroupDetail();
    },
    [busy, canJoin, group, isMember, navigationLocked, onContribute, onJoin, openGroupDetail]
  );

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={openGroupDetail}
      disabled={navigationLocked || busy}
      style={[
        styles.groupCard,
        isMember && styles.groupCardActive,
        (navigationLocked || busy) && styles.groupCardDisabled,
      ]}
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
        <Text style={styles.groupDescription} numberOfLines={4}>
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
              ? "Continue with your contribution and stay active in this community."
              : "Read more and continue with your community."}
          </Text>
        </View>

        <View style={styles.cardFooterButtons}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={openGroupDetail}
            disabled={busy || navigationLocked}
            style={[
              styles.footerButton,
              styles.footerButtonSecondary,
              (busy || navigationLocked) && styles.footerButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.footerButtonText,
                styles.footerButtonTextSecondary,
              ]}
            >
              Detail
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={handleFooterPress}
            disabled={busy || navigationLocked || (!isMember && !canJoin)}
            style={[
              styles.footerButton,
              isMember
                ? styles.footerButtonContribute
                : canJoin
                  ? styles.footerButtonPrimary
                  : styles.footerButtonSecondary,
              (busy || navigationLocked || (!isMember && !canJoin)) &&
                styles.footerButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.footerButtonText,
                isMember
                  ? styles.footerButtonTextContribute
                  : canJoin
                    ? styles.footerButtonTextPrimary
                    : styles.footerButtonTextSecondary,
              ]}
            >
              {isMember ? "Continue" : hasPendingRequest ? "View" : getJoinActionLabel(group)}
            </Text>
          </TouchableOpacity>
        </View>
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
  const [bootstrapped, setBootstrapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [joiningGroupId, setJoiningGroupId] = useState<number | null>(null);

  const isMountedRef = useRef(false);
  const isLoadingRef = useRef(false);

  const safeSetState = useCallback((cb: () => void) => {
    if (isMountedRef.current) cb();
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;

      try {
        if (!options?.silent) {
          safeSetState(() => {
            setError("");
          });
        }

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

        const currentUserId =
          toNumber((mergedUser as any)?.id) ||
          toNumber((mergedUser as any)?.user_id) ||
          toNumber((mergedUser as any)?.pk);

        const availableGroups =
          groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
            ? groupsRes.value
            : [];

        const memberships =
          membershipsRes.status === "fulfilled" &&
          Array.isArray(membershipsRes.value)
            ? membershipsRes.value
            : [];

        const myMembershipIds = toUniqueNumberArray(
          memberships
            .filter((m: any) => {
              const membershipUserId =
                toNumber(m?.user_id) ||
                toNumber(m?.user?.id) ||
                toNumber(m?.member_user_id);

              return currentUserId > 0 && membershipUserId === currentUserId && !!m?.is_active;
            })
            .map((m: any) =>
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

        safeSetState(() => {
          setUser(mergedUser);
          setGroups(availableGroups);
          setMyMembershipGroupIds(myMembershipIds);
          setPendingJoinGroupIds(pendingIds);
        });

        let nextError = "";

        const authFailed =
          !sessionUser &&
          !meUser &&
          meRes.status === "rejected" &&
          sessionRes.status === "rejected";

        if (authFailed) {
          nextError =
            getApiErrorMessage(meRes.reason) ||
            getErrorMessage(meRes.reason) ||
            getApiErrorMessage(sessionRes.reason) ||
            getErrorMessage(sessionRes.reason) ||
            "Please login again to continue.";
        } else if (groupsRes.status === "rejected") {
          nextError =
            getApiErrorMessage(groupsRes.reason) ||
            getErrorMessage(groupsRes.reason) ||
            "Unable to load groups right now.";
        }

        safeSetState(() => {
          setError(nextError);
        });
      } catch (e: any) {
        safeSetState(() => {
          setError(
            getApiErrorMessage(e) || getErrorMessage(e) || "Something went wrong."
          );
        });
      } finally {
        isLoadingRef.current = false;
        safeSetState(() => {
          setLoading(false);
          setBootstrapped(true);
        });
      }
    },
    [safeSetState]
  );

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      load({ silent: true });

      return () => {
        isMountedRef.current = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    safeSetState(() => {
      setRefreshing(true);
    });

    try {
      await load({ silent: true });
    } finally {
      safeSetState(() => {
        setRefreshing(false);
      });
    }
  }, [load, safeSetState]);

  const handleJoinFromCard = useCallback(
    (group: Group) => {
      const groupId = Number(group?.id);
      if (!Number.isFinite(groupId) || groupId <= 0) {
        Alert.alert("Group unavailable", "This group is not ready yet.");
        return;
      }

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
                setJoiningGroupId(groupId);

                const res = await createGroupJoinRequest({
                  group_id: groupId,
                });

                Alert.alert(
                  "Community space",
                  res?.message ||
                    (isOpen
                      ? "You have joined successfully."
                      : "Your request has been sent.")
                );

                await load({ silent: true });
              } catch (e: any) {
                Alert.alert(
                  "Community space",
                  getApiErrorMessage(e) || "Unable to complete request."
                );
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

  const handleContribute = useCallback(
    async (group: Group) => {
      const groupId = Number(group?.id);
      if (!Number.isFinite(groupId) || groupId <= 0) {
        Alert.alert("Group unavailable", "This group is not ready yet.");
        return;
      }

      try {
        const currentUserId =
          toNumber((user as any)?.id) ||
          toNumber((user as any)?.user_id) ||
          toNumber((user as any)?.pk);

        const groupName = String(group?.name || "Community space").trim();
        const groupCode = String((group as any)?.payment_code || "")
          .trim()
          .toUpperCase();
        const contributionAmount = toSafeAmount((group as any)?.contribution_amount);

        if (!groupCode) {
          Alert.alert(
            "Contribution unavailable",
            "This community space does not have a payment code yet."
          );
          return;
        }

        if (currentUserId <= 0) {
          Alert.alert(
            "Contribution unavailable",
            "We could not identify your account right now."
          );
          return;
        }

        const memberships = await listGroupMemberships();

        const membership = Array.isArray(memberships)
          ? memberships.find((item: any) => {
              const membershipGroupId =
                Number(
                  item?.group_id ??
                    (typeof item?.group === "number" ? item.group : item?.group?.id)
                ) || 0;

              const membershipUserId =
                toNumber(item?.user_id) ||
                toNumber(item?.user?.id) ||
                toNumber(item?.member_user_id);

              return (
                membershipGroupId === groupId &&
                membershipUserId === currentUserId &&
                !!item?.is_active
              );
            })
          : null;

        if (!membership) {
          Alert.alert(
            "Contribution unavailable",
            "You are not an active member of this group. Please join first."
          );
          return;
        }

        const targetUserId =
          toNumber((membership as any)?.user_id) ||
          toNumber((membership as any)?.user?.id) ||
          toNumber((membership as any)?.member_user_id);

        if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
          Alert.alert(
            "Contribution unavailable",
            "We could not resolve your membership details right now."
          );
          return;
        }

        const finalReference = `${groupCode}${targetUserId}`;

        const payload = {
          groupId: String(groupId),
          group_id: String(groupId),
          group_name: groupName,
          groupCode,
          payment_code: groupCode,
          userId: String(targetUserId),
          reference: finalReference,
          title: "Group contribution",
          subtitle: groupName || "Community space",
          helperText: "Review your contribution and continue to payment.",
          ctaLabel: "Continue to payment",
          amount: contributionAmount,
          amountLabel: contributionAmount,
          returnTo: ROUTES.dynamic.groupDetail(groupId),
        };

        router.push({
          pathname: "/(tabs)/groups/contribute" as any,
          params: payload,
        });
      } catch {
        Alert.alert(
          "Contribution unavailable",
          "We could not prepare your payment right now."
        );
      }
    },
    [user]
  );

  const stats = useMemo(() => {
    return {
      totalGroups: groups.length,
      myMemberships: myMembershipGroupIds.length,
      pendingRequests: pendingJoinGroupIds.length,
    };
  }, [groups, myMembershipGroupIds, pendingJoinGroupIds]);

  const activeGroups = useMemo(
    () => groups.filter((g) => myMembershipGroupIds.includes(Number(g.id))),
    [groups, myMembershipGroupIds]
  );

  const availableGroups = useMemo(
    () => groups.filter((g) => !myMembershipGroupIds.includes(Number(g.id))),
    [groups, myMembershipGroupIds]
  );

  const memberName = useMemo(() => getMemberIdentity(user), [user]);

  const showJoinRequestsCard = stats.pendingRequests > 0;
  const showActiveSection = activeGroups.length > 0;
  const showAvailableSection = availableGroups.length > 0;

  const showOnlyEmptyState =
    bootstrapped &&
    !loading &&
    !error &&
    activeGroups.length === 0 &&
    availableGroups.length === 0 &&
    stats.pendingRequests === 0;

  const navigationLocked = !bootstrapped || loading;

  const shouldShowSessionUnavailable =
    bootstrapped && !loading && !user && !!error && groups.length === 0;

  if (shouldShowSessionUnavailable) {
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
            Find your community spaces and continue with ease.
          </Text>

          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.push("/(tabs)/groups/history" as any)}
              style={styles.heroActionButton}
            >
              <Ionicons name="time-outline" size={16} color="#0C6A80" />
              <Text style={styles.heroActionButtonText}>Contribution history</Text>
            </TouchableOpacity>
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

        {showJoinRequestsCard ? (
          <>
            <SectionTitle title="Join requests" />
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.push("/(tabs)/groups/join-requests" as any)}
              style={styles.requestSummaryCard}
              disabled={navigationLocked}
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
                    {stats.pendingRequests} request
                    {stats.pendingRequests > 1 ? "s" : ""} currently waiting
                  </Text>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : null}

        {showActiveSection ? (
          <>
            <SectionTitle title="Your active groups" />
            {activeGroups.map((g) => (
              <GroupCard
                key={String(g.id)}
                group={g}
                isMember={true}
                hasPendingRequest={pendingJoinGroupIds.includes(Number(g.id))}
                onJoin={handleJoinFromCard}
                onContribute={handleContribute}
                busy={joiningGroupId === Number(g.id)}
                navigationLocked={navigationLocked}
              />
            ))}
          </>
        ) : null}

        {showAvailableSection ? (
          <>
            <SectionTitle title="Available groups" />
            {availableGroups.map((g) => (
              <GroupCard
                key={String(g.id)}
                group={g}
                isMember={false}
                hasPendingRequest={pendingJoinGroupIds.includes(Number(g.id))}
                onJoin={handleJoinFromCard}
                onContribute={handleContribute}
                busy={joiningGroupId === Number(g.id)}
                navigationLocked={navigationLocked}
              />
            ))}
          </>
        ) : null}

        {showOnlyEmptyState ? (
          <View style={styles.emptyHolder}>
            <EmptyState
              icon="people-outline"
              title="No groups yet"
              subtitle="Join a community space when one becomes available."
            />
          </View>
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
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  heroOrbOne: {
    position: "absolute",
    right: -30,
    top: -24,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -24,
    bottom: -32,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 30,
    bottom: -18,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    color: "#E8FFF5",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 10,
  },

  heroTitle: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "900",
  },

  heroCaption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
  },

  heroActionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
  },

  heroActionButton: {
    minHeight: 42,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
  },

  heroActionButtonText: {
    color: "#0C6A80",
    fontSize: 13,
    fontWeight: "800",
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

  groupCardDisabled: {
    opacity: 0.75,
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
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: "#FFFFFF",
    fontWeight: "800",
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

  cardFooterButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
});