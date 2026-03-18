// app/(tabs)/groups/[id].tsx
// ------------------------------------------------
// ✅ Updated to match latest services/groups.ts
// ✅ Uses getGroup() for real group details
// ✅ Uses getMyGroupContributions()
// ✅ Uses getMyGroupSavingsSummary() to show my share/fund view
// ✅ Uses source / note fields instead of old method / mpesa_receipt_number
// ✅ Uses ROUTES for navigation
// ------------------------------------------------

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

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getGroup,
  getMyGroupContributions,
  getMyGroupSavingsSummary,
  Group,
  GroupContribution,
  MyGroupSavingsRow,
} from "@/services/groups";

/* ------------------------------------------------
Helpers
------------------------------------------------ */

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).replace("T", " ").slice(0, 16);
  return d.toLocaleString();
}

function getSourceLabel(source?: string | null) {
  const v = String(source || "").toUpperCase();
  if (!v) return "—";
  if (v === "MPESA") return "M-Pesa";
  return v.replaceAll("_", " ");
}

function getJoinPolicyLabel(value?: string | null) {
  const v = String(value || "").toUpperCase();
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

function getGroupTypeLabel(group?: Group | null) {
  return group?.group_type_display || group?.group_type || "—";
}

/* ------------------------------------------------
Screen
------------------------------------------------ */

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [mySummary, setMySummary] = useState<MyGroupSavingsRow | null>(null);
  const [rows, setRows] = useState<GroupContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!groupId || Number.isNaN(groupId)) {
      Alert.alert("Group", "Invalid group id.");
      return;
    }

    try {
      const [groupRes, contributionsRes, savingsRes] = await Promise.all([
        getGroup(groupId),
        getMyGroupContributions(groupId),
        getMyGroupSavingsSummary(),
      ]);

      setGroup(groupRes ?? null);
      setRows(Array.isArray(contributionsRes) ? contributionsRes : []);

      const mine =
        Array.isArray(savingsRes)
          ? savingsRes.find((r) => Number(r?.group?.id) === groupId) || null
          : null;

      setMySummary(mine);
    } catch (e: any) {
      Alert.alert("Group", getApiErrorMessage(e));
      setGroup(null);
      setRows([]);
      setMySummary(null);
    }
  }, [groupId]);

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

  const total = useMemo(() => {
    return rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  }, [rows]);

  const myRole = mySummary?.my_role || group?.my_membership?.role || "—";
  const myShare = mySummary?.my_share;
  const fund = mySummary?.fund;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}

      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>{group?.name || `Group #${groupId}`}</Text>
            <Text style={styles.hSub}>
              {getGroupTypeLabel(group)} • {getJoinPolicyLabel(group?.join_policy)}
            </Text>
          </View>

          <Button
            variant="ghost"
            title="Back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
            }
          />
        </View>

        {group?.description ? (
          <Text style={styles.description}>{group.description}</Text>
        ) : null}

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Members</Text>
            <Text style={styles.metaValue}>{group?.member_count ?? "—"}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>My Role</Text>
            <Text style={styles.metaValue}>{String(myRole)}</Text>
          </View>
        </View>

        <View style={[styles.metaGrid, { marginTop: SPACING.sm }]}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Contribution Rule</Text>
            <Text style={styles.metaValue}>
              {group?.requires_contributions
                ? formatKes(group?.contribution_amount)
                : "Optional"}
            </Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Frequency</Text>
            <Text style={styles.metaValue}>
              {group?.contribution_frequency || "—"}
            </Text>
          </View>
        </View>
      </View>

      {/* My Summary */}

      <Section title="My Group Summary">
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>My Total Contribution</Text>
            <Text style={styles.summaryValue}>
              {formatKes(myShare?.total_contributed ?? total)}
            </Text>
          </View>

          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>Available Share</Text>
            <Text style={styles.summaryValue}>
              {formatKes(myShare?.available_share ?? "0")}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>Reserved Share</Text>
            <Text style={styles.summaryValue}>
              {formatKes(myShare?.reserved_share ?? "0")}
            </Text>
          </View>

          <View style={[styles.summaryCard, SHADOW.card]}>
            <Text style={styles.summaryLabel}>Group Fund</Text>
            <Text style={styles.summaryValue}>
              {fund?.balance == null ? "Admins only" : formatKes(fund.balance)}
            </Text>
          </View>
        </View>
      </Section>

      {/* Actions */}

      <View style={styles.actionBar}>
        <Button
          title="Contribute"
          onPress={() =>
            router.push(ROUTES.dynamic.groupContribute(groupId) as any)
          }
          style={{ flex: 1 }}
          leftIcon={
            <Ionicons name="cash-outline" size={18} color={COLORS.white} />
          }
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="My Memberships"
          variant="secondary"
          onPress={() =>
            router.push(ROUTES.dynamic.groupMemberships(groupId) as any)
          }
          style={{ flex: 1 }}
          leftIcon={
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
          }
        />
      </View>

      {/* Fund Notice */}

      {fund?.balance == null ? (
        <Card style={styles.noticeCard}>
          <View style={styles.noticeTop}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={COLORS.info}
            />
            <Text style={styles.noticeText}>
              Group fund totals are visible to group admins only. You can still
              see your own contribution share above.
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Contribution History */}

      <Section title="My Contribution History">
        {rows.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No contributions yet"
            subtitle="Your group contributions will appear here."
          />
        ) : (
          rows.map((r, index) => {
            return (
              <Card key={r.id ?? index} style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.amount}>{formatKes(r.amount)}</Text>
                  <Text style={styles.sourcePill}>{getSourceLabel(r.source)}</Text>
                </View>

                <Text style={styles.meta}>
                  {fmtDate(r.created_at)}
                  {r.reference ? ` • Ref: ${r.reference}` : ""}
                </Text>

                {r.note ? <Text style={styles.narration}>{r.note}</Text> : null}
              </Card>
            );
          })
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/* ------------------------------------------------
Styles
------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  description: {
    marginTop: SPACING.md,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.gray,
  },

  metaGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.md,
  },

  metaBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  metaLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  metaValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: SPACING.sm as any,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    marginTop: 8,
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.dark,
  },

  actionBar: {
    flexDirection: "row",
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: "center",
  },

  noticeCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  noticeTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },

  noticeText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  rowCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  amount: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sourcePill: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: COLORS.primary,
  },

  meta: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  narration: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
});
