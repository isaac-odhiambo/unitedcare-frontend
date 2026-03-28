import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";

import {
  createGroupJoinRequest,
  getApiErrorMessage,
  getGroup,
  getMyGroupContributions,
  Group,
  GroupContribution,
  listGroupMemberships,
  listMyGroupJoinRequests,
} from "@/services/groups";

import { canJoinGroup, getMe, isKycComplete } from "@/services/profile";
import { getSessionUser } from "@/services/session";

/* ----------------------------------------------- */

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `KES ${safe.toLocaleString("en-KE")}`;
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString();
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

/* ----------------------------------------------- */

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [rows, setRows] = useState<GroupContribution[]>([]);
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const [user, setUser] = useState<any>(null);

  /* ----------------------------------------------- */
  /* LOAD DATA */
  /* ----------------------------------------------- */

  const load = useCallback(async () => {
    try {
      const [
        session,
        me,
        groupRes,
        contributions,
        memberships,
        joinRequests,
      ] = await Promise.all([
        getSessionUser(),
        getMe(),
        getGroup(groupId),
        getMyGroupContributions(groupId),
        listGroupMemberships(),
        listMyGroupJoinRequests(),
      ]);

      const mergedUser = { ...(session || {}), ...(me || {}) };
      const safeRows = Array.isArray(contributions) ? contributions : [];
      const safeMemberships = Array.isArray(memberships) ? memberships : [];
      const safeJoinRequests = Array.isArray(joinRequests) ? joinRequests : [];

      const isMember = safeMemberships.some((m: any) => {
        const id =
          m?.group_id ?? (typeof m?.group === "number" ? m.group : m?.group?.id);
        return Number(id) === groupId;
      });

      const hasPendingRequest = safeJoinRequests.some((r: any) => {
        const id =
          r?.group_id ?? (typeof r?.group === "number" ? r.group : r?.group?.id);
        const status = String(r?.status || "").toUpperCase().trim();
        return Number(id) === groupId && status === "PENDING";
      });

      setUser(mergedUser);
      setGroup(groupRes);
      setRows(safeRows);
      setJoined(isMember || safeRows.length > 0);
      setPending(hasPendingRequest);
    } catch (e: any) {
      Alert.alert("Community space", getApiErrorMessage(e));
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        setLoading(true);
        await load();
        if (mounted) setLoading(false);
      };

      run();

      return () => {
        mounted = false;
      };
    }, [load])
  );

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  /* ----------------------------------------------- */
  /* JOIN LOGIC */
  /* ----------------------------------------------- */

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const joinPolicy = String(group?.join_policy || "").toUpperCase().trim();

  const isClosed = joinPolicy === "CLOSED";
  const isOpen = joinPolicy === "OPEN";
  const isApproval = joinPolicy === "APPROVAL";

  const joinLabel = getJoinActionLabel(joinPolicy);

  const handleJoin = () => {
    if (!group) return;

    if (!kycComplete || !joinAllowed) {
      Alert.alert(
        "Complete profile",
        "Please complete your profile before joining this community space.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open profile",
            onPress: () => router.push(ROUTES.tabs.profile as any),
          },
        ]
      );
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

              await load();
            } catch (e: any) {
              Alert.alert("Community space", getApiErrorMessage(e));
            } finally {
              setJoining(false);
            }
          },
        },
      ]
    );
  };

  /* ----------------------------------------------- */
  /* UI DERIVED */
  /* ----------------------------------------------- */

  const headerSubtitle = useMemo(() => {
    return `${getGroupTypeLabel(group)} • ${getJoinPolicyLabel(group?.join_policy)}`;
  }, [group]);

  const badgeInfo = useMemo(() => {
    if (joined) {
      return {
        text: "JOINED",
        bg: "rgba(46,125,50,0.14)",
        color: COLORS.success,
      };
    }

    if (pending) {
      return {
        text: "REQUESTED",
        bg: "rgba(245,158,11,0.14)",
        color: COLORS.warning,
      };
    }

    if (isClosed) {
      return {
        text: "CLOSED",
        bg: "rgba(107,114,128,0.14)",
        color: COLORS.gray,
      };
    }

    if (isApproval) {
      return {
        text: "REVIEW",
        bg: "rgba(242,140,40,0.14)",
        color: COLORS.accent || COLORS.warning,
      };
    }

    return {
      text: "AVAILABLE",
      bg: "rgba(37,99,235,0.14)",
      color: COLORS.primary,
    };
  }, [joined, pending, isClosed, isApproval]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group || !Number.isFinite(groupId)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="people-outline"
            title="Space not available"
            subtitle="This community space could not be opened."
            actionLabel="Back to spaces"
            onAction={() => router.replace("/(tabs)/groups" as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  /* ----------------------------------------------- */
  /* UI */
  /* ----------------------------------------------- */

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="people-outline" size={20} color={COLORS.white} />
            </View>

            <View style={[styles.statusPill, { backgroundColor: badgeInfo.bg }]}>
              <Text style={[styles.statusText, { color: badgeInfo.color }]}>
                {badgeInfo.text}
              </Text>
            </View>
          </View>

          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.sub}>{headerSubtitle}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="people-outline" size={14} color={COLORS.white} />
              <Text style={styles.heroMetaText}>
                {group.member_count ?? "—"} member
                {Number(group.member_count || 0) === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.heroMetaPill}>
              <Ionicons name="wallet-outline" size={14} color={COLORS.white} />
              <Text style={styles.heroMetaText}>
                {getContributionLabel(group)}
              </Text>
            </View>
          </View>
        </View>

        {!joined && !pending ? (
          <Card style={styles.joinCard}>
            <View style={styles.joinCardTop}>
              <View style={styles.joinIconWrap}>
                <Ionicons
                  name={isOpen ? "person-add-outline" : "git-pull-request-outline"}
                  size={18}
                  color={COLORS.primary}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.joinCardTitle}>
                  {isOpen ? "Join this community space" : "Request to join"}
                </Text>
                <Text style={styles.joinCardText}>
                  {isOpen
                    ? "Become part of this shared space and start taking part."
                    : "Send a request and wait for review before joining."}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: SPACING.md }}>
              <Button
                title={joining ? "Please wait..." : joinLabel}
                onPress={handleJoin}
                disabled={joining || isClosed}
              />
            </View>
          </Card>
        ) : null}

        {pending ? (
          <Card style={styles.infoCard}>
            <View style={styles.infoTop}>
              <View style={styles.infoIconWrap}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.warning}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Request sent</Text>
                <Text style={styles.infoText}>
                  Your request is waiting for review. You will be able to take part
                  once it is approved.
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

        {joined ? (
          <Card style={styles.infoCardSuccess}>
            <View style={styles.infoTop}>
              <View style={styles.infoIconWrapSuccess}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.success}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>You are part of this space</Text>
                <Text style={styles.infoText}>
                  You can contribute and follow the activity of this community space.
                </Text>
              </View>
            </View>

            <View style={{ marginTop: SPACING.md }}>
              <Button
                title="Contribute"
                onPress={() =>
                  router.push(ROUTES.dynamic.groupContribute(groupId) as any)
                }
                leftIcon={
                  <Ionicons name="cash-outline" size={18} color="white" />
                }
              />
            </View>
          </Card>
        ) : null}

        <Section title="Activity">
          {rows.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="No activity yet"
              subtitle={
                joined
                  ? "Your contributions will appear here."
                  : "Activity will appear here once you become part of this space."
              }
            />
          ) : (
            rows.map((r, i) => (
              <Card key={i} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowIconWrap}>
                    <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
                  </View>

                  <View>
                    <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                    <Text style={styles.meta}>{fmtDate(r.created_at)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </Section>

        <Section title="About this space">
          <Card style={styles.about}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Type</Text>
              <Text style={styles.aboutValue}>{getGroupTypeLabel(group)}</Text>
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Join policy</Text>
              <Text style={styles.aboutValue}>
                {getJoinPolicyLabel(group.join_policy)}
              </Text>
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Members</Text>
              <Text style={styles.aboutValue}>{group.member_count ?? "—"}</Text>
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Contribution</Text>
              <Text style={styles.aboutValue}>{getContributionLabel(group)}</Text>
            </View>

            <View style={styles.aboutDivider} />

            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Created</Text>
              <Text style={styles.aboutValue}>{fmtDate(group.created_at)}</Text>
            </View>

            {group.description ? (
              <>
                <View style={styles.aboutDivider} />
                <View>
                  <Text style={styles.aboutLabel}>Description</Text>
                  <Text style={styles.descriptionText}>{group.description}</Text>
                </View>
              </>
            ) : null}
          </Card>
        </Section>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------------------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl || RADIUS.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },

  heroGlowPrimary: {
    position: "absolute",
    right: -28,
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  heroGlowAccent: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(242,140,40,0.18)",
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
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
    color: COLORS.white,
    fontSize: 20,
    fontFamily: FONT.bold,
  },

  sub: {
    color: "rgba(255,255,255,0.84)",
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },

  heroMetaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  heroMetaText: {
    color: COLORS.white,
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  joinCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  joinCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  joinIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.10)",
  },

  joinCardTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  joinCardText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  infoCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  infoCardSuccess: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  infoTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  infoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.12)",
  },

  infoIconWrapSuccess: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,125,50,0.12)",
  },

  infoTitle: {
    fontSize: 13,
    color: COLORS.text,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  infoText: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  row: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(37,99,235,0.10)",
  },

  amount: {
    fontFamily: FONT.bold,
    color: COLORS.text,
    fontSize: 13,
  },

  meta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  about: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  aboutRow: {
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  aboutDivider: {
    height: 1,
    backgroundColor: "rgba(15,23,42,0.06)",
  },

  aboutLabel: {
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  aboutValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 12,
    color: COLORS.text,
    fontFamily: FONT.bold,
  },

  descriptionText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },
});