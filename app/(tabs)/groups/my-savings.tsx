// app/(tabs)/groups/my-savings.tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
  return `KES ${n.toLocaleString("en-KE")}`;
}

function groupTypeLabel(row: MyGroupSavingsRow) {
  return row.group.group_type_display || row.group.group_type || "Group";
}

function roleTone(role?: string | null) {
  const r = String(role || "").toUpperCase().trim();

  if (r === "ADMIN") {
    return {
      bg: "rgba(59,130,246,0.12)",
      color: COLORS.info || COLORS.primary,
      label: "ADMIN",
    };
  }

  if (r === "TREASURER") {
    return {
      bg: "rgba(245,158,11,0.12)",
      color: COLORS.warning,
      label: "TREASURER",
    };
  }

  if (r === "SECRETARY") {
    return {
      bg: "rgba(37,99,235,0.12)",
      color: COLORS.primary,
      label: "SECRETARY",
    };
  }

  return {
    bg: "rgba(46,125,50,0.12)",
    color: COLORS.success,
    label: "MEMBER",
  };
}

function hasUsefulUserIdentity(user: any) {
  if (!user || typeof user !== "object") return false;
  return user.id != null || !!user.phone || !!user.username || !!user.email;
}

function StatusPill({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
    </View>
  );
}

function SavingsCard({ row }: { row: MyGroupSavingsRow }) {
  const role = roleTone(row.my_role);
  const showFund = row.fund?.balance != null;

  return (
    <Card style={styles.itemCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="wallet-outline" size={18} color={COLORS.white} />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {row.group.name}
          </Text>
          <Text style={styles.cardSub}>{groupTypeLabel(row)}</Text>
        </View>

        <StatusPill label={role.label} bg={role.bg} color={role.color} />
      </View>

      <View style={styles.infoBox}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>My Total</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.total_contributed)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Reserved</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.reserved_share)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Available</Text>
          <Text style={styles.infoValue}>
            {formatKes(row.my_share?.available_share)}
          </Text>
        </View>

        {showFund ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Group Fund</Text>
            <Text style={styles.infoValue}>
              {formatKes(row.fund?.balance)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardFooter}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() =>
            router.push(ROUTES.dynamic.groupDetail(row.group.id) as any)
          }
          style={{ flex: 1 }}
        />
        <View style={{ width: SPACING.sm }} />
        <Button
          title="Contribute"
          onPress={() =>
            router.push(ROUTES.dynamic.groupContribute(row.group.id) as any)
          }
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

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: SavingsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
        ? { ...sessionUser }
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
      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroTitle}>My Group Savings</Text>
            <Text style={styles.heroSubtitle}>
              View your contribution share across the groups you belong to.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="wallet-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Button
            title="My Groups"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsMemberships as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Browse Groups"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={COLORS.danger}
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Savings by Group">
        {rows.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No group savings yet"
            subtitle="Once you join groups and contribute, your savings will appear here."
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
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
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

  heroActionsRow: {
    flexDirection: "row",
    marginTop: SPACING.lg,
    alignItems: "center",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(220,53,69,0.08)",
    borderWidth: 1,
    borderColor: "rgba(220,53,69,0.18)",
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.danger,
    fontFamily: FONT.regular,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.card || "#14202f",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 8,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.text,
  },

  cardSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  infoBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },

  infoRow: {
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.text,
  },

  cardFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },
});