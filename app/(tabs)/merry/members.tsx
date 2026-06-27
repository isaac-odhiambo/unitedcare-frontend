// app/(tabs)/merry/members.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { ROUTES } from "@/constants/routes";
import { FONT, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import {
  getApiErrorMessage,
  getMerryDetail,
  getMerryMembers,
  getMerrySeats,
  getNextPayoutTurn,
  MerryDetail,
  MerryMemberRow,
  MerrySeatRow,
  NextPayoutTurnResponse,
} from "@/services/merry";
import { getMe, isAdminUser, MeResponse } from "@/services/profile";
import { getSessionUser, SessionUser } from "@/services/session";

type MerryMembersUser = Partial<MeResponse> & Partial<SessionUser>;

const PAGE_BG = "#062C49";
const BRAND = "#0C6A80";
const WHITE = "#FFFFFF";
const SOFT = "rgba(255,255,255,0.72)";
const CARD_BG = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(255,255,255,0.10)";
const SUCCESS_BG = "rgba(34,197,94,0.16)";
const SUCCESS_TEXT = "#DCFCE7";
const ACCENT_BG = "rgba(12,106,128,0.20)";
const ACCENT_TEXT = "#D9F3F9";
const WARNING_BG = "rgba(245,158,11,0.18)";
const WARNING_TEXT = "#FEF3C7";
const ERROR_BG = "rgba(239,68,68,0.18)";
const ERROR_TEXT = "#FECACA";

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Card style={styles.summaryTile} variant="default">
      <View style={styles.summaryIconWrap}>
        <Ionicons name={icon} size={16} color={BRAND} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
    </Card>
  );
}

function InfoPill({
  text,
  success = false,
}: {
  text: string;
  success?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoPill,
        { backgroundColor: success ? SUCCESS_BG : WARNING_BG },
      ]}
    >
      <Text
        style={[
          styles.infoPillText,
          { color: success ? SUCCESS_TEXT : WARNING_TEXT },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

type MemberSeatView = {
  seat_id: number;
  seat_no: number;
  payout_position: number | null;
};

type MemberWithTurns = MerryMemberRow & {
  seats: MemberSeatView[];
  turnLabel: string;
  isCurrentTurn: boolean;
  isNextTurn: boolean;
};

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function MemberCard({ member }: { member: MemberWithTurns }) {
  const seatCount = member.seats.length;
  const seatNos = member.seats.map((s) => s.seat_no).join(", ");
  const payoutPositions = member.seats
    .map((s) => s.payout_position)
    .filter((v) => v != null)
    .join(", ");

  const isHighlighted = member.isCurrentTurn || member.isNextTurn;

  const badgeLabel = member.isCurrentTurn
    ? "Current"
    : member.isNextTurn
      ? "Next"
      : `${seatCount} seat${seatCount === 1 ? "" : "s"}`;

  return (
    <Card style={styles.memberCard} variant="default">
      <View style={styles.memberTop}>
        <View style={styles.memberTitleWrap}>
          <View style={styles.memberIconWrap}>
            <Ionicons
              name={isHighlighted ? "star-outline" : "person-outline"}
              size={17}
              color={BRAND}
            />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.memberName} numberOfLines={1}>
              {member.username || `User #${member.user_id}`}
            </Text>
            <Text style={styles.memberSub} numberOfLines={2}>
              {member.phone || "No phone"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.badge,
            isHighlighted ? styles.badgeNext : styles.badgeNeutral,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isHighlighted ? styles.badgeTextNext : styles.badgeTextNeutral,
            ]}
          >
            {badgeLabel}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: SPACING.sm }}>
        <Text style={styles.rowLabel}>Seats</Text>
        <Text style={styles.rowValue}>{seatNos || "—"}</Text>
      </View>

      <View style={{ marginTop: SPACING.sm }}>
        <Text style={styles.rowLabel}>Turn</Text>
        <Text style={styles.rowValue}>
          {member.turnLabel ||
            (payoutPositions ? `Position ${payoutPositions}` : "Not set")}
        </Text>
      </View>

      {member.joined_at ? (
        <View style={{ marginTop: SPACING.sm }}>
          <Text style={styles.rowLabel}>Joined</Text>
          <Text style={styles.rowValue}>{member.joined_at}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function MerryMembersScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ merryId?: string; id?: string }>();
  const merryId = Number(params.merryId ?? params.id ?? 0);

  const [user, setUser] = useState<MerryMembersUser | null>(null);
  const [merry, setMerry] = useState<MerryDetail | null>(null);
  const [members, setMembers] = useState<MerryMemberRow[]>([]);
  const [seats, setSeats] = useState<MerrySeatRow[]>([]);
  const [nextTurn, setNextTurn] = useState<NextPayoutTurnResponse | null>(null);
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
      setError("");

      const [sessionRes, meRes, merryRes, membersRes, seatsRes, turnRes] =
        await Promise.allSettled([
          getSessionUser(),
          getMe(),
          getMerryDetail(merryId),
          getMerryMembers(merryId),
          getMerrySeats(merryId),
          getNextPayoutTurn(merryId),
        ]);

      const sessionUser =
        sessionRes.status === "fulfilled" ? sessionRes.value : null;
      const meUser = meRes.status === "fulfilled" ? meRes.value : null;

      setUser(
        sessionUser || meUser
          ? {
              ...(sessionUser ?? {}),
              ...(meUser ?? {}),
            }
          : null
      );

      setMerry(merryRes.status === "fulfilled" ? merryRes.value : null);

      setMembers(
        membersRes.status === "fulfilled" && Array.isArray(membersRes.value)
          ? membersRes.value
          : []
      );

      setSeats(
        seatsRes.status === "fulfilled" && Array.isArray(seatsRes.value)
          ? seatsRes.value
          : []
      );

      setNextTurn(turnRes.status === "fulfilled" ? turnRes.value : null);

      const errors: string[] = [];

      if (merryRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(merryRes.reason) ||
            getErrorMessage(merryRes.reason)
        );
      }

      if (membersRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(membersRes.reason) ||
            getErrorMessage(membersRes.reason)
        );
      }

      if (seatsRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(seatsRes.reason) ||
            getErrorMessage(seatsRes.reason)
        );
      }

      if (turnRes.status === "rejected") {
        errors.push(
          getApiErrorMessage(turnRes.reason) ||
            getErrorMessage(turnRes.reason)
        );
      }

      setError(errors.filter(Boolean).join(" • "));
    } catch (e: any) {
      setMerry(null);
      setMembers([]);
      setSeats([]);
      setNextTurn(null);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
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
    return {
      members: members.length,
      seats: seats.length,
    };
  }, [members, seats]);

  const membersWithTurns = useMemo<MemberWithTurns[]>(() => {
    const seatMap = new Map<number, MemberSeatView[]>();

    seats.forEach((seat) => {
      const list = seatMap.get(seat.member_id) || [];
      list.push({
        seat_id: seat.seat_id,
        seat_no: seat.seat_no,
        payout_position: seat.payout_position,
      });
      seatMap.set(seat.member_id, list);
    });

    const currentSeatNo = safeNumber((nextTurn as any)?.seat_no);
    const nextSeatNo = safeNumber((nextTurn as any)?.next_seat_no);

    const currentMemberId = safeNumber((nextTurn as any)?.member_id);
    const nextMemberId = safeNumber((nextTurn as any)?.next_member_id);

    const currentUserId = safeNumber((nextTurn as any)?.user_id);
    const nextUserId = safeNumber((nextTurn as any)?.next_user_id);

    return members.map((member) => {
      const memberSeats = (seatMap.get(member.member_id) || []).sort(
        (a, b) => a.seat_no - b.seat_no
      );

      const memberSeatNos = memberSeats
        .map((s) => safeNumber(s.seat_no))
        .filter((n): n is number => n != null);

      const memberId = safeNumber(member.member_id);
      const userId = safeNumber(member.user_id);

      const isCurrentTurn =
        !!nextTurn &&
        ((currentSeatNo != null && memberSeatNos.includes(currentSeatNo)) ||
          (currentMemberId != null && memberId === currentMemberId) ||
          (currentUserId != null && userId === currentUserId));

      const isNextTurn =
        !!nextTurn &&
        !isCurrentTurn &&
        ((nextSeatNo != null && memberSeatNos.includes(nextSeatNo)) ||
          (nextMemberId != null && memberId === nextMemberId) ||
          (nextUserId != null && userId === nextUserId));

      let turnLabel = "Not set";

      if (isCurrentTurn) {
        turnLabel = `Current turn • Seat ${currentSeatNo ?? "—"}`;
      } else if (isNextTurn) {
        turnLabel = `Next turn • Seat ${nextSeatNo ?? "—"}`;
      } else if (memberSeats.some((s) => s.payout_position != null)) {
        const positions = memberSeats
          .map((s) => s.payout_position)
          .filter((v) => v != null)
          .join(", ");

        turnLabel = positions ? `Position ${positions}` : "Not set";
      } else if (memberSeats.length > 0) {
        turnLabel = `Seat ${memberSeats.map((s) => s.seat_no).join(", ")}`;
      }

      return {
        ...member,
        seats: memberSeats,
        turnLabel,
        isCurrentTurn,
        isNextTurn,
      };
    });
  }, [members, nextTurn, seats]);

  const currentTurnText = useMemo(() => {
    if (!nextTurn) return "";

    const name = (nextTurn as any)?.username || "Member";
    const seatNo = (nextTurn as any)?.seat_no ?? "—";

    return `Current turn: ${name} • Seat ${seatNo}`;
  }, [nextTurn]);

  const nextTurnText = useMemo(() => {
    if (!nextTurn) return "";

    const name = (nextTurn as any)?.next_username || "Member";
    const seatNo = (nextTurn as any)?.next_seat_no ?? "—";

    return `Next turn: ${name} • Seat ${seatNo}`;
  }, [nextTurn]);

  if (!merryId || !Number.isFinite(merryId)) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Invalid merry"
            subtitle="No merry was selected."
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Not signed in"
            subtitle="Please login to view merry members."
            actionLabel="Go to Login"
            onAction={() => router.replace(ROUTES.auth.login as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!loading && !merry && error) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Unable to load merry"
            subtitle={error}
            actionLabel="Back to Merry"
            onAction={() => router.replace(ROUTES.tabs.merry as any)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 28, 36) },
        ]}
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
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>
            {merry?.name || (loading ? "Members" : "Merry Members")}
          </Text>

          <View style={styles.topBarActions}>
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={onRefresh}
              style={styles.iconBtn}
            >
              <Ionicons name="refresh-outline" size={18} color={WHITE} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
            </TouchableOpacity>
          </View>
        </View>

        <Card style={styles.mainCard} variant="default">
          <Text style={styles.mainLabel}>Members in this merry</Text>
          <Text style={styles.mainAmount}>{totals.members}</Text>
          <Text style={styles.mainSubLabel}>
            {totals.seats} active seat{totals.seats === 1 ? "" : "s"}
          </Text>

          <View style={styles.summaryRow}>
            <SummaryTile
              label="Members"
              value={String(totals.members)}
              icon="people-outline"
            />
            <View style={{ width: SPACING.sm }} />
            <SummaryTile
              label="Seats"
              value={String(totals.seats)}
              icon="grid-outline"
            />
            <View style={{ width: SPACING.sm }} />
            <SummaryTile
              label="View"
              value={isAdmin ? "Admin" : "Member"}
              icon="eye-outline"
            />
          </View>

          {nextTurn ? (
            <View style={{ marginTop: SPACING.md, gap: SPACING.sm }}>
              <InfoPill text={currentTurnText} success />
              <InfoPill text={nextTurnText} success />
            </View>
          ) : null}
        </Card>

        {error ? (
          <Card style={styles.errorCard} variant="default">
            <Ionicons name="alert-circle-outline" size={18} color={ERROR_TEXT} />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Section title="Members">
          {!loading && membersWithTurns.length === 0 ? (
            <Card style={styles.emptyCard} variant="default">
              <EmptyState
                icon="people-outline"
                title="No members found"
                subtitle="Approved merry members will appear here."
              />
            </Card>
          ) : (
            <View style={styles.cardList}>
              {membersWithTurns.map((member) => (
                <MemberCard
                  key={String(member.member_id ?? member.user_id)}
                  member={member}
                />
              ))}
            </View>
          )}
        </Section>

        <View style={styles.bottomActions}>
          <Button
            title="Back"
            variant="secondary"
            onPress={() => router.back()}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PAGE_BG,
    padding: 24,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  pageTitle: {
    color: WHITE,
    fontSize: 22,
    fontFamily: FONT.bold,
    flex: 1,
  },

  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },

  mainCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 24,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },

  mainLabel: {
    color: SOFT,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  mainAmount: {
    color: WHITE,
    fontSize: 28,
    fontFamily: FONT.bold,
    marginTop: 10,
  },

  mainSubLabel: {
    color: SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
    marginTop: 4,
  },

  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: SPACING.md,
  },

  summaryTile: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: SPACING.md,
    minHeight: 100,
  },

  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236,251,255,0.88)",
    marginBottom: 10,
  },

  summaryLabel: {
    color: SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  summaryValue: {
    color: WHITE,
    fontSize: 16,
    marginTop: 6,
    fontFamily: FONT.bold,
  },

  infoPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },

  infoPillText: {
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: ERROR_BG,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
    borderRadius: 20,
  },

  errorText: {
    flex: 1,
    color: ERROR_TEXT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  cardList: {
    gap: SPACING.md,
  },

  memberCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 22,
    padding: SPACING.md,
  },

  memberTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  memberTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },

  memberIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 255, 235, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  memberName: {
    color: WHITE,
    fontSize: 15,
    fontFamily: FONT.bold,
  },

  memberSub: {
    color: SOFT,
    fontSize: 12,
    marginTop: 4,
    fontFamily: FONT.regular,
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },

  badgeNeutral: {
    backgroundColor: ACCENT_BG,
    borderWidth: 1,
    borderColor: "rgba(12,106,128,0.26)",
  },

  badgeNext: {
    backgroundColor: SUCCESS_BG,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.22)",
  },

  badgeText: {
    fontSize: 11,
    fontFamily: FONT.medium,
  },

  badgeTextNeutral: {
    color: ACCENT_TEXT,
  },

  badgeTextNext: {
    color: SUCCESS_TEXT,
  },

  rowLabel: {
    color: SOFT,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  rowValue: {
    color: WHITE,
    fontSize: 13,
    marginTop: 4,
    fontFamily: FONT.bold,
  },

  emptyCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 22,
  },

  bottomActions: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
});