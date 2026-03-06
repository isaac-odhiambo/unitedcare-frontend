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
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";

import { getErrorMessage } from "@/services/api";
import { Group, listGroups } from "@/services/groups";
import {
  canJoinGroup,
  getMe,
  isAdminUser,
  isKycComplete,
  MeResponse,
} from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type GroupsUser = Partial<MeResponse> & Partial<SessionUser>;

function GroupCard({ group }: { group: Group }) {
  return (
    <Card style={styles.groupCard}>
      <View style={styles.groupTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.groupTitle}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            Created {group.created_at ?? "—"}
          </Text>
        </View>

        <Ionicons name="people-outline" size={18} color={COLORS.primary} />
      </View>

      <View style={styles.actionsRow}>
        <Text
          style={styles.link}
          onPress={() =>
            router.push(ROUTES.dynamic.groupDetail(group.id) as any)
          }
        >
          View details
        </Text>

        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </View>
    </Card>
  );
}

export default function GroupsIndexScreen() {
  const [user, setUser] = useState<GroupsUser | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);
  const isAdmin = isAdminUser(user);

  const goToKyc = useCallback(() => {
    router.push(ROUTES.tabs.profileKyc);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, groupsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listGroups(),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      const mergedUser: GroupsUser | null =
        sessionUser || meUser
          ? { ...(sessionUser ?? {}), ...(meUser ?? {}) }
          : null;

      setUser(mergedUser);

      setGroups(
        groupsRes.status === "fulfilled" && Array.isArray(groupsRes.value)
          ? groupsRes.value
          : []
      );

      if (groupsRes.status === "rejected") {
        setError(getErrorMessage(groupsRes.reason));
      }
    } catch (e: any) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
          subtitle="Please login to access groups."
          actionLabel="Go to Login"
          onAction={() => router.replace(ROUTES.auth.login)}
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Groups</Text>
          <Text style={styles.subtitle}>
            Savings groups and shared lending
          </Text>
        </View>

        <Ionicons name="people-outline" size={22} color={COLORS.primary} />
      </View>

      {error ? (
        <Card style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={18} color={COLORS.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {/* KYC Notice */}
      {!kycComplete && (
        <Section title="KYC Required">
          <Card style={styles.noticeCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={COLORS.warning}
            />
            <Text style={styles.noticeText}>
              You can browse groups, but joining a group requires completed KYC.
            </Text>

            <Button
              title="Complete KYC"
              variant="secondary"
              onPress={goToKyc}
            />
          </Card>
        </Section>
      )}

      {/* Quick Actions */}
      <Section title="Quick Actions">
        <View style={styles.actionsGrid}>
          <Card
            onPress={() =>
              joinAllowed
                ? router.push(ROUTES.tabs.groupsAddMembership)
                : goToKyc()
            }
            style={styles.actionCard}
          >
            <Ionicons name="person-add-outline" size={22} color={COLORS.white} />
            <Text style={styles.actionTitle}>
              {joinAllowed ? "Join Group" : "Complete KYC"}
            </Text>
          </Card>

          <Card
            onPress={() => router.push(ROUTES.tabs.groupsMemberships)}
            style={styles.actionCard}
          >
            <Ionicons name="people-outline" size={22} color={COLORS.white} />
            <Text style={styles.actionTitle}>My Memberships</Text>
          </Card>
        </View>
      </Section>

      {/* Groups List */}
      <Section title="Available Groups">
        {groups.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No groups found"
            subtitle="Groups created in the system will appear here."
          />
        ) : (
          groups.map((g) => <GroupCard key={g.id} group={g} />)
        )}
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  subtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
  },

  noticeCard: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },

  noticeText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  actionsGrid: {
    flexDirection: "row",
    gap: SPACING.md,
  },

  actionCard: {
    flex: 1,
    padding: SPACING.md,
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
  },

  actionTitle: {
    color: COLORS.white,
    fontFamily: FONT.bold,
  },

  groupCard: {
    marginBottom: SPACING.md,
  },

  groupTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  groupTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
  },

  groupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  link: {
    color: COLORS.primary,
    fontFamily: FONT.bold,
  },
});