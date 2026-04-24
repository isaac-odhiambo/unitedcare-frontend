import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

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

type Params = {
  groupId?: string | string[];
  group_id?: string | string[];
  title?: string | string[];
};

function getFirstParam(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "").trim();
  }
  return String(value ?? "").trim();
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

function buildStableRowKey(row: HistoryRow, index: number, groupId: number) {
  const idPart =
    row.id !== undefined && row.id !== null && String(row.id).trim() !== ""
      ? String(row.id)
      : "no-id";

  const createdPart =
    row.created_at && String(row.created_at).trim() !== ""
      ? String(row.created_at)
      : "no-date";

  const amountPart =
    row.amount !== undefined && row.amount !== null
      ? String(row.amount)
      : "no-amount";

  const refPart =
    row.reference && String(row.reference).trim() !== ""
      ? String(row.reference)
      : "no-ref";

  return `${groupId}-${idPart}-${createdPart}-${amountPart}-${refPart}-${index}`;
}

function dedupeMemberships(items: GroupMembership[]): GroupMembership[] {
  const seen = new Set<number>();
  const output: GroupMembership[] = [];

  for (const membership of items) {
    const groupId = Number(getGroupIdFromMembership(membership));
    if (!Number.isFinite(groupId) || groupId <= 0) continue;
    if (seen.has(groupId)) continue;
    seen.add(groupId);
    output.push(membership);
  }

  return output;
}

function buildContributionSignature(row: HistoryRow): string {
  const idPart =
    row.id !== undefined && row.id !== null && String(row.id).trim() !== ""
      ? `id:${String(row.id)}`
      : "id:none";

  const refPart =
    row.reference && String(row.reference).trim() !== ""
      ? `ref:${String(row.reference).trim()}`
      : "ref:none";

  const amountPart = `amount:${String(row.amount ?? "")}`;
  const createdPart = `created:${String(row.created_at ?? "")}`;
  const groupPart = `group:${String(row.__groupId ?? "")}`;

  return `${groupPart}|${idPart}|${refPart}|${amountPart}|${createdPart}`;
}

function dedupeRows(items: HistoryRow[]): HistoryRow[] {
  const seen = new Set<string>();
  const output: HistoryRow[] = [];

  for (const row of items) {
    const signature = buildContributionSignature(row);
    if (seen.has(signature)) continue;
    seen.add(signature);
    output.push(row);
  }

  return output;
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
  const params = useLocalSearchParams<Params>();

  const routeGroupId =
    getNumericRouteParam(params.groupId) ??
    getNumericRouteParam(params.group_id);

  const explicitTitle = getFirstParam(params.title);

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const myMemberships = await listGroupMemberships();
      const safeMemberships = Array.isArray(myMemberships) ? myMemberships : [];
      const uniqueMemberships = dedupeMemberships(safeMemberships);

      setMemberships(uniqueMemberships);

      if (routeGroupId) {
        const matchedMembership =
          uniqueMemberships.find((membership) => {
            const groupId = Number(getGroupIdFromMembership(membership));
            return groupId === routeGroupId;
          }) || null;

        const groupName = matchedMembership
          ? getGroupNameFromMembership(matchedMembership)
          : explicitTitle || `Group ${routeGroupId}`;

        const contributionRows = await getMyGroupContributions(routeGroupId);
        const safeRows = Array.isArray(contributionRows) ? contributionRows : [];

        const preparedRows: HistoryRow[] = dedupeRows(
          safeRows.map((row) => ({
            ...row,
            __groupId: routeGroupId,
            __groupName: groupName,
          }))
        ).sort((a, b) => sortNewest(a.created_at, b.created_at));

        setRows(preparedRows);
        return;
      }

      const contributionResults = await Promise.allSettled(
        uniqueMemberships.map(async (membership) => {
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

      const uniqueCombined = dedupeRows(combined).sort((a, b) =>
        sortNewest(a.created_at, b.created_at)
      );

      setRows(uniqueCombined);
    } catch (e: any) {
      Alert.alert("Group history", getApiErrorMessage(e) || getErrorMessage(e));
    }
  }, [explicitTitle, routeGroupId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        await load();
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

      const groupName = String(row.__groupName || `Group ${groupId}`);

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

    return Array.from(bucket.values()).sort((a, b) =>
      sortNewest(a.rows[0]?.created_at, b.rows[0]?.created_at)
    );
  }, [rows]);

  const screenTitle = useMemo(() => {
    if (routeGroupId && groupedRows.length === 1) {
      return groupedRows[0].groupName;
    }

    if (routeGroupId && explicitTitle) {
      return explicitTitle;
    }

    return "Contribution history";
  }, [explicitTitle, groupedRows, routeGroupId]);

  const screenSubtitle = useMemo(() => {
    if (routeGroupId) {
      return "Your activity for this group";
    }
    return "Your activity across all groups";
  }, [routeGroupId]);

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
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
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTag}>GROUP HISTORY</Text>
              <Text style={styles.headerTitle}>{screenTitle}</Text>
              <Text style={styles.headerSubtitle}>{screenSubtitle}</Text>
            </View>

            <View style={styles.headerIconWrap}>
              <Ionicons name="time-outline" size={20} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{formatKes(totals.totalAmount)}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Groups</Text>
              <Text style={styles.statValue}>{totals.totalSpaces}</Text>
            </View>

            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Entries</Text>
              <Text style={styles.statValue}>{totals.totalEntries}</Text>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <SoftButton
              title="Back"
              secondary
              onPress={() =>
                routeGroupId
                  ? router.push(ROUTES.dynamic.groupDetail(routeGroupId) as any)
                  : router.push(ROUTES.tabs.groups as any)
              }
            />
            <View style={{ width: SPACING.sm }} />
            <SoftButton
              title={routeGroupId ? "Open group" : "My groups"}
              onPress={() =>
                routeGroupId
                  ? router.push(ROUTES.dynamic.groupDetail(routeGroupId) as any)
                  : router.push(ROUTES.tabs.groupsMemberships as any)
              }
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
                subtitle={
                  routeGroupId
                    ? "Your contributions for this group will appear here."
                    : "Your contributions will appear here once you start supporting your groups."
                }
              />
            </View>
          </>
        ) : (
          groupedRows.map((group) => (
            <View key={`group-${group.groupId}`} style={styles.groupSection}>
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

                  <Text style={styles.groupSummaryAmount}>
                    {formatKes(group.total)}
                  </Text>
                </View>

                <View style={styles.groupSummaryActions}>
                  <SoftButton
                    title="Open group"
                    secondary
                    onPress={() =>
                      router.push(ROUTES.dynamic.groupDetail(group.groupId) as any)
                    }
                  />
                </View>
              </View>

              {group.rows.map((row, index) => {
                const noteText = getNote(row);
                const rowKey = buildStableRowKey(row, index, group.groupId);

                return (
                  <View key={rowKey} style={styles.rowCard}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  headerCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  headerTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 10,
    fontFamily: FONT.bold,
    marginBottom: 10,
  },

  headerTitle: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: "#FFFFFF",
  },

  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(255,255,255,0.82)",
    fontFamily: FONT.regular,
  },

  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  statsRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: SPACING.sm,
    marginRight: 8,
  },

  statLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
    fontFamily: FONT.regular,
  },

  statValue: {
    marginTop: 4,
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  actionsRow: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  softButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  softButtonPrimary: {
    backgroundColor: "#FFFFFF",
  },

  softButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.10)",
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
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  groupSection: {
    marginBottom: SPACING.sm,
  },

  groupSummaryCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(236, 251, 255, 0.92)",
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
    color: "rgba(255,255,255,0.76)",
  },

  groupSummaryAmount: {
    fontFamily: FONT.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  groupSummaryActions: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
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
    backgroundColor: "rgba(236, 251, 255, 0.92)",
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  meta: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.76)",
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
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  addedPillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },
});