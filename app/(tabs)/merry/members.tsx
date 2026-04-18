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
const TEXT = "rgba(255,255,255,0.92)";
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
  isNextTurn: boolean;
};

function MemberCard({ member }: { member: MemberWithTurns }) {
  const seatCount = member.seats.length;
  const seatNos = member.seats.map((s) => s.seat_no).join(", ");
  const payoutPositions = member.seats
    .map((s) => s.payout_position)
    .filter((v) => v != null)
    .join(", ");

  return (
    <Card style={styles.memberCard} variant="default">
      <View style={styles.memberTop}>
        <View style={styles.memberTitleWrap}>
          <View style={styles.memberIconWrap}>
            <Ionicons
              name={member.isNextTurn ? "star-outline" : "person-outline"}
              size={17}
              color={member.isNextTurn ? BRAND : BRAND}
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
            member.isNextTurn ? styles.badgeNext : styles.badgeNeutral,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              member.isNextTurn ? styles.badgeTextNext : styles.badgeTextNeutral,
            ]}
          >
            {member.isNextTurn ? "Next" : `${seatCount} seat${seatCount === 1 ? "" : "s"}`}
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
          {member.turnLabel || (payoutPositions ? `Position ${payoutPositions}` : "Not set")}
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

    return members.map((member) => {
      const memberSeats = (seatMap.get(member.member_id) || []).sort(
        (a, b) => a.seat_no - b.seat_no
      );

      const isNextTurn =
        nextTurn != null &&
        (nextTurn.member_id === member.member_id ||
          nextTurn.user_id === member.user_id);

      let turnLabel = "Not set";

      if (isNextTurn) {
        turnLabel = `Current next turn • Seat ${nextTurn?.seat_no}`;
      } else if (memberSeats.some((s) => s.payout_position != null)) {
        const positions = memberSeats
          .map((s) => s.payout_position)
          .filter((v) => v != null)
          .join(", ");
        turnLabel = `Position ${positions}`;
      } else if (memberSeats.length > 0) {
        turnLabel = `Seat ${memberSeats.map((s) => s.seat_no).join(", ")}`;
      }

      return {
        ...member,
        seats: memberSeats,
        turnLabel,
        isNextTurn,
      };
    });
  }, [members, nextTurn, seats]);

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
            <View style={{ marginTop: SPACING.md }}>
              <InfoPill
                text={`Current next turn: ${nextTurn.username || "Member"} • Seat ${nextTurn.seat_no}`}
                success
              />
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

// // app/(tabs)/merry/members.tsx
// import { Ionicons } from "@expo/vector-icons";
// import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
// import React, { useCallback, useMemo, useState } from "react";
// import {
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import {
//   SafeAreaView,
//   useSafeAreaInsets,
// } from "react-native-safe-area-context";

// import Button from "@/components/ui/Button";
// import Card from "@/components/ui/Card";
// import EmptyState from "@/components/ui/EmptyState";
// import Section from "@/components/ui/Section";

// import { ROUTES } from "@/constants/routes";
// import { FONT, SHADOW, SPACING } from "@/constants/theme";
// import { getErrorMessage } from "@/services/api";
// import {
//   getApiErrorMessage,
//   getMerryDetail,
//   getMerryMembers,
//   MerryDetail,
//   MerryMemberRow,
// } from "@/services/merry";
// import { getMe, isAdminUser, MeResponse } from "@/services/profile";
// import { getSessionUser, SessionUser } from "@/services/session";

// type MerryMembersUser = Partial<MeResponse> & Partial<SessionUser>;

// const PAGE_BG = "#062C49";
// const BRAND = "#0C6A80";
// const BRAND_DARK = "#09586A";
// const WHITE = "#FFFFFF";
// const TEXT_ON_DARK = "rgba(255,255,255,0.90)";
// const TEXT_ON_DARK_SOFT = "rgba(255,255,255,0.74)";
// const SOFT_WHITE = "rgba(255,255,255,0.10)";
// const CARD_BORDER = "rgba(255,255,255,0.10)";
// const MERRY_CARD = "rgba(98, 192, 98, 0.23)";
// const MERRY_BORDER = "rgba(194, 255, 188, 0.16)";
// const MERRY_ICON_BG = "rgba(236, 255, 235, 0.76)";
// const MERRY_ICON = "#379B4A";
// const SUCCESS_BG = "rgba(34,197,94,0.16)";
// const SUCCESS_TEXT = "#DCFCE7";
// const WARNING_BG = "rgba(245,158,11,0.18)";
// const WARNING_TEXT = "#FEF3C7";
// const ACCENT_BG = "rgba(12,106,128,0.20)";
// const ACCENT_TEXT = "#D9F3F9";
// const ERROR_BG = "rgba(239,68,68,0.18)";
// const ERROR_TEXT = "#FECACA";

// function SummaryTile({
//   label,
//   value,
//   icon,
// }: {
//   label: string;
//   value: string;
//   icon: keyof typeof Ionicons.glyphMap;
// }) {
//   return (
//     <Card style={styles.summaryTile} variant="default">
//       <View style={styles.summaryIconWrap}>
//         <Ionicons name={icon} size={16} color={BRAND} />
//       </View>
//       <Text style={styles.summaryLabel}>{label}</Text>
//       <Text style={styles.summaryValue} numberOfLines={1}>
//         {value}
//       </Text>
//     </Card>
//   );
// }

// function InfoStrip({
//   icon,
//   text,
//   tone = "neutral",
// }: {
//   icon: keyof typeof Ionicons.glyphMap;
//   text: string;
//   tone?: "neutral" | "warning" | "success" | "danger";
// }) {
//   const toneStyle =
//     tone === "warning"
//       ? {
//           bg: WARNING_BG,
//           border: "rgba(245,158,11,0.22)",
//           color: WARNING_TEXT,
//         }
//       : tone === "success"
//         ? {
//             bg: SUCCESS_BG,
//             border: "rgba(34,197,94,0.22)",
//             color: SUCCESS_TEXT,
//           }
//         : tone === "danger"
//           ? {
//               bg: ERROR_BG,
//               border: "rgba(239,68,68,0.22)",
//               color: ERROR_TEXT,
//             }
//           : {
//               bg: SOFT_WHITE,
//               border: CARD_BORDER,
//               color: TEXT_ON_DARK,
//             };

//   return (
//     <View
//       style={[
//         styles.infoStrip,
//         { backgroundColor: toneStyle.bg, borderColor: toneStyle.border },
//       ]}
//     >
//       <Ionicons name={icon} size={16} color={toneStyle.color} />
//       <Text style={[styles.infoStripText, { color: toneStyle.color }]}>
//         {text}
//       </Text>
//     </View>
//   );
// }

// function MemberCard({ member }: { member: MerryMemberRow }) {
//   const seatCount = Number(member.seats_count || 0) || 0;

//   return (
//     <Card style={styles.memberCard} variant="default">
//       <View style={styles.spaceGlowTop} />
//       <View style={styles.spaceGlowBottom} />

//       <View style={styles.memberTop}>
//         <View style={styles.memberTitleWrap}>
//           <View style={styles.memberIconWrap}>
//             <Ionicons name="person-outline" size={17} color={MERRY_ICON} />
//           </View>

//           <View style={{ flex: 1, minWidth: 0 }}>
//             <Text style={styles.memberName} numberOfLines={1}>
//               {member.username || `User #${member.user_id}`}
//             </Text>
//             <Text style={styles.memberSub} numberOfLines={2}>
//               {member.phone || "No phone added"}
//             </Text>
//           </View>
//         </View>

//         <View style={styles.seatBadge}>
//           <Text style={styles.seatBadgeText}>
//             {seatCount} {seatCount === 1 ? "seat" : "seats"}
//           </Text>
//         </View>
//       </View>

//       {member.joined_at ? (
//         <View style={{ marginTop: SPACING.sm }}>
//           <InfoStrip
//             icon="calendar-outline"
//             text={`Joined ${member.joined_at}`}
//             tone="neutral"
//           />
//         </View>
//       ) : null}
//     </Card>
//   );
// }

// export default function MerryMembersScreen() {
//   const insets = useSafeAreaInsets();
//   const params = useLocalSearchParams<{ merryId?: string; id?: string }>();
//   const merryId = Number(params.merryId ?? params.id ?? 0);

//   const [user, setUser] = useState<MerryMembersUser | null>(null);
//   const [merry, setMerry] = useState<MerryDetail | null>(null);
//   const [members, setMembers] = useState<MerryMemberRow[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [refreshing, setRefreshing] = useState(false);
//   const [error, setError] = useState("");

//   const isAdmin = isAdminUser(user);

//   const load = useCallback(async () => {
//     if (!merryId || !Number.isFinite(merryId)) {
//       setError("Missing or invalid merry ID.");
//       setLoading(false);
//       return;
//     }

//     try {
//       setError("");

//       const [sessionRes, meRes, merryRes, membersRes] = await Promise.allSettled([
//         getSessionUser(),
//         getMe(),
//         getMerryDetail(merryId),
//         getMerryMembers(merryId),
//       ]);

//       const sessionUser =
//         sessionRes.status === "fulfilled" ? sessionRes.value : null;
//       const meUser = meRes.status === "fulfilled" ? meRes.value : null;

//       setUser(
//         sessionUser || meUser
//           ? {
//               ...(sessionUser ?? {}),
//               ...(meUser ?? {}),
//             }
//           : null
//       );

//       if (merryRes.status === "fulfilled") {
//         setMerry(merryRes.value);
//       } else {
//         setMerry(null);
//       }

//       if (membersRes.status === "fulfilled") {
//         setMembers(Array.isArray(membersRes.value) ? membersRes.value : []);
//       } else {
//         setMembers([]);
//       }

//       const errors: string[] = [];

//       if (merryRes.status === "rejected") {
//         errors.push(
//           getApiErrorMessage(merryRes.reason) ||
//             getErrorMessage(merryRes.reason)
//         );
//       }

//       if (membersRes.status === "rejected") {
//         errors.push(
//           getApiErrorMessage(membersRes.reason) ||
//             getErrorMessage(membersRes.reason)
//         );
//       }

//       setError(errors.filter(Boolean).join(" • "));
//     } catch (e: any) {
//       setMerry(null);
//       setMembers([]);
//       setError(getApiErrorMessage(e) || getErrorMessage(e));
//     } finally {
//       setLoading(false);
//     }
//   }, [merryId]);

//   useFocusEffect(
//     useCallback(() => {
//       setLoading(true);
//       load();
//     }, [load])
//   );

//   const onRefresh = useCallback(async () => {
//     setRefreshing(true);
//     try {
//       await load();
//     } finally {
//       setRefreshing(false);
//     }
//   }, [load]);

//   const totals = useMemo(() => {
//     const totalSeats = members.reduce(
//       (sum, m) => sum + (Number(m.seats_count || 0) || 0),
//       0
//     );

//     return {
//       members: members.length,
//       seats: totalSeats,
//     };
//   }, [members]);

//   if (!merryId || !Number.isFinite(merryId)) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.emptyWrap}>
//           <EmptyState
//             title="Invalid merry"
//             subtitle="No merry was selected."
//             actionLabel="Back to Merry"
//             onAction={() => router.replace(ROUTES.tabs.merry as any)}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!loading && !user) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.emptyWrap}>
//           <EmptyState
//             title="Not signed in"
//             subtitle="Please login to view merry members."
//             actionLabel="Go to Login"
//             onAction={() => router.replace(ROUTES.auth.login as any)}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!loading && !merry && error) {
//     return (
//       <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//         <View style={styles.emptyWrap}>
//           <EmptyState
//             title="Unable to load merry"
//             subtitle={error}
//             actionLabel="Back to Merry"
//             onAction={() => router.replace(ROUTES.tabs.merry as any)}
//           />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
//       <ScrollView
//         style={styles.page}
//         contentContainerStyle={[
//           styles.content,
//           { paddingBottom: Math.max(insets.bottom + 28, 36) },
//         ]}
//         refreshControl={
//           <RefreshControl
//             refreshing={refreshing}
//             onRefresh={onRefresh}
//             tintColor="#8CF0C7"
//             colors={["#8CF0C7", "#0CC0B7"]}
//           />
//         }
//         showsVerticalScrollIndicator={false}
//       >
//         <View style={styles.backgroundBlobTop} />
//         <View style={styles.backgroundBlobMiddle} />
//         <View style={styles.backgroundBlobBottom} />
//         <View style={styles.backgroundGlowOne} />
//         <View style={styles.backgroundGlowTwo} />

//         <View style={styles.topBar}>
//           <View style={styles.brandRow}>
//             <View style={styles.logoBadge}>
//               <Ionicons name="people-outline" size={22} color={WHITE} />
//             </View>

//             <View style={{ flex: 1 }}>
//               <Text style={styles.brandWordmark}>
//                 MERRY <Text style={styles.brandWordmarkGreen}>MEMBERS</Text>
//               </Text>
//               <Text style={styles.brandSub}>Community sharing space</Text>
//             </View>
//           </View>

//           <View style={styles.topBarActions}>
//             <TouchableOpacity
//               activeOpacity={0.92}
//               onPress={onRefresh}
//               style={styles.iconBtn}
//             >
//               <Ionicons name="refresh-outline" size={18} color={WHITE} />
//             </TouchableOpacity>

//             <TouchableOpacity
//               activeOpacity={0.92}
//               onPress={() => router.back()}
//               style={styles.iconBtn}
//             >
//               <Ionicons name="arrow-back-outline" size={18} color={WHITE} />
//             </TouchableOpacity>
//           </View>
//         </View>

//         <Card style={styles.heroCard} variant="default">
//           <View style={styles.spaceGlowTop} />
//           <View style={styles.spaceGlowBottom} />

//           <View style={styles.heroTop}>
//             <View style={{ flex: 1, paddingRight: SPACING.md }}>
//               <Text style={styles.heroEyebrow}>MERRY MEMBERS</Text>
//               <Text style={styles.heroTitle}>
//                 {merry?.name || (loading ? "Merry Members" : `Merry #${merryId}`)}
//               </Text>
//               <Text style={styles.heroSubtitle}>
//                 See the people in this merry space and how many seats are active
//                 in the circle.
//               </Text>
//             </View>

//             <View style={styles.heroIconWrap}>
//               <Ionicons name="people-outline" size={22} color={MERRY_ICON} />
//             </View>
//           </View>

//           <View style={styles.summaryRow}>
//             <SummaryTile
//               label="Members"
//               value={String(totals.members)}
//               icon="people-outline"
//             />
//             <SummaryTile
//               label="Total seats"
//               value={String(totals.seats)}
//               icon="grid-outline"
//             />
//             <SummaryTile
//               label="View"
//               value={isAdmin ? "Admin" : "Member"}
//               icon="eye-outline"
//             />
//           </View>

//           <View style={{ marginTop: SPACING.md }}>
//             <InfoStrip
//               icon="information-circle-outline"
//               text={
//                 merry?.is_member
//                   ? "You are viewing this merry as a joined member."
//                   : isAdmin
//                     ? "You are viewing this merry in admin mode."
//                     : "You are viewing this merry member list."
//               }
//               tone="neutral"
//             />
//           </View>
//         </Card>

//         {error ? (
//           <Card style={styles.errorCard} variant="default">
//             <Ionicons name="alert-circle-outline" size={18} color={ERROR_TEXT} />
//             <Text style={styles.errorText}>{error}</Text>
//           </Card>
//         ) : null}

//         <Section title="Member list">
//           {!loading && members.length === 0 ? (
//             <Card style={styles.emptyCard} variant="default">
//               <EmptyState
//                 icon="people-outline"
//                 title="No members found"
//                 subtitle="Approved merry members will appear here."
//               />
//             </Card>
//           ) : (
//             <View style={styles.cardList}>
//               {members.map((member) => (
//                 <MemberCard
//                   key={String(member.member_id ?? member.user_id)}
//                   member={member}
//                 />
//               ))}
//             </View>
//           )}
//         </Section>

//         <View style={styles.bottomActions}>
//           <Button
//             title="Back to Merry"
//             variant="secondary"
//             onPress={() => router.push(ROUTES.tabs.merry as any)}
//             style={{ flex: 1 }}
//           />
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   page: {
//     flex: 1,
//     backgroundColor: PAGE_BG,
//   },

//   content: {
//     paddingHorizontal: SPACING.md,
//     paddingBottom: SPACING.xl,
//     position: "relative",
//   },

//   emptyWrap: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: PAGE_BG,
//     padding: 24,
//   },

//   backgroundBlobTop: {
//     position: "absolute",
//     top: -60,
//     right: -30,
//     width: 220,
//     height: 220,
//     borderRadius: 999,
//     backgroundColor: "rgba(19, 195, 178, 0.10)",
//   },

//   backgroundBlobMiddle: {
//     position: "absolute",
//     top: 260,
//     left: -80,
//     width: 220,
//     height: 220,
//     borderRadius: 999,
//     backgroundColor: "rgba(52, 174, 213, 0.08)",
//   },

//   backgroundBlobBottom: {
//     position: "absolute",
//     bottom: 80,
//     right: -40,
//     width: 260,
//     height: 260,
//     borderRadius: 999,
//     backgroundColor: "rgba(112, 208, 115, 0.09)",
//   },

//   backgroundGlowOne: {
//     position: "absolute",
//     top: 100,
//     left: 40,
//     width: 6,
//     height: 6,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.45)",
//   },

//   backgroundGlowTwo: {
//     position: "absolute",
//     top: 180,
//     right: 60,
//     width: 10,
//     height: 10,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.18)",
//   },

//   topBar: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     gap: SPACING.sm,
//     marginBottom: SPACING.md,
//     paddingTop: SPACING.xs,
//   },

//   brandRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 10,
//     flex: 1,
//   },

//   logoBadge: {
//     width: 54,
//     height: 54,
//     borderRadius: 18,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "rgba(255,255,255,0.12)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//   },

//   brandWordmark: {
//     color: WHITE,
//     fontSize: 17,
//     fontFamily: FONT.bold,
//     letterSpacing: 0.8,
//   },

//   brandWordmarkGreen: {
//     color: "#74D16C",
//   },

//   brandSub: {
//     color: TEXT_ON_DARK_SOFT,
//     fontSize: 11,
//     marginTop: 2,
//     fontFamily: FONT.regular,
//   },

//   topBarActions: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },

//   iconBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 14,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: "rgba(255,255,255,0.12)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//   },

//   heroCard: {
//     position: "relative",
//     overflow: "hidden",
//     backgroundColor: MERRY_CARD,
//     borderWidth: 1,
//     borderColor: MERRY_BORDER,
//     marginBottom: SPACING.lg,
//     borderRadius: 24,
//     ...SHADOW.card,
//   },

//   spaceGlowTop: {
//     position: "absolute",
//     top: -18,
//     right: -10,
//     width: 96,
//     height: 96,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.06)",
//   },

//   spaceGlowBottom: {
//     position: "absolute",
//     bottom: -24,
//     left: -8,
//     width: 120,
//     height: 70,
//     borderRadius: 999,
//     backgroundColor: "rgba(255,255,255,0.05)",
//   },

//   heroTop: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "flex-start",
//   },

//   heroEyebrow: {
//     color: "#D8FFF0",
//     fontSize: 11,
//     lineHeight: 15,
//     fontFamily: FONT.bold,
//     letterSpacing: 0.8,
//   },

//   heroTitle: {
//     color: WHITE,
//     fontSize: 24,
//     lineHeight: 30,
//     marginTop: 6,
//     fontFamily: FONT.bold,
//   },

//   heroSubtitle: {
//     color: TEXT_ON_DARK_SOFT,
//     fontSize: 13,
//     lineHeight: 20,
//     marginTop: 8,
//     fontFamily: FONT.regular,
//   },

//   heroIconWrap: {
//     width: 52,
//     height: 52,
//     borderRadius: 18,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: MERRY_ICON_BG,
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.12)",
//   },

//   summaryRow: {
//     flexDirection: "row",
//     gap: SPACING.sm,
//     marginTop: SPACING.lg,
//   },

//   summaryTile: {
//     flex: 1,
//     paddingVertical: SPACING.md,
//     paddingHorizontal: SPACING.sm,
//     borderRadius: 18,
//     backgroundColor: "rgba(255,255,255,0.12)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//     minWidth: 0,
//   },

//   summaryIconWrap: {
//     width: 30,
//     height: 30,
//     borderRadius: 12,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: WHITE,
//     marginBottom: 10,
//     alignSelf: "flex-start",
//   },

//   summaryLabel: {
//     color: TEXT_ON_DARK_SOFT,
//     fontSize: 11,
//     fontFamily: FONT.medium,
//   },

//   summaryValue: {
//     color: WHITE,
//     fontSize: 16,
//     marginTop: 6,
//     fontFamily: FONT.bold,
//   },

//   errorCard: {
//     marginBottom: SPACING.md,
//     padding: SPACING.md,
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//     backgroundColor: ERROR_BG,
//     borderWidth: 1,
//     borderColor: "rgba(239,68,68,0.22)",
//   },

//   errorText: {
//     flex: 1,
//     color: ERROR_TEXT,
//     fontSize: 12,
//     fontFamily: FONT.regular,
//   },

//   infoStrip: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//     borderWidth: 1,
//     borderRadius: 16,
//     paddingHorizontal: SPACING.md,
//     paddingVertical: SPACING.sm,
//   },

//   infoStripText: {
//     flex: 1,
//     fontSize: 12,
//     lineHeight: 18,
//     fontFamily: FONT.regular,
//   },

//   cardList: {
//     gap: SPACING.md,
//   },

//   memberCard: {
//     position: "relative",
//     overflow: "hidden",
//     backgroundColor: "rgba(255,255,255,0.10)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//     borderRadius: 22,
//     ...SHADOW.card,
//   },

//   memberTop: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//     gap: SPACING.md,
//   },

//   memberTitleWrap: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 12,
//     flex: 1,
//   },

//   memberIconWrap: {
//     width: 42,
//     height: 42,
//     borderRadius: 14,
//     alignItems: "center",
//     justifyContent: "center",
//     backgroundColor: MERRY_ICON_BG,
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//   },

//   memberName: {
//     color: WHITE,
//     fontSize: 15,
//     fontFamily: FONT.bold,
//   },

//   memberSub: {
//     color: TEXT_ON_DARK_SOFT,
//     fontSize: 12,
//     marginTop: 4,
//     fontFamily: FONT.regular,
//   },

//   seatBadge: {
//     backgroundColor: ACCENT_BG,
//     borderWidth: 1,
//     borderColor: "rgba(12,106,128,0.26)",
//     paddingHorizontal: 10,
//     paddingVertical: 7,
//     borderRadius: 999,
//   },

//   seatBadgeText: {
//     color: ACCENT_TEXT,
//     fontSize: 11,
//     fontFamily: FONT.medium,
//   },

//   emptyCard: {
//     backgroundColor: "rgba(255,255,255,0.10)",
//     borderWidth: 1,
//     borderColor: "rgba(255,255,255,0.10)",
//     borderRadius: 22,
//   },

//   bottomActions: {
//     marginTop: SPACING.lg,
//     marginBottom: SPACING.sm,
//   },
// });