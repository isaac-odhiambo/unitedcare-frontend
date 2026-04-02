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
      bg: "rgba(236,251,255,0.18)",
      color: "#FFFFFF",
      label: "LEAD",
      icon: "shield-checkmark-outline" as const,
    };
  }

  if (value === "TREASURER") {
    return {
      bg: "rgba(255,204,102,0.18)",
      color: "#FFFFFF",
      label: "TREASURY",
      icon: "wallet-outline" as const,
    };
  }

  if (value === "SECRETARY") {
    return {
      bg: "rgba(12,192,183,0.18)",
      color: "#FFFFFF",
      label: "SECRETARY",
      icon: "document-text-outline" as const,
    };
  }

  return {
    bg: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    label: "MEMBER",
    icon: "person-outline" as const,
  };
}

function statusTone(active: boolean) {
  return active
    ? {
        bg: "rgba(140,240,199,0.18)",
        color: "#FFFFFF",
        label: "ACTIVE",
        icon: "checkmark-circle-outline" as const,
      }
    : {
        bg: "rgba(255,255,255,0.12)",
        color: "#FFFFFF",
        label: "INACTIVE",
        icon: "pause-circle-outline" as const,
      };
}

function StatusPill({
  label,
  bg,
  color,
  icon,
}: {
  label: string;
  bg: string;
  color: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
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
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons name="people-outline" size={18} color="#0A6E8A" />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={styles.cardSub}>
            {membership.joined_at
              ? `Joined ${fmtDate(membership.joined_at)}`
              : "Community membership"}
          </Text>
        </View>

        <View style={styles.arrowWrap}>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#FFFFFF"
          />
        </View>
      </View>

      <View style={styles.badgesRow}>
        <StatusPill
          label={role.label}
          bg={role.bg}
          color={role.color}
          icon={role.icon}
        />
        <StatusPill
          label={status.label}
          bg={status.bg}
          color={status.color}
          icon={status.icon}
        />
      </View>

      <View style={styles.infoStrip}>
        <View
          style={[
            styles.infoDot,
            { backgroundColor: membership.is_active ? "#DFFFE8" : "rgba(255,255,255,0.70)" },
          ]}
        />
        <Text style={styles.infoStripText}>
          {membership.is_active
            ? "You are part of this community space and can continue from here."
            : "This membership is currently not active."}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Button
          title="Open space"
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

  const stats = useMemo(() => {
    const leadershipCount = memberships.filter((m) => {
      const role = String(m.role || "").toUpperCase().trim();
      return ["ADMIN", "TREASURER", "SECRETARY"].includes(role);
    }).length;

    return {
      total: memberships.length,
      active: grouped.active.length,
      leadership: leadershipCount,
    };
  }, [memberships, grouped]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#8CF0C7" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to view your community spaces."
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
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.heroTag}>YOUR SPACES</Text>
            <Text style={styles.heroTitle}>Your spaces</Text>
            <Text style={styles.heroSubtitle}>
              Open the community spaces you belong to and continue from there.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>All spaces</Text>
            <Text style={styles.heroStatValue}>{stats.total}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Active</Text>
            <Text style={styles.heroStatValue}>{stats.active}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Leadership</Text>
            <Text style={styles.heroStatValue}>{stats.leadership}</Text>
          </View>
        </View>

        <View style={styles.heroActionsRow}>
          <Button
            title="Explore spaces"
            onPress={() => router.push(ROUTES.tabs.groupsAvailable as any)}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Requests"
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
            color="#FFFFFF"
          />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <Section title="Active spaces">
        {grouped.active.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No active spaces"
            subtitle="Explore available spaces and join one that fits your community."
            actionLabel="Explore spaces"
            onAction={() => router.push(ROUTES.tabs.groupsAvailable as any)}
          />
        ) : (
          grouped.active.map((membership) => (
            <MembershipCard key={membership.id} membership={membership} />
          ))
        )}
      </Section>

      {grouped.inactive.length > 0 ? (
        <Section title="Other spaces">
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
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 28,
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
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
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
    alignItems: "center",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    fontFamily: FONT.regular,
  },

  membershipCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: RADIUS.xl || RADIUS.lg,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    ...SHADOW.card,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -22,
    left: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.08)",
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
    backgroundColor: "rgba(236, 251, 255, 0.88)",
    marginRight: 12,
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  cardSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
  },

  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  statusPillText: {
    fontSize: 11,
    fontFamily: FONT.bold,
  },

  infoStrip: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 2,
  },

  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  infoStripText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
  },

  cardFooter: {
    marginTop: SPACING.md,
  },
});