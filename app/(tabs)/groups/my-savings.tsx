// app/(tabs)/groups/my-savings.tsx
// ------------------------------------------------
// ✅ New screen for my group savings summary
// ✅ Matches latest services/groups.ts
// ✅ Uses getMyGroupSavingsSummary()
// ✅ Shows my share + admin-only fund visibility
// ✅ Opens related group detail
// ------------------------------------------------

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
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
    getMyGroupSavingsSummary,
    MyGroupSavingsRow,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type SavingsUser = Partial<MeResponse> & Partial<SessionUser>;

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function groupTypeLabel(row: MyGroupSavingsRow) {
  return row.group.group_type_display || row.group.group_type || "Group";
}

function roleLabel(role?: string | null) {
  return String(role || "—").replaceAll("_", " ").toUpperCase();
}

function roleColor(role?: string | null) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return COLORS.info;
  if (r === "TREASURER") return COLORS.warning;
  if (r === "SECRETARY") return COLORS.primary;
  if (r === "MEMBER") return COLORS.success;
  return COLORS.gray;
}

function Pill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

function SavingsCard({ row }: { row: MyGroupSavingsRow }) {
  const isAdminFundVisible = row.fund?.balance != null;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>{row.group.name}</Text>
          <Text style={styles.sub}>{groupTypeLabel(row)}</Text>
        </View>

        <Pill label={roleLabel(row.my_role)} color={roleColor(row.my_role)} />
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>My Total Contributed</Text>
        <Text style={styles.kvValue}>
          {formatKes(row.my_share?.total_contributed)}
        </Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Reserved Share</Text>
        <Text style={styles.kvValue}>
          {formatKes(row.my_share?.reserved_share)}
        </Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Available Share</Text>
        <Text style={styles.kvValue}>
          {formatKes(row.my_share?.available_share)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Group Fund Balance</Text>
        <Text style={styles.kvValue}>
          {isAdminFundVisible ? formatKes(row.fund?.balance) : "Admins only"}
        </Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Reserved Fund</Text>
        <Text style={styles.kvValue}>
          {isAdminFundVisible
            ? formatKes(row.fund?.reserved_amount)
            : "Admins only"}
        </Text>
      </View>

      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Available Fund</Text>
        <Text style={styles.kvValue}>
          {isAdminFundVisible
            ? formatKes(row.fund?.available_balance)
            : "Admins only"}
        </Text>
      </View>

      {!isAdminFundVisible ? (
        <Text style={styles.noticeText}>
          Group fund totals are visible to group admins only.
        </Text>
      ) : null}

      <View style={styles.actionsRow}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => router.push(ROUTES.dynamic.groupDetail(row.group.id) as any)}
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="Contribute"
          onPress={() => router.push(ROUTES.dynamic.groupContribute(row.group.id) as any)}
          style={{ flex: 1 }}
          leftIcon={
            <Ionicons name="cash-outline" size={18} color={COLORS.white} />
          }
        />
      </View>
    </Card>
  );
}

export default function MyGroupSavingsScreen() {
  const [user, setUser] = useState<SavingsUser | null>(null);
  const [rows, setRows] = useState<MyGroupSavingsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, rowsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMyGroupSavingsSummary(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: SavingsUser | null =
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null;

      setUser(mergedUser);

      setRows(
        rowsRes.status === "fulfilled" && Array.isArray(rowsRes.value)
          ? rowsRes.value
          : []
      );

      if (rowsRes.status === "rejected") {
        setError(getApiErrorMessage(rowsRes.reason));
      }
    } catch (e: any) {
      setError(getApiErrorMessage(e));
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
    const contributed = rows.reduce(
      (sum, r) => sum + Number(r.my_share?.total_contributed || 0),
      0
    );
    const reserved = rows.reduce(
      (sum, r) => sum + Number(r.my_share?.reserved_share || 0),
      0
    );
    const available = rows.reduce(
      (sum, r) => sum + Number(r.my_share?.available_share || 0),
      0
    );

    return {
      groups: rows.length,
      contributed,
      reserved,
      available,
    };
  }, [rows]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to view your group savings."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login as any)}
        />
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>My Group Savings</Text>
          <Text style={styles.hSub}>
            View your contribution share across all groups.
          </Text>
        </View>

        <Button
          variant="ghost"
          title="Refresh"
          onPress={onRefresh}
          leftIcon={
            <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
          }
        />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.summaryGrid}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Groups</Text>
          <Text style={styles.summaryValue}>{totals.groups}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Contributed</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.contributed)}</Text>
        </View>
      </View>

      <View style={[styles.summaryGrid, { marginTop: SPACING.sm }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Reserved Share</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.reserved)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Available Share</Text>
          <Text style={styles.summaryValue}>{formatKes(totals.available)}</Text>
        </View>
      </View>

      <Section title="Quick Actions">
        <View style={styles.actionsRow}>
          <Button
            title="Browse Groups"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="My Memberships"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={{ flex: 1 }}
          />
        </View>
      </Section>

      <Section title="Savings by Group">
        {rows.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No group savings yet"
            subtitle="Once you join groups and contribute, your group savings summary will appear here."
            actionLabel="Browse Groups"
            onAction={() => router.push(ROUTES.tabs.groupsAvailable as any)}
          />
        ) : (
          rows.map((row) => <SavingsCard key={row.group.id} row={row} />)
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
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

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    fontFamily: FONT.regular,
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
    ...SHADOW.card,
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

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  divider: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  noticeText: {
    marginTop: SPACING.sm,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },

  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },

  pillText: {
    fontSize: 11,
    color: COLORS.text,
    fontFamily: FONT.medium,
  },
});