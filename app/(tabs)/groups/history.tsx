// app/(tabs)/groups/history.tsx

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
    row?.narration || row?.note || row?.description || ""
  ).trim();
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
        <ActivityIndicator color={COLORS.primary} />
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
        <View style={styles.heroGlowOne} />
        <View style={styles.heroGlowTwo} />

        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Community contribution history</Text>
            <Text style={styles.heroSubtitle}>
              Follow how you have supported your community spaces over time.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="time-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Total added</Text>
            <Text style={styles.heroStatValue}>
              {formatKes(totals.totalAmount)}
            </Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Spaces</Text>
            <Text style={styles.heroStatValue}>{totals.totalSpaces}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Entries</Text>
            <Text style={styles.heroStatValue}>{totals.totalEntries}</Text>
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Button
            title="Your spaces"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Explore spaces"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {groupedRows.length === 0 ? (
        <Section title="Activity">
          <EmptyState
            icon="time-outline"
            title="No contribution history yet"
            subtitle="Your community contribution activity will appear here once you begin contributing."
          />
        </Section>
      ) : (
        groupedRows.map((group) => (
          <Section key={group.groupId} title={group.groupName}>
            <Card style={styles.groupSummaryCard}>
              <View style={styles.groupSummaryTop}>
                <View style={styles.groupSummaryIcon}>
                  <Ionicons name="people-outline" size={18} color={COLORS.white} />
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
                <Button
                  title="Open space"
                  variant="secondary"
                  onPress={() =>
                    router.push(ROUTES.dynamic.groupDetail(group.groupId) as any)
                  }
                  style={{ flex: 1 }}
                />
                <View style={{ width: SPACING.sm }} />
                <Button
                  title="Contribute"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/groups/contribute" as any,
                      params: { groupId: String(group.groupId) },
                    })
                  }
                  style={{ flex: 1 }}
                />
              </View>
            </Card>

            {group.rows.map((row) => {
              const noteText = getNote(row);

              return (
                <Card key={`${group.groupId}-${row.id}`} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowLeft}>
                      <View style={styles.rowIconWrap}>
                        <Ionicons
                          name="cash-outline"
                          size={16}
                          color={COLORS.primary}
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
                      <Text style={styles.addedPillText}>ADDED</Text>
                    </View>
                  </View>

                  {noteText ? (
                    <Text style={styles.note}>{noteText}</Text>
                  ) : null}
                </Card>
              );
            })}
          </Section>
        ))
      )}

      <View style={{ height: 24 }} />
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
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
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
    backgroundColor: "rgba(242,140,40,0.18)",
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
    marginTop: SPACING.lg,
    gap: SPACING.sm as any,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
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
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  heroActionsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
  },

  groupSummaryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
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
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },

  groupSummaryTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.text,
  },

  groupSummarySub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  groupSummaryAmountWrap: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(46,125,50,0.12)",
  },

  groupSummaryAmount: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.success,
  },

  groupSummaryActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
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
    backgroundColor: "rgba(37,99,235,0.10)",
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.text,
  },

  meta: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
    lineHeight: 18,
  },

  note: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
    lineHeight: 18,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },

  addedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(46,125,50,0.12)",
  },

  addedPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: COLORS.success,
  },
});