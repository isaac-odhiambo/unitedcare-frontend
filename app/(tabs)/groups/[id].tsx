// app/(tabs)/groups/[id].tsx

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";

import {
  createGroupJoinRequest,
  getApiErrorMessage,
  getGroup,
  getMyGroupContributions,
  Group,
  GroupContribution,
} from "@/services/groups";

import { canJoinGroup, getMe, isKycComplete } from "@/services/profile";
import { getSessionUser } from "@/services/session";

/* ----------------------------------------------- */

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  return `KES ${n.toLocaleString("en-KE")}`;
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

function getJoinPolicyLabel(value?: string | null) {
  const v = String(value || "").toUpperCase().trim();
  if (!v) return "—";
  return v.replaceAll("_", " ");
}

/* ----------------------------------------------- */

export default function GroupDetailScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params.id);

  const [group, setGroup] = useState<Group | null>(null);
  const [rows, setRows] = useState<GroupContribution[]>([]);
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);

  const [user, setUser] = useState<any>(null);

  /* ----------------------------------------------- */
  /* LOAD DATA */
  /* ----------------------------------------------- */

  const load = useCallback(async () => {
    try {
      const [session, me, groupRes, contributions] = await Promise.all([
        getSessionUser(),
        getMe(),
        getGroup(groupId),
        getMyGroupContributions(groupId),
      ]);

      setUser({ ...session, ...me });
      setGroup(groupRes);
      setRows(Array.isArray(contributions) ? contributions : []);

      // simple membership check (based on contributions presence)
      setJoined(Array.isArray(contributions) && contributions.length > 0);
    } catch (e: any) {
      Alert.alert("Group", getApiErrorMessage(e));
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const run = async () => {
        if (!mounted) return;
        setLoading(true);
        await load();
        if (mounted) setLoading(false);
      };

      run();
      return () => {
        mounted = false;
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /* ----------------------------------------------- */
  /* JOIN LOGIC */
  /* ----------------------------------------------- */

  const kycComplete = isKycComplete(user);
  const joinAllowed = canJoinGroup(user);

  const joinPolicy = String(group?.join_policy || "").toUpperCase();

  const isClosed = joinPolicy === "CLOSED";
  const isOpen = joinPolicy === "OPEN";
  const isApproval = joinPolicy === "APPROVAL";

  const joinLabel = isOpen ? "Join Group" : "Request to Join";

  const handleJoin = () => {
    if (!group) return;

    if (!kycComplete) {
      Alert.alert("Complete KYC", "You must complete KYC first.");
      return;
    }

    if (isClosed) {
      Alert.alert("Group Closed", "This group is not accepting members.");
      return;
    }

    Alert.alert(
      "Join Group",
      `Proceed to ${isOpen ? "join" : "request to join"} ${group.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            try {
              setJoining(true);

              const res = await createGroupJoinRequest({
                group_id: groupId,
              });

              Alert.alert("Success", res?.message || "Done");
              await load();
            } catch (e: any) {
              Alert.alert("Error", getApiErrorMessage(e));
            } finally {
              setJoining(false);
            }
          },
        },
      ]
    );
  };

  /* ----------------------------------------------- */
  /* UI STATES */
  /* ----------------------------------------------- */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  /* ----------------------------------------------- */
  /* UI */
  /* ----------------------------------------------- */

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HERO */}
      <View style={styles.hero}>
        <Text style={styles.title}>{group?.name}</Text>
        <Text style={styles.sub}>
          {group?.group_type_display} • {getJoinPolicyLabel(group?.join_policy)}
        </Text>
      </View>

      {/* JOIN BUTTON */}
      {!joined && !pending && (
        <View style={styles.section}>
          <Button
            title={joinLabel}
            onPress={handleJoin}
            disabled={!joinAllowed || isClosed || joining}
          />
        </View>
      )}

      {pending && (
        <Card style={styles.infoCard}>
          <Text style={styles.infoText}>Join request pending</Text>
        </Card>
      )}

      {/* CONTRIBUTION */}
      {joined && (
        <View style={styles.section}>
          <Button
            title="Contribute"
            onPress={() =>
              router.push(ROUTES.dynamic.groupContribute(groupId) as any)
            }
            leftIcon={
              <Ionicons name="cash-outline" size={18} color="white" />
            }
          />
        </View>
      )}

      {/* ACTIVITY */}
      <Section title="Activity">
        {rows.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No activity"
            subtitle="Contributions will appear here"
          />
        ) : (
          rows.map((r, i) => (
            <Card key={i} style={styles.row}>
              <Text style={styles.amount}>{formatKes(r.amount)}</Text>
              <Text style={styles.meta}>{fmtDate(r.created_at)}</Text>
            </Card>
          ))
        )}
      </Section>

      {/* ABOUT */}
      {!joined && (
        <Section title="About">
          <Card style={styles.about}>
            <Text style={styles.meta}>
              Members: {group?.member_count ?? "—"}
            </Text>

            {group?.requires_contributions && (
              <Text style={styles.meta}>
                Contribution: {formatKes(group?.contribution_amount)}
              </Text>
            )}
          </Card>
        </Section>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

/* ----------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  hero: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },

  title: {
    color: COLORS.white,
    fontSize: 18,
    fontFamily: FONT.bold,
  },

  sub: {
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
    fontSize: 12,
  },

  section: {
    marginBottom: SPACING.lg,
  },

  infoCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  infoText: {
    fontSize: 12,
    color: COLORS.text,
  },

  row: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },

  amount: {
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  meta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  about: {
    padding: SPACING.md,
  },
});