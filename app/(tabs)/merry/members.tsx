// app/(tabs)/merry/members.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ ADDED

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMerryDetail,
  getMerryMembers,
  MerryDetail,
  MerryMemberRow,
} from "@/services/merry";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryMembersUser = Partial<MeResponse> & Partial<SessionUser>;

function MemberCard({ member }: { member: MerryMemberRow }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>
            {member.username || `User #${member.user_id}`}
          </Text>
          <Text style={styles.sub}>
            {member.phone || "No phone"}
            {member.joined_at ? ` • Joined ${member.joined_at}` : ""}
          </Text>
        </View>

        <View style={styles.seatBadge}>
          <Ionicons name="person-outline" size={14} color={COLORS.primary} />
          <Text style={styles.seatBadgeText}>
            {member.seats_count} {Number(member.seats_count) === 1 ? "seat" : "seats"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

export default function MerryMembersScreen() {
  const params = useLocalSearchParams<{ merryId?: string }>();
  const merryId = Number(params.merryId ?? 0);

  const [user, setUser] = useState<MerryMembersUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [members, setMembers] = useState<MerryMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = isAdminUser(user);

  const load = useCallback(async () => {
    if (!merryId || !Number.isFinite(merryId)) {
      setError("Missing or invalid merry ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [sessionRes, meRes, merryRes, membersRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        getMerryDetail(merryId),
        getMerryMembers(merryId),
      ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser =
        meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      if (merryRes.status === "fulfilled") {
        setMerry(merryRes.value);
      } else {
        setMerry(null);
        setError(getApiErrorMessage(merryRes.reason) || getErrorMessage(merryRes.reason));
      }

      if (membersRes.status === "fulfilled") {
        setMembers(Array.isArray(membersRes.value) ? membersRes.value : []);
      } else {
        setMembers([]);
        setError(getApiErrorMessage(membersRes.reason) || getErrorMessage(membersRes.reason));
      }
    } catch (e: any) {
      setMembers([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const totals = useMemo(() => {
    const totalSeats = members.reduce(
      (sum, m) => sum + (Number(m.seats_count || 0) || 0),
      0
    );

    return {
      members: members.length,
      seats: totalSeats,
    };
  }, [members]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!merryId || !Number.isFinite(merryId)) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <EmptyState
            title="Invalid merry"
            subtitle="No merry was selected."
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to view merry members."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!merry && error) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.container}>
          <EmptyState
            title="Unable to load merry"
            subtitle={error}
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* EVERYTHING ELSE UNCHANGED */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hTitle}>Members</Text>
            <Text style={styles.hSub}>
              {merry?.name || `Merry #${merryId}`} • {isAdmin ? "Admin" : "Member"} view
            </Text>
          </View>

          <Button
            variant="ghost"
            title="Back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons
                name="arrow-back-outline"
                size={16}
                color={COLORS.primary}
              />
            }
          />
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

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Members</Text>
            <Text style={styles.summaryValue}>{totals.members}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Seats</Text>
            <Text style={styles.summaryValue}>{totals.seats}</Text>
          </View>
        </View>

        <Section title="Member List">
          {members.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No members found"
              subtitle="Approved merry members will appear here."
            />
          ) : (
            members.map((member) => (
              <MemberCard key={member.member_id} member={member} />
            ))
          )}
        </Section>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
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
    fontSize: 12,
    color: COLORS.gray,
    fontFamily: FONT.regular,
  },

  summaryValue: {
    marginTop: 6,
    fontSize: 16,
    fontFamily: FONT.bold,
    color: COLORS.dark,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  seatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
  },

  seatBadgeText: {
    fontSize: 11,
    fontFamily: FONT.medium,
    color: COLORS.primary,
  },
});