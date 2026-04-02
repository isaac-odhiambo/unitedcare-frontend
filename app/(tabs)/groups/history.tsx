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

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  getMyGroupContributions,
  GroupContribution,
  GroupMembership,
  listGroupMemberships,
} from "@/services/groups";

type HistoryRow = GroupContribution & {
  __groupId?: number;
  __groupName?: string;
  narration?: string;
  description?: string;
};

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "KES 0";
  return `KES ${n.toLocaleString("en-KE")}`;
}

function formatDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v).slice(0, 16);
  return d.toLocaleDateString();
}

function toNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sortNewest(a?: string, b?: string) {
  const aa = a ? new Date(a).getTime() : 0;
  const bb = b ? new Date(b).getTime() : 0;
  return bb - aa;
}

function getNote(row: Partial<HistoryRow> | null | undefined): string {
  return String(
    row?.narration || (row as any)?.note || row?.description || ""
  ).trim();
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SoftButton({
  title,
  onPress,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.softButton,
        secondary ? styles.softButtonSecondary : styles.softButtonPrimary,
      ]}
    >
      <Text
        style={[
          styles.softButtonText,
          secondary
            ? styles.softButtonTextSecondary
            : styles.softButtonTextPrimary,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function GroupHistoryScreen() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const myMemberships = await listGroupMemberships();
      const safeMemberships = Array.isArray(myMemberships) ? myMemberships : [];
      setMemberships(safeMemberships);

      const contributionResults = await Promise.allSettled(
        safeMemberships.map(async (membership) => {
          const groupId = Number(getGroupIdFromMembership(membership));
          const groupName = getGroupNameFromMembership(membership);

          if (!Number.isFinite(groupId) || groupId <= 0) {
            return [] as HistoryRow[];
          }

          const contributionRows = await getMyGroupContributions(groupId);
          const safeRows = Array.isArray(contributionRows) ? contributionRows : [];

          return safeRows.map((row) => ({
            ...row,
            __groupId: groupId,
            __groupName: groupName,
          })) as HistoryRow[];
        })
      );

      const combined: HistoryRow[] = contributionResults.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );

      combined.sort((a, b) => sortNewest(a.created_at, b.created_at));
      setRows(combined);
    } catch (e: any) {
      Alert.alert("Community spaces", getApiErrorMessage(e) || getErrorMessage(e));
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

  const totals = useMemo(() => {
    const totalAmount = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const totalSpaces = new Set(
      rows
        .map((row) => Number(row.__groupId))
        .filter((id) => Number.isFinite(id) && id > 0)
    ).size;

    return {
      totalAmount,
      totalSpaces,
      totalEntries: rows.length,
    };
  }, [rows]);

  const groupedRows = useMemo(() => {
    const bucket = new Map<
      number,
      {
        groupId: number;
        groupName: string;
        total: number;
        rows: HistoryRow[];
      }
    >();

    rows.forEach((row) => {
      const groupId = Number(row.__groupId || 0);
      if (!Number.isFinite(groupId) || groupId <= 0) return;

      const groupName = String(row.__groupName || `Space #${groupId}`);

      if (!bucket.has(groupId)) {
        bucket.set(groupId, {
          groupId,
          groupName,
          total: 0,
          rows: [],
        });
      }

      const item = bucket.get(groupId)!;
      item.total += toNumber(row.amount);
      item.rows.push(row);
    });

    return Array.from(bucket.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#8CF0C7" />
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
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTag}>COMMUNITY HISTORY</Text>
            <Text style={styles.heroTitle}>Community contribution history</Text>
            <Text style={styles.heroSubtitle}>
              Follow how you have supported your community spaces over time.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="time-outline" size={22} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Total contributed</Text>
            <Text style={styles.heroStatValue}>
              {formatKes(totals.totalAmount)}
            </Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Community spaces</Text>
            <Text style={styles.heroStatValue}>{totals.totalSpaces}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Activities</Text>
            <Text style={styles.heroStatValue}>{totals.totalEntries}</Text>
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <SoftButton
            title="My spaces"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
          />
          <View style={{ width: SPACING.sm }} />
          <SoftButton
            title="Explore community"
            secondary
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
          />
        </View>
      </View>

      {groupedRows.length === 0 ? (
        <>
          <SectionTitle title="Activity" />
          <View style={styles.emptyHolder}>
            <EmptyState
              icon="time-outline"
              title="No activity yet"
              subtitle="Your contributions will appear here once you start supporting your community spaces."
            />
          </View>
        </>
      ) : (
        groupedRows.map((group) => (
          <View key={group.groupId} style={styles.groupSection}>
            <SectionTitle title={group.groupName} />

            <View style={styles.groupSummaryCard}>
              <View style={styles.groupSummaryTop}>
                <View style={styles.groupSummaryIcon}>
                  <Ionicons name="people-outline" size={18} color="#0A6E8A" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.groupSummaryTitle}>{group.groupName}</Text>
                  <Text style={styles.groupSummarySub}>
                    {group.rows.length} contribution
                    {group.rows.length === 1 ? "" : "s"} recorded
                  </Text>
                </View>

                <View style={styles.groupSummaryAmountWrap}>
                  <Text style={styles.groupSummaryAmount}>
                    {formatKes(group.total)}
                  </Text>
                </View>
              </View>

              <View style={styles.groupSummaryActions}>
                <SoftButton
                  title="Open space"
                  secondary
                  onPress={() =>
                    router.push(ROUTES.dynamic.groupDetail(group.groupId) as any)
                  }
                />
                <View style={{ width: SPACING.sm }} />
                <SoftButton
                  title="Contribute"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/groups/contribute" as any,
                      params: { groupId: String(group.groupId) },
                    })
                  }
                />
              </View>
            </View>

            {group.rows.map((row) => {
              const noteText = getNote(row);

              return (
                <View key={`${group.groupId}-${row.id}`} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons
                          name="cash-outline"
                          size={16}
                          color="#0A6E8A"
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.amount}>{formatKes(row.amount)}</Text>
                        <Text style={styles.meta}>
                          {formatDate(row.created_at)}
                          {row.reference ? ` • Ref: ${row.reference}` : ""}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.addedPill}>
                      <Text style={styles.addedPillText}>CONTRIBUTED</Text>
                    </View>
                  </View>

                  {noteText ? <Text style={styles.note}>{noteText}</Text> : null}
                </View>
              );
            })}
          </View>
        ))
      )}

      <View style={{ height: 24 }} />
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
    paddingBottom: 24,
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
    marginTop: SPACING.lg,
    gap: SPACING.sm as any,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: SPACING.sm,
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

  heroActionsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
  },

  softButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  softButtonPrimary: {
    backgroundColor: "#FFFFFF",
  },

  softButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  softButtonText: {
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  softButtonTextPrimary: {
    color: "#0C6A80",
  },

  softButtonTextSecondary: {
    color: "#FFFFFF",
  },

  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  emptyHolder: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  groupSection: {
    marginBottom: SPACING.sm,
  },

  groupSummaryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  groupSummaryTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  groupSummaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
    marginRight: 12,
  },

  groupSummaryTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  groupSummarySub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
  },

  groupSummaryAmountWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  groupSummaryAmount: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  groupSummaryActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
  },

  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  rowLeft: {
    flex: 1,
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
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  meta: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontFamily: FONT.regular,
    lineHeight: 18,
  },

  note: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    fontFamily: FONT.regular,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    paddingTop: 10,
  },

  addedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  addedPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },
});