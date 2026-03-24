// app/(tabs)/groups/join-requests.tsx

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
import {
  cancelGroupJoinRequest,
  getApiErrorMessage,
  GroupJoinRequest,
  listMyGroupJoinRequests,
} from "@/services/groups";
import { getMe, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type JoinRequestsUser = Partial<MeResponse> & Partial<SessionUser>;

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

function statusTone(status?: string): {
  bg: string;
  color: string;
  label: string;
} {
  const value = String(status || "").toUpperCase().trim();

  if (value === "APPROVED") {
    return {
      bg: "rgba(46,125,50,0.12)",
      color: COLORS.success,
      label: "APPROVED",
    };
  }

  if (value === "REJECTED") {
    return {
      bg: "rgba(220,53,69,0.12)",
      color: COLORS.danger,
      label: "REJECTED",
    };
  }

  if (value === "CANCELLED") {
    return {
      bg: "rgba(107,114,128,0.12)",
      color: COLORS.gray,
      label: "CANCELLED",
    };
  }

  return {
    bg: "rgba(245,158,11,0.12)",
    color: COLORS.warning,
    label: "PENDING",
  };
}

function StatusPill({ status }: { status?: string }) {
  const tone = statusTone(status);

  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.color }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function JoinRequestCard({
  item,
  busy,
  onCancel,
}: {
  item: GroupJoinRequest;
  busy: boolean;
  onCancel: (item: GroupJoinRequest) => void;
}) {
  const isPending = String(item.status || "").toUpperCase().trim() === "PENDING";
  const groupId = Number(item.group_id ?? 0);

  return (
    <Card style={styles.itemCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons
            name="git-pull-request-outline"
            size={18}
            color={COLORS.white}
          />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.group_name || `Group #${item.group_id ?? "—"}`}
          </Text>
          <Text style={styles.cardSub}>
            Sent {fmtDate(item.created_at)}
          </Text>
        </View>

        <StatusPill status={item.status} />
      </View>

      {item.note ? (
        <Text style={styles.noteText} numberOfLines={2}>
          {item.note}
        </Text>
      ) : null}

      {item.reviewed_at ? (
        <Text style={styles.reviewedText}>
          Reviewed {fmtDate(item.reviewed_at)}
        </Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Button
          title="Open Group"
          variant="secondary"
          onPress={() => {
            if (groupId > 0) {
              router.push(ROUTES.dynamic.groupDetail(groupId) as any);
            }
          }}
          style={{ flex: 1 }}
        />

        {isPending ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <Button
              title={busy ? "Please wait..." : "Cancel"}
              onPress={() => onCancel(item)}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </>
        ) : null}
      </View>
    </Card>
  );
}

export default function GroupJoinRequestsScreen() {
  const [user, setUser] = useState<JoinRequestsUser | null>(null);
  const [rows, setRows] = useState<GroupJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");

      const [sessionRes, meRes, rowsRes] = await Promise.allSettled([
        getSessionUser(),
        getMe(),
        listMyGroupJoinRequests(),
      ]);

      const sessionUserRaw =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUserRaw = meRes.status === "fulfilled" ? meRes.value : null;

      const sessionUser = hasUsefulUserIdentity(sessionUserRaw)
        ? sessionUserRaw
        : null;
      const meUser = hasUsefulUserIdentity(meUserRaw) ? meUserRaw : null;

      const mergedUser: JoinRequestsUser | null = meUser
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

  const grouped = useMemo(() => {
    const pending = rows.filter(
      (r) => String(r.status || "").toUpperCase().trim() === "PENDING"
    );
    const history = rows.filter(
      (r) => String(r.status || "").toUpperCase().trim() !== "PENDING"
    );
    return { pending, history };
  }, [rows]);

  const handleCancel = useCallback(
    async (item: GroupJoinRequest) => {
      Alert.alert(
        "Cancel Request",
        `Cancel your request for ${item.group_name || `Group #${item.group_id}`}?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              try {
                setSubmittingId(item.id);
                await cancelGroupJoinRequest(item.id);
                await load();
              } catch (e: any) {
                Alert.alert("Join Request", getApiErrorMessage(e));
              } finally {
                setSubmittingId(null);
              }
            },
          },
        ]
      );
    },
    [load]
  );

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
          subtitle="Please login to view your group join requests."
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
            <Text style={styles.heroTitle}>Join Requests</Text>
            <Text style={styles.heroSubtitle}>
              Track your current and past group requests.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="git-pull-request-outline"
              size={22}
              color={COLORS.white}
            />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Pending</Text>
            <Text style={styles.heroStatValue}>{grouped.pending.length}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>History</Text>
            <Text style={styles.heroStatValue}>{grouped.history.length}</Text>
          </View>
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

      <Section title="Pending">
        {grouped.pending.length === 0 ? (
          <EmptyState
            icon="git-pull-request-outline"
            title="No pending requests"
            subtitle="New join requests will appear here."
          />
        ) : (
          grouped.pending.map((item) => (
            <View
              key={item.id}
              style={{ opacity: submittingId === item.id ? 0.7 : 1 }}
            >
              <JoinRequestCard
                item={item}
                busy={submittingId === item.id}
                onCancel={handleCancel}
              />
            </View>
          ))
        )}
      </Section>

      {grouped.history.length > 0 ? (
        <Section title="History">
          {grouped.history.map((item) => (
            <JoinRequestCard
              key={item.id}
              item={item}
              busy={false}
              onCancel={handleCancel}
            />
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

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
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

  noteText: {
    marginTop: SPACING.sm,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  reviewedText: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  cardFooter: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
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
});