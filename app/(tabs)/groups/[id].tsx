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

function InfoCard({
  title,
  text,
  icon,
  success = false,
  action,
}: {
  title: string;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  success?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoTop}>
        <View
          style={[
            styles.infoIconWrap,
            success ? styles.infoIconWrapSuccess : styles.infoIconWrapWarning,
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={success ? "#379B4A" : "#0C6A80"}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>{title}</Text>
          <Text style={styles.infoText}>{text}</Text>
        </View>
      </View>

      {action ? <View style={{ marginTop: SPACING.md }}>{action}</View> : null}
    </View>
  );
}

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

  const headerSubtitle = useMemo(() => {
    return `${getGroupTypeLabel(group)} • ${getJoinPolicyLabel(group?.join_policy)}`;
  }, [group]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#8CF0C7" />
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
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

        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroGlowThird} />

          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="people-outline" size={20} color="#FFFFFF" />
            </View>

            <View style={[styles.statusPill, { backgroundColor: badgeInfo.bg }]}>
              <Text style={[styles.statusText, { color: badgeInfo.color }]}>
                {badgeInfo.text}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTag}>COMMUNITY SPACE</Text>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.sub}>{headerSubtitle}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="people-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMetaText}>
                {group.member_count ?? "—"} member
                {Number(group.member_count || 0) === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.heroMetaPill}>
              <Ionicons name="wallet-outline" size={14} color="#FFFFFF" />
              <Text style={styles.heroMetaText}>
                {getContributionLabel(group)}
              </Text>
            </View>
          </View>
        </View>

        {!joined && !pending ? (
          <View style={styles.joinCard}>
            <View style={styles.joinCardTop}>
              <View style={styles.joinIconWrap}>
                <Ionicons
                  name={isOpen ? "person-add-outline" : "git-pull-request-outline"}
                  size={18}
                  color="#0C6A80"
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
              <GlassButton
                title={joining ? "Please wait..." : joinLabel}
                onPress={handleJoin}
                disabled={joining || isClosed}
                primary
              />
            </View>
          </View>
        ) : null}

        {pending ? (
          <InfoCard
            title="Request sent"
            text="Your request is waiting for review. You will be able to take part once it is approved."
            icon="time-outline"
          />
        ) : null}

        {joined ? (
          <InfoCard
            title="You are part of this space"
            text="You can contribute and follow the activity of this community space."
            icon="checkmark-circle-outline"
            success
            action={
              <GlassButton
                title="Contribute"
                onPress={() =>
                  router.push(ROUTES.dynamic.groupContribute(groupId) as any)
                }
                primary
                leftIcon={<Ionicons name="cash-outline" size={18} color="#0C6A80" />}
              />
            }
          />
        ) : null}

        <SectionTitle title="Activity" />
        {rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="time-outline"
              title="No activity yet"
              subtitle={
                joined
                  ? "Your contributions will appear here."
                  : "Activity will appear here once you become part of this space."
              }
            />
          </View>
        ) : (
          rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.rowIconWrap}>
                  <Ionicons name="cash-outline" size={16} color="#0A6E8A" />
                </View>

                <View>
                  <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                  <Text style={styles.meta}>{fmtDate(r.created_at)}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <SectionTitle title="About this space" />
        <View style={styles.about}>
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
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------------------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  container: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0C6A80",
  },

  centerWrap: {
    flex: 1,
    justifyContent: "center",
    padding: SPACING.lg,
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
    top: 260,
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
    top: 140,
    right: 18,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 8,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    padding: SPACING.lg,
    borderRadius: 28,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
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
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThird: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
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
    borderRadius: 23,
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

  title: {
    color: "#FFFFFF",
    fontSize: 22,
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
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
  },

  buttonSecondary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    color: "#FFFFFF",
  },

  joinCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  joinCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  joinIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.90)",
  },

  joinCardTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  joinCardText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  infoCard: {
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  infoTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  infoIconWrapWarning: {
    backgroundColor: "rgba(236, 251, 255, 0.90)",
  },

  infoIconWrapSuccess: {
    backgroundColor: "rgba(236,255,235,0.92)",
  },

  infoTitle: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  infoText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  emptyCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: SPACING.lg,
  },

  row: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 22,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  amount: {
    fontFamily: FONT.bold,
    color: "#FFFFFF",
    fontSize: 13,
  },

  meta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  about: {
    padding: SPACING.md,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  aboutLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontFamily: FONT.regular,
  },

  aboutValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  descriptionText: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
    fontFamily: FONT.regular,
  },
});