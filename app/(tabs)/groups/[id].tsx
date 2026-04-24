import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
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

import {
  createGroupJoinRequest,
  getApiErrorMessage,
  getGroup,
  getMyGroupSavingsSummary,
  Group,
  listGroupMemberships,
  listMyGroupJoinRequests,
  MyGroupSavingsRow,
} from "@/services/groups";

const PAGE_BG = "#062C49";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BG_STRONG = "rgba(255,255,255,0.12)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const WHITE = "#FFFFFF";
const SOFT_TEXT = "rgba(255,255,255,0.75)";
const SOFT_TEXT_2 = "rgba(255,255,255,0.84)";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `KES ${safe.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getJoinPolicyLabel(value?: string | null) {
  const v = String(value || "").toUpperCase().trim();
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

function getGroupTypeLabel(group?: Group | null) {
  if (!group) return "Community space";
  return group.group_type_display || group.group_type || "Community space";
}

function getContributionLabel(group?: Group | null) {
  if (!group?.requires_contributions) return "Flexible";
  return formatKes(group?.contribution_amount);
}

function getJoinActionLabel(joinPolicy: string) {
  if (joinPolicy === "OPEN") return "Join this space";
  if (joinPolicy === "APPROVAL") return "Request to join";
  return "Space closed";
}

function groupSupportsDependants(group?: Group | null) {
  const type = String(group?.group_type || "").toUpperCase().trim();
  return type === "WELFARE" || type === "BURIAL";
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

function GlassButton({
  title,
  onPress,
  disabled,
  primary = false,
  leftIcon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  leftIcon?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.buttonBase,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      {leftIcon ? <View style={styles.buttonIcon}>{leftIcon}</View> : null}
      <Text
        style={[
          styles.buttonText,
          primary ? styles.buttonTextPrimary : styles.buttonTextSecondary,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryTileIconWrap}>
        <Ionicons name={icon} size={16} color="#0C6A80" />
      </View>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={styles.summaryTileValue}>{value}</Text>
    </View>
  );
}

function ActionLinkCard({
  title,
  buttonLabel,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  buttonLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.linkCard, disabled ? styles.linkCardDisabled : null]}>
      <View style={styles.linkCardLeft}>
        <View style={styles.linkIconWrap}>
          <Ionicons name={icon} size={18} color="#0C6A80" />
        </View>

        <Text style={styles.linkCardTitle}>{title}</Text>
      </View>

      <GlassButton
        title={buttonLabel}
        onPress={onPress}
        disabled={disabled}
        leftIcon={
          <Ionicons name="arrow-forward-outline" size={18} color={WHITE} />
        }
      />
    </View>
  );
}

function getNumericRouteParam(value: unknown): number | null {
  if (Array.isArray(value)) {
    const first = value[0];
    const n = Number(first);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();

  const routeGroupId = useMemo(() => {
    return (
      getNumericRouteParam(params.id) ??
      getNumericRouteParam(params.groupId) ??
      getNumericRouteParam(params.group_id)
    );
  }, [params.groupId, params.group_id, params.id]);

  const [group, setGroup] = useState<Group | null>(null);
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);
  const [mySummary, setMySummary] = useState<MyGroupSavingsRow | null>(null);

  const [loading, setLoading] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const isMountedRef = useRef(false);
  const isLoadingRef = useRef(false);
  const isContributingRef = useRef(false);

  const safeSetState = useCallback((cb: () => void) => {
    if (isMountedRef.current) cb();
  }, []);

  const goBackToGroups = useCallback(() => {
    router.replace(ROUTES.tabs.groups as any);
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (isLoadingRef.current) return;

      const groupId = routeGroupId;

      if (!groupId) {
        safeSetState(() => {
          setLoading(false);
          setHasBootstrapped(true);
          setError("This community space could not be opened.");
        });
        return;
      }

      isLoadingRef.current = true;

      try {
        if (!options?.silent) {
          safeSetState(() => {
            setError("");
          });
        }

        safeSetState(() => {
          setLoading(true);
        });

        const [groupRes, memberships, joinRequests, mySavingsSummary] =
          await Promise.all([
            getGroup(groupId),
            listGroupMemberships(),
            listMyGroupJoinRequests(),
            getMyGroupSavingsSummary(),
          ]);

        const safeMemberships = Array.isArray(memberships) ? memberships : [];
        const safeJoinRequests = Array.isArray(joinRequests) ? joinRequests : [];
        const safeSummary = Array.isArray(mySavingsSummary) ? mySavingsSummary : [];

        const isMember = safeMemberships.some((m: any) => {
          const id =
            m?.group_id ??
            (typeof m?.group === "number" ? m.group : m?.group?.id);
          return Number(id) === groupId && !!m?.is_active;
        });

        const hasPendingRequest = safeJoinRequests.some((r: any) => {
          const id =
            r?.group_id ??
            (typeof r?.group === "number" ? r.group : r?.group?.id);
          const status = String(r?.status || "").toUpperCase().trim();
          return Number(id) === groupId && status === "PENDING";
        });

        const currentGroupSummary =
          safeSummary.find((item: any) => {
            const id = item?.group?.id ?? item?.group_id ?? item?.group;
            return Number(id) === groupId;
          }) || null;

        safeSetState(() => {
          setGroup(groupRes);
          setJoined(isMember || !!currentGroupSummary);
          setPending(hasPendingRequest);
          setMySummary(currentGroupSummary);
          setError("");
        });
      } catch (e: any) {
        safeSetState(() => {
          setError(getApiErrorMessage(e) || "Unable to open this community space.");
        });
      } finally {
        isLoadingRef.current = false;
        safeSetState(() => {
          setLoading(false);
          setHasBootstrapped(true);
        });
      }
    },
    [routeGroupId, safeSetState]
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

  const joinPolicy = String(group?.join_policy || "").toUpperCase().trim();
  const isClosed = joinPolicy === "CLOSED";
  const isOpen = joinPolicy === "OPEN";
  const isApproval = joinPolicy === "APPROVAL";
  const joinLabel = getJoinActionLabel(joinPolicy);
  const canManageDependants = joined && groupSupportsDependants(group);
  const navigationLocked = !hasBootstrapped || loading || !routeGroupId;

  const handleJoin = useCallback(() => {
    const groupId = routeGroupId;
    if (!group || !groupId) return;

    if (isClosed) {
      Alert.alert(
        "Space closed",
        "This community space is not accepting new members right now."
      );
      return;
    }

    Alert.alert(
      isOpen ? "Join community space" : "Send join request",
      isOpen
        ? `Would you like to join ${group.name} now?`
        : `Would you like to request to join ${group.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOpen ? "Join now" : "Send request",
          onPress: async () => {
            try {
              setJoining(true);

              const res = await createGroupJoinRequest({
                group_id: groupId,
              });

              Alert.alert(
                "Community space",
                res?.message ||
                  (isOpen
                    ? "You have joined successfully."
                    : "Your join request has been sent.")
              );

              await load({ silent: true });
            } catch (e: any) {
              Alert.alert("Community space", getApiErrorMessage(e));
            } finally {
              setJoining(false);
            }
          },
        },
      ]
    );
  }, [group, isClosed, isOpen, load, routeGroupId]);

  const handleContribute = useCallback(async () => {
    if (!routeGroupId || !group || isContributingRef.current) return;

    isContributingRef.current = true;

    try {
      const groupName = String(group?.name || "Community space").trim();
      const groupCode = String((group as any)?.payment_code || "")
        .trim()
        .toUpperCase();

      console.log("GROUP_DETAIL_CONTRIBUTE_START", {
        routeGroupId,
        groupName,
        rawPaymentCode: (group as any)?.payment_code,
        groupCode,
        contributionAmount: (group as any)?.contribution_amount,
      });

      if (!groupCode) {
        console.log("GROUP_DETAIL_CONTRIBUTE_BLOCKED", {
          reason: "Missing group payment code",
          routeGroupId,
          group,
        });

        Alert.alert(
          "Contribution unavailable",
          "This community space does not have a payment code yet."
        );
        return;
      }

      const memberships = await listGroupMemberships();

      console.log("GROUP_DETAIL_MEMBERSHIPS_LOADED", {
        count: Array.isArray(memberships) ? memberships.length : 0,
        memberships,
      });

      const membership = Array.isArray(memberships)
        ? memberships.find((item: any) => {
            const membershipGroupId =
              Number(
                item?.group_id ??
                  (typeof item?.group === "number" ? item.group : item?.group?.id)
              ) || 0;

            return membershipGroupId === routeGroupId && !!item?.is_active;
          })
        : null;

      console.log("GROUP_DETAIL_MATCHED_MEMBERSHIP", {
        routeGroupId,
        membership,
      });

      const targetUserId =
        toNumber((membership as any)?.user_id) ||
        toNumber((membership as any)?.user?.id) ||
        toNumber((membership as any)?.member_user_id);

      console.log("GROUP_DETAIL_TARGET_USER_RESOLVED", {
        targetUserId,
        fromUserId: (membership as any)?.user_id,
        fromNestedUserId: (membership as any)?.user?.id,
        fromMemberUserId: (membership as any)?.member_user_id,
      });

      if (targetUserId <= 0) {
        console.log("GROUP_DETAIL_CONTRIBUTE_BLOCKED", {
          reason: "Could not resolve target user id",
          routeGroupId,
          membership,
        });

        Alert.alert(
          "Contribution unavailable",
          "We could not prepare your payment right now."
        );
        return;
      }

      const finalReference = `${groupCode}${targetUserId}`;
      const narration = groupName
        ? `${groupName} contribution`
        : "Community contribution";

      const payload = {
        title: groupName || "Community Contribution",
        source: "group",
        purpose: "GROUP_CONTRIBUTION",
        reference: finalReference,
        groupCode,
        groupName,
        userId: String(targetUserId),
        narration,
        amount: toSafeAmount((group as any)?.contribution_amount),
        groupId: String(routeGroupId),
        group_id: String(routeGroupId),
        editableAmount: "true",
        returnTo: ROUTES.dynamic.groupDetail(routeGroupId),
      };

      console.log("GROUP_DETAIL_CONTRIBUTE_PAYLOAD", payload);

      router.push({
        pathname: ROUTES.tabs.paymentsDeposit as any,
        params: payload,
      });
    } catch (error) {
      console.log("GROUP_DETAIL_CONTRIBUTE_ERROR", error);

      Alert.alert(
        "Contribution unavailable",
        "We could not prepare your payment right now."
      );
    } finally {
      isContributingRef.current = false;
    }
  }, [group, routeGroupId]);

  const badgeInfo = useMemo(() => {
    if (joined) {
      return {
        text: "JOINED",
        bg: "rgba(140,240,199,0.18)",
        color: "#FFFFFF",
      };
    }

    if (pending) {
      return {
        text: "REQUESTED",
        bg: "rgba(255,204,102,0.18)",
        color: "#FFFFFF",
      };
    }

    if (isClosed) {
      return {
        text: "CLOSED",
        bg: "rgba(255,255,255,0.12)",
        color: "#FFFFFF",
      };
    }

    if (isApproval) {
      return {
        text: "REVIEW",
        bg: "rgba(12,192,183,0.18)",
        color: "#FFFFFF",
      };
    }

    return {
      text: "AVAILABLE",
      bg: "rgba(236,251,255,0.18)",
      color: "#FFFFFF",
    };
  }, [joined, pending, isClosed, isApproval]);

  const totalContributed = mySummary?.my_share?.total_contributed ?? "0";
  const reservedShare = mySummary?.my_share?.reserved_share ?? "0";
  const availableShare = mySummary?.my_share?.available_share ?? "0";

  const shouldShowNotAvailable =
    hasBootstrapped && !loading && (!routeGroupId || !group);

  if (shouldShowNotAvailable) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="people-outline"
            title="Space not available"
            subtitle={error || "This community space could not be opened."}
            actionLabel="Back to spaces"
            onAction={goBackToGroups}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
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

        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={goBackToGroups}
            style={styles.backPill}
          >
            <Ionicons name="arrow-back-outline" size={16} color={WHITE} />
            <Text style={styles.backPillText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.92}
            onPress={onRefresh}
            style={styles.iconBtn}
            disabled={!routeGroupId}
          >
            <Ionicons name="refresh-outline" size={18} color={WHITE} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="people-outline" size={20} color={WHITE} />
            </View>

            <View style={[styles.statusPill, { backgroundColor: badgeInfo.bg }]}>
              <Text style={[styles.statusText, { color: badgeInfo.color }]}>
                {badgeInfo.text}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{group?.name || "Community space"}</Text>
          <Text style={styles.sub}>
            {group?.member_count ?? 0} members • {getContributionLabel(group)}
          </Text>

          <View style={styles.heroTypeRow}>
            <Text style={styles.heroTypeText}>{getGroupTypeLabel(group)}</Text>
            <Text style={styles.heroTypeDot}>•</Text>
            <Text style={styles.heroTypeText}>
              {getJoinPolicyLabel(group?.join_policy)}
            </Text>
          </View>

          {!!group?.description ? (
            <Text style={styles.heroDescription}>{group.description}</Text>
          ) : null}
        </View>

        {error && group ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{error}</Text>
          </View>
        ) : null}

        {!joined && !pending && group ? (
          <View style={styles.joinCard}>
            <Text style={styles.joinCardTitle}>
              {isOpen ? "Join this space" : "Request to join"}
            </Text>

            <View style={{ marginTop: SPACING.sm }}>
              <GlassButton
                title={joining ? "Please wait..." : joinLabel}
                onPress={handleJoin}
                disabled={joining || isClosed || navigationLocked}
                primary
              />
            </View>
          </View>
        ) : null}

        {pending ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Request sent</Text>
          </View>
        ) : null}

        {joined && group ? (
          <>
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>You are active here</Text>
              <View style={{ marginTop: SPACING.md }}>
                <GlassButton
                  title="Contribute"
                  onPress={handleContribute}
                  disabled={navigationLocked}
                  primary
                  leftIcon={
                    <Ionicons name="cash-outline" size={18} color="#0C6A80" />
                  }
                />
              </View>
            </View>

            <SectionTitle title="My balance" />
            <View style={styles.summaryGrid}>
              <SummaryTile
                label="Total contributed"
                value={formatKes(totalContributed)}
                icon="wallet-outline"
              />
              <SummaryTile
                label="Reserved"
                value={formatKes(reservedShare)}
                icon="lock-closed-outline"
              />
              <SummaryTile
                label="Available"
                value={formatKes(availableShare)}
                icon="card-outline"
              />
            </View>

            <ActionLinkCard
              title="Group activity"
              buttonLabel="View activity"
              icon="time-outline"
              disabled={navigationLocked}
              onPress={() => {
                if (!routeGroupId) return;

                router.push({
                  pathname: "/(tabs)/groups/history" as any,
                  params: {
                    id: String(routeGroupId),
                    groupId: String(routeGroupId),
                    group_id: String(routeGroupId),
                    title: String(group?.name || "Community space"),
                    group_name: String(group?.name || "Community space"),
                  },
                });
              }}
            />

            <ActionLinkCard
              title="Group members"
              buttonLabel="View members"
              icon="people-outline"
              disabled={navigationLocked}
              onPress={() => {
                if (!routeGroupId) return;
                router.push({
                  pathname: "/(tabs)/groups/memberships" as any,
                  params: {
                    groupId: String(routeGroupId),
                    group_id: String(routeGroupId),
                    group_name: group.name,
                  },
                });
              }}
            />

            {canManageDependants ? (
              <ActionLinkCard
                title="Dependants"
                buttonLabel="Manage dependants"
                icon="people-circle-outline"
                disabled={navigationLocked}
                onPress={() => {
                  if (!routeGroupId) return;
                  router.push({
                    pathname: "/(tabs)/groups/dependants" as any,
                    params: {
                      groupId: String(routeGroupId),
                      group_id: String(routeGroupId),
                      group_name: group.name,
                    },
                  });
                }}
              />
            ) : null}
          </>
        ) : null}

        <View style={styles.bottomActions}>
          <GlassButton title="Back to Groups" onPress={goBackToGroups} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 16,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: PAGE_BG,
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
    top: 260,
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
    top: 140,
    right: 18,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.08)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 8,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.06)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  backPill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  backPillText: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: CARD_BG,
    padding: SPACING.lg,
    borderRadius: 28,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  heroGlowPrimary: {
    position: "absolute",
    right: -28,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  heroGlowAccent: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.08)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusText: {
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  title: {
    color: WHITE,
    fontSize: 24,
    fontFamily: FONT.bold,
  },

  sub: {
    color: SOFT_TEXT_2,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FONT.medium,
  },

  heroTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
  },

  heroTypeText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  heroTypeDot: {
    color: "rgba(255,255,255,0.55)",
    marginHorizontal: 8,
    fontSize: 12,
    fontFamily: FONT.bold,
  },

  heroDescription: {
    marginTop: 14,
    color: WHITE,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: FONT.medium,
  },

  sectionTitle: {
    fontSize: 18,
    color: WHITE,
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  buttonBase: {
    minHeight: 46,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },

  buttonPrimary: {
    backgroundColor: WHITE,
  },

  buttonSecondary: {
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonIcon: {
    marginRight: 8,
  },

  buttonText: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  buttonTextPrimary: {
    color: "#0C6A80",
  },

  buttonTextSecondary: {
    color: WHITE,
  },

  joinCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 24,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },

  joinCardTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  infoTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  summaryTile: {
    flexGrow: 1,
    minWidth: "30%",
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  summaryTileIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    marginBottom: 10,
  },

  summaryTileLabel: {
    color: SOFT_TEXT,
    fontSize: 12,
    fontFamily: FONT.medium,
    marginBottom: 8,
  },

  summaryTileValue: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
  },

  linkCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  linkCardDisabled: {
    opacity: 0.75,
  },

  linkCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
  },

  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    marginRight: 12,
  },

  linkCardTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
    flex: 1,
  },

  bottomActions: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});