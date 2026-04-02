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
  TouchableOpacity,
  View,
} from "react-native";

import EmptyState from "@/components/ui/EmptyState";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
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
  icon: keyof typeof Ionicons.glyphMap;
} {
  const value = String(status || "").toUpperCase().trim();

  if (value === "APPROVED") {
    return {
      bg: "rgba(140,240,199,0.18)",
      color: "#FFFFFF",
      label: "APPROVED",
      icon: "checkmark-circle-outline",
    };
  }

  if (value === "REJECTED") {
    return {
      bg: "rgba(220,53,69,0.18)",
      color: "#FFFFFF",
      label: "NOT ACCEPTED",
      icon: "close-circle-outline",
    };
  }

  if (value === "CANCELLED") {
    return {
      bg: "rgba(255,255,255,0.12)",
      color: "#FFFFFF",
      label: "CANCELLED",
      icon: "remove-circle-outline",
    };
  }

  return {
    bg: "rgba(255,204,102,0.18)",
    color: "#FFFFFF",
    label: "UNDER REVIEW",
    icon: "time-outline",
  };
}

function StatusPill({ status }: { status?: string }) {
  const tone = statusTone(status);

  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Ionicons name={tone.icon} size={12} color={tone.color} />
      <Text style={[styles.statusPillText, { color: tone.color }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function SoftButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.softButton,
        secondary ? styles.softButtonSecondary : styles.softButtonPrimary,
        disabled ? styles.softButtonDisabled : null,
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

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
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
  const tone = statusTone(item.status);
  const upperStatus = String(item.status || "").toUpperCase().trim();

  return (
    <View style={styles.itemCard}>
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.cardTopRow}>
        <View style={styles.groupIconWrap}>
          <Ionicons
            name="git-pull-request-outline"
            size={18}
            color="#0A6E8A"
          />
        </View>

        <View style={styles.cardTextWrap}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.group_name || `Space #${item.group_id ?? "—"}`}
          </Text>
          <Text style={styles.cardSub}>Sent {fmtDate(item.created_at)}</Text>
        </View>

        <StatusPill status={item.status} />
      </View>

      {item.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Your note</Text>
          <Text style={styles.noteText} numberOfLines={3}>
            {item.note}
          </Text>
        </View>
      ) : null}

      {item.reviewed_at ? (
        <View style={styles.reviewRow}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color="rgba(255,255,255,0.78)"
          />
          <Text style={styles.reviewedText}>
            Reviewed {fmtDate(item.reviewed_at)}
          </Text>
        </View>
      ) : null}

      <View style={styles.infoStrip}>
        <View style={[styles.infoDot, { backgroundColor: tone.color }]} />
        <Text style={styles.infoStripText}>
          {isPending
            ? "This request is still under review."
            : upperStatus === "APPROVED"
            ? "You are now part of this space."
            : upperStatus === "REJECTED"
            ? "This request was not accepted."
            : "This request is no longer active."}
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <SoftButton
          title="Open space"
          secondary
          onPress={() => {
            if (groupId > 0) {
              router.push(ROUTES.dynamic.groupDetail(groupId) as any);
            }
          }}
        />

        {isPending ? (
          <>
            <View style={{ width: SPACING.sm }} />
            <SoftButton
              title={busy ? "Please wait..." : "Cancel request"}
              onPress={() => onCancel(item)}
              disabled={busy}
            />
          </>
        ) : null}
      </View>
    </View>
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

  const stats = useMemo(() => {
    const approved = rows.filter(
      (r) => String(r.status || "").toUpperCase().trim() === "APPROVED"
    ).length;

    return {
      pending: grouped.pending.length,
      approved,
      history: grouped.history.length,
    };
  }, [grouped, rows]);

  const handleCancel = useCallback(
    async (item: GroupJoinRequest) => {
      Alert.alert(
        "Cancel request",
        `Cancel your request for ${item.group_name || `Space #${item.group_id}`}?`,
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Cancel request",
            style: "destructive",
            onPress: async () => {
              try {
                setSubmittingId(item.id);
                await cancelGroupJoinRequest(item.id);
                await load();
              } catch (e: any) {
                Alert.alert("Community space", getApiErrorMessage(e));
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
        <ActivityIndicator color="#8CF0C7" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.page}>
        <EmptyState
          title="Not signed in"
          subtitle="Please login to view your community requests."
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
            <Text style={styles.heroTag}>COMMUNITY REQUESTS</Text>
            <Text style={styles.heroTitle}>Community requests</Text>
            <Text style={styles.heroSubtitle}>
              Follow the spaces you have asked to join and see how each request
              is moving.
            </Text>
          </View>

          <View style={styles.heroIconWrap}>
            <Ionicons
              name="git-pull-request-outline"
              size={22}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Under review</Text>
            <Text style={styles.heroStatValue}>{stats.pending}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>Approved</Text>
            <Text style={styles.heroStatValue}>{stats.approved}</Text>
          </View>

          <View style={styles.heroStatPill}>
            <Text style={styles.heroStatLabel}>History</Text>
            <Text style={styles.heroStatValue}>{stats.history}</Text>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <SectionTitle title="Waiting for review" />
      {grouped.pending.length === 0 ? (
        <View style={styles.emptyHolder}>
          <EmptyState
            icon="git-pull-request-outline"
            title="No waiting requests"
            subtitle="New community join requests will appear here."
          />
        </View>
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

      {grouped.history.length > 0 ? (
        <>
          <SectionTitle title="Past updates" />
          {grouped.history.map((item) => (
            <JoinRequestCard
              key={item.id}
              item={item}
              busy={false}
              onCancel={handleCancel}
            />
          ))}
        </>
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
    borderRadius: 28,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
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
    color: "#FFFFFF",
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
    borderRadius: 18,
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
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  errorCard: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: "rgba(220,53,69,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
  },

  errorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },

  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#FFFFFF",
    fontFamily: FONT.regular,
  },

  sectionTitle: {
    fontSize: 18,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    marginBottom: 12,
    marginTop: 4,
  },

  emptyHolder: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: SPACING.md,
  },

  itemCard: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
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
    gap: SPACING.sm,
  },

  groupIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 8,
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

  noteBox: {
    marginTop: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: SPACING.sm,
  },

  noteLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    color: "#FFFFFF",
    marginBottom: 4,
  },

  noteText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
  },

  reviewRow: {
    marginTop: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  reviewedText: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
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
    flexDirection: "row",
    alignItems: "center",
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

  softButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  softButtonPrimary: {
    backgroundColor: "#FFFFFF",
  },

  softButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  softButtonDisabled: {
    opacity: 0.65,
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
});