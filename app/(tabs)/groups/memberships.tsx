// app/(tabs)/groups/memberships.tsx

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
  getGroupIdFromMembership,
  getGroupNameFromMembership,
  GroupMembership,
  listGroupMemberships,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MembershipsUser = Partial<MeResponse> & Partial<SessionUser>;

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function hasUsefulUserIdentity(user: any) {
  if (!user || typeof user !== "object") return false;
  return user.id != null || !!user.phone || !!user.username || !!user.email;
}

function roleTone(role?: string) {
  const value = String(role || "").toUpperCase().trim();

  if (value === "ADMIN") {
    return {
      bg: "rgba(59,130,246,0.12)",
      color: COLORS.info || COLORS.primary,
      label: "ADMIN",
    };
  }

  if (value === "TREASURER") {
    return {
      bg: "rgba(245,158,11,0.12)",
      color: COLORS.warning,
      label: "TREASURER",
    };
  }

  if (value === "SECRETARY") {
    return {
      bg: "rgba(37,99,235,0.12)",
      color: COLORS.primary,
      label: "SECRETARY",
    };
  }

  return {
    bg: "rgba(37,99,235,0.12)",
    color: COLORS.primary,
    label: "MEMBER",
  };
}

function statusTone(active: boolean) {
  return active
    ? {
        bg: "rgba(46,125,50,0.12)",
        color: COLORS.success,
        label: "ACTIVE",
      }
    : {
        bg: "rgba(107,114,128,0.12)",
        color: COLORS.gray,
        label: "INACTIVE",
      };
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

function MembershipCard({
  membership,
}: {
  membership: GroupMembership;
}) {
  const groupName = getGroupNameFromMembership(membership);
  const groupId = getGroupIdFromMembership(membership);

  const role = roleTone(String(membership.role));
  const status = statusTone(!!membership.is_active);

  return (
    <Card style={styles.membershipCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={18} color={COLORS.white} />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={styles.cardSub}>
            {membership.joined_at
              ? `Joined ${fmtDate(membership.joined_at)}`
              : "Membership record"}
          </Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <StatusPill label={role.label} bg={role.bg} color={role.color} />
        <StatusPill label={status.label} bg={status.bg} color={status.color} />
      </View>

      <View style={styles.cardFooter}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => {
            if (groupId != null) {
              router.push(ROUTES.dynamic.groupDetail(groupId) as any);
            }
          }}
        />
      </View>
    </Card>
  );
}

export default function GroupMembershipsScreen() {
  const [user, setUser] = useState<MembershipsUser | null>(null);
  const [memberships, setMemberships] = useState<GroupMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, membershipsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listGroupMemberships(),
      ]);

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: MembershipsUser | null = meUser
        ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
        : sessionUser
        ? { ...sessionUser }
        : null;

      setUser(mergedUser);

      setMemberships(
        membershipsRes.status === "fulfilled" && Array.isArray(membershipsRes.value)
          ? membershipsRes.value
          : []
      );

      if (membershipsRes.status === "rejected") {
        setError(getApiErrorMessage(membershipsRes.reason));
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

  const grouped = useMemo(() => {
    const active = memberships.filter((m) => !!m.is_active);
    const inactive = memberships.filter((m) => !m.is_active);
    return { active, inactive };
  }, [memberships]);

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
          subtitle="Please login to view your groups."
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
            <Text style={styles.heroTitle}>My Groups</Text>
            <Text style={styles.heroSubtitle}>
              Open the groups you belong to and continue from there.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Button
            title="Browse Groups"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Join Requests"
            variant="secondary"
            onPress={() => router.push(ROUTES.tabs.groupsJoinRequests as any)}
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

      <Section title="Active Groups">
        {grouped.active.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No active groups"
            subtitle="Browse available groups to join one."
            actionLabel="Browse Groups"
            onAction={() => router.push(ROUTES.tabs.groupsAvailable as any)}
          />
        ) : (
          grouped.active.map((membership) => (
            <MembershipCard key={membership.id} membership={membership} />
          ))
        )}
      </Section>

      {grouped.inactive.length > 0 ? (
        <Section title="Inactive Groups">
          {grouped.inactive.map((membership) => (
            <MembershipCard key={membership.id} membership={membership} />
          ))}
        </Section>
      ) : null}

      <View style={{ height: 28 }} />
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
    paddingBottom: 28,
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

  membershipCard: {
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
  },

  groupIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginRight: 12,
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 10,
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

  badgesRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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

  cardFooter: {
    marginTop: SPACING.md,
  },
});