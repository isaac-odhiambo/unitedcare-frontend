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
  getMyGroupSavingsSummary,
  Group,
  GroupContribution,
  listGroupMemberships,
  listMyGroupJoinRequests,
  MyGroupSavingsRow,
} from "@/services/groups";

/* ----------------------------------------------- */

const PAGE_BG = "#062C49";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BG_STRONG = "rgba(255,255,255,0.12)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const WHITE = "#FFFFFF";
const SOFT_TEXT = "rgba(255,255,255,0.75)";
const SOFT_TEXT_2 = "rgba(255,255,255,0.84)";
const HERO_GREEN = "#74D16C";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `KES ${safe.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [rows, setRows] = useState<GroupContribution[]>([]);
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);
  const [mySummary, setMySummary] = useState<MyGroupSavingsRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const goBackToGroups = useCallback(() => {
    router.replace(ROUTES.tabs.groups as any);
  }, []);

  const load = useCallback(async () => {
    try {
      const [
        groupRes,
        contributions,
        memberships,
        joinRequests,
        mySavingsSummary,
      ] = await Promise.all([
        getGroup(groupId),
        getMyGroupContributions(groupId),
        listGroupMemberships(),
        listMyGroupJoinRequests(),
        getMyGroupSavingsSummary(),
      ]);

      const safeRows = Array.isArray(contributions) ? contributions : [];
      const safeMemberships = Array.isArray(memberships) ? memberships : [];
      const safeJoinRequests = Array.isArray(joinRequests) ? joinRequests : [];
      const safeSummary = Array.isArray(mySavingsSummary) ? mySavingsSummary : [];

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

      const currentGroupSummary =
        safeSummary.find((item: any) => {
          const id = item?.group?.id ?? item?.group_id ?? item?.group;
          return Number(id) === groupId;
        }) || null;

      setGroup(groupRes);
      setRows(safeRows);
      setJoined(isMember || !!currentGroupSummary || safeRows.length > 0);
      setPending(hasPendingRequest);
      setMySummary(currentGroupSummary);
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

  const joinPolicy = String(group?.join_policy || "").toUpperCase().trim();

  const isClosed = joinPolicy === "CLOSED";
  const isOpen = joinPolicy === "OPEN";
  const isApproval = joinPolicy === "APPROVAL";

  const joinLabel = getJoinActionLabel(joinPolicy);

  const handleJoin = () => {
    if (!group) return;

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

  const totalContributed = mySummary?.my_share?.total_contributed ?? "0";
  const reservedShare = mySummary?.my_share?.reserved_share ?? "0";
  const availableShare = mySummary?.my_share?.available_share ?? "0";

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group || !Number.isFinite(groupId)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.centerWrap}>
          <EmptyState
            icon="people-outline"
            title="Space not available"
            subtitle="This community space could not be opened."
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
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <Ionicons name="people-outline" size={20} color={WHITE} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>
                GROUP <Text style={styles.brandWordmarkGreen}>DETAILS</Text>
              </Text>
              <Text style={styles.brandSub}>Community space overview</Text>
            </View>
          </View>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={WHITE} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={goBackToGroups}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroGlowThird} />

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

          <Text style={styles.heroTag}>COMMUNITY SPACE</Text>
          <Text style={styles.title}>{group.name}</Text>
          <Text style={styles.sub}>{headerSubtitle}</Text>

          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaPill}>
              <Ionicons name="people-outline" size={14} color={WHITE} />
              <Text style={styles.heroMetaText}>
                {group.member_count ?? "—"} member
                {Number(group.member_count || 0) === 1 ? "" : "s"}
              </Text>
            </View>

            <View style={styles.heroMetaPill}>
              <Ionicons name="wallet-outline" size={14} color={WHITE} />
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
          <>
            <InfoCard
              title="You are part of this space"
              text="You can contribute and follow your activity in this community space."
              icon="checkmark-circle-outline"
              success
              action={
                <GlassButton
                  title="Contribute"
                  onPress={() =>
                    router.push(ROUTES.dynamic.groupContribute(groupId) as any)
                  }
                  primary
                  leftIcon={
                    <Ionicons name="cash-outline" size={18} color="#0C6A80" />
                  }
                />
              }
            />

            <SectionTitle title="My balance in this space" />
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
                label="Available balance"
                value={formatKes(availableShare)}
                icon="card-outline"
              />
            </View>
          </>
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

                <View style={{ flex: 1 }}>
                  <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                  <Text style={styles.meta}>{fmtDate(r.created_at)}</Text>
                  {!!r.reference ? (
                    <Text style={styles.metaSmall}>Ref: {r.reference}</Text>
                  ) : null}
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

        <View style={styles.bottomActions}>
          <GlassButton
            title="Back to Groups"
            onPress={goBackToGroups}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ----------------------------------------------- */

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

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: PAGE_BG,
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
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  logoBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  brandWordmark: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
    letterSpacing: 0.8,
  },

  brandWordmarkGreen: {
    color: HERO_GREEN,
  },

  brandSub: {
    color: SOFT_TEXT,
    fontSize: 11,
    marginTop: 2,
    fontFamily: FONT.regular,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  heroGlowThird: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.08)",
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
    color: WHITE,
    fontSize: 24,
    fontFamily: FONT.bold,
  },

  sub: {
    color: SOFT_TEXT_2,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
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
    backgroundColor: CARD_BG_STRONG,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroMetaText: {
    color: WHITE,
    fontSize: 11,
    fontFamily: FONT.bold,
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

  joinCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  joinIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    marginRight: 12,
  },

  joinCardTitle: {
    color: WHITE,
    fontSize: 16,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  joinCardText: {
    color: SOFT_TEXT_2,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
  },

  infoCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  infoTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.82)",
  },

  infoIconWrapSuccess: {
    backgroundColor: "rgba(255,255,255,0.90)",
  },

  infoIconWrapWarning: {
    backgroundColor: "rgba(255,255,255,0.82)",
  },

  infoTitle: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
    marginBottom: 4,
  },

  infoText: {
    color: SOFT_TEXT_2,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONT.regular,
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

  emptyCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: SPACING.lg,
  },

  row: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 10,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.90)",
    marginRight: 12,
  },

  amount: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  meta: {
    marginTop: 4,
    color: SOFT_TEXT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  metaSmall: {
    marginTop: 3,
    color: "rgba(255,255,255,0.66)",
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  about: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  aboutLabel: {
    color: SOFT_TEXT,
    fontSize: 13,
    fontFamily: FONT.medium,
    flex: 1,
    marginRight: 12,
  },

  aboutValue: {
    color: WHITE,
    fontSize: 13,
    fontFamily: FONT.bold,
    flex: 1,
    textAlign: "right",
  },

  aboutDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginVertical: 14,
  },

  descriptionText: {
    marginTop: 8,
    color: SOFT_TEXT_2,
    fontSize: 13,
    lineHeight: 21,
    fontFamily: FONT.regular,
  },

  bottomActions: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
});