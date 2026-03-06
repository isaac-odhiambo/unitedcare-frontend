// app/(tabs)/merry/payouts-schedule.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { fmtKES } from "@/services/merry";
import { getSessionUser, SessionUser } from "@/services/session";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

type ScheduleResponse = {
  merry: {
    id: number;
    name: string;
    payout_order_type: string;
    contribution_amount: string;
    members_count: number;
    seats_count: number;
    payout_frequency: string;
    payouts_per_period: number;
  };
  current_period_key: string;
  used_slots_in_period: number[];
  seats: Array<{
    seat_id: number;
    member_id: number;
    user_id: number;
    username: string | null;
    phone: string | null;
    seat_no: number;
    payout_position: number | null;
  }>;
};

type SlotConfigRow = { slot_no: number; weekday: number; weekday_name: string };

function slotName(slotConfigs: SlotConfigRow[], slotNo: number) {
  const row = slotConfigs.find((s) => s.slot_no === slotNo);
  return row?.weekday_name ? `Slot ${slotNo} • ${row.weekday_name}` : `Slot ${slotNo}`;
}

export default function MerryPayoutScheduleScreen() {
  const params = useLocalSearchParams();
  const merryId = useMemo(() => String(params?.merryId || ""), [params]);

  const [me, setMe] = useState<SessionUser | null>(null);
  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [slots, setSlots] = useState<SlotConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!merryId) return;
    try {
      setLoading(true);

      const u = await getSessionUser();
      setMe(u);

      const res = await api.get(`/api/merry/${merryId}/payouts/schedule/`);
      setSchedule(res.data as ScheduleResponse);

      const resSlots = await api.get(`/api/merry/${merryId}/slots/`);
      setSlots(Array.isArray(resSlots.data) ? (resSlots.data as SlotConfigRow[]) : []);
    } catch (e: any) {
      Alert.alert("Payout schedule", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const periodKey = schedule?.current_period_key || "—";
  const pp = schedule?.merry?.payouts_per_period || 1;
  const used = new Set(schedule?.used_slots_in_period || []);

  const slotCards = useMemo(() => {
    const out: Array<{ slotNo: number; used: boolean; label: string }> = [];
    for (let s = 1; s <= pp; s++) {
      out.push({ slotNo: s, used: used.has(s), label: slotName(slots, s) });
    }
    return out;
  }, [pp, used, slots]);

  if (!merryId) {
    return (
      <View style={[styles.container, { padding: SPACING.lg }]}>
        <EmptyState title="Missing merryId" subtitle="Go back and open a merry again." />
        <View style={{ height: SPACING.lg }} />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <Card>
          <View style={{ paddingVertical: 14 }}>
            <ActivityIndicator />
          </View>
        </Card>
      ) : !schedule ? (
        <EmptyState title="Schedule not available" subtitle="You may not have access to this merry." />
      ) : (
        <>
          <Card style={{ marginBottom: SPACING.lg }}>
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.hTitle}>Payout Schedule</Text>
                <Text style={styles.hSub}>
                  {schedule.merry.name} • Period: {periodKey}
                </Text>
              </View>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Frequency</Text>
              <Text style={styles.kvValue}>{String(schedule.merry.payout_frequency || "—")}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Contribution / seat / slot</Text>
              <Text style={styles.kvValue}>{fmtKES(schedule.merry.contribution_amount)}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Seats</Text>
              <Text style={styles.kvValue}>{String(schedule.merry.seats_count || 0)}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Slots this period</Text>
              <Text style={styles.kvValue}>{String(schedule.merry.payouts_per_period || 1)}</Text>
            </View>

            <View style={{ height: SPACING.sm }} />

            <Button
              title="Back to Merry"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/merry/[merryId]" as any,
                  params: { merryId },
                })
              }
              leftIcon={<Ionicons name="chevron-back-outline" size={18} color={COLORS.dark} />}
            />
          </Card>

          <Section title="Slots (current period)">
            <View style={{ gap: SPACING.sm }}>
              {slotCards.map((s) => (
                <Card key={`slot-${s.slotNo}`}>
                  <View style={styles.slotRow}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.slotTitle}>{s.label}</Text>
                      <Text style={styles.slotSub}>
                        {s.used ? "Payout already created for this slot." : "Available for payout creation."}
                      </Text>
                    </View>

                    <View style={[styles.slotPill, { borderColor: s.used ? COLORS.gray : COLORS.success }]}>
                      <Text style={[styles.slotPillText, { color: s.used ? COLORS.gray : COLORS.success }]}>
                        {s.used ? "USED" : "OPEN"}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          </Section>

          <Section
            title="Seats order"
            right={
              <View style={styles.rightMeta}>
                <Text style={styles.rightText}>
                  {String(schedule.merry.payout_order_type || "").toUpperCase()}
                </Text>
              </View>
            }
          >
            {schedule.seats.length === 0 ? (
              <EmptyState
                icon="albums-outline"
                title="No seats"
                subtitle="Seats appear after join requests are approved."
              />
            ) : (
              schedule.seats.map((s) => (
                <Card key={`seat-${s.seat_id}`} style={{ marginBottom: SPACING.md }}>
                  <View style={styles.seatTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.name}>{s.username || `User #${s.user_id}`}</Text>
                      <Text style={styles.meta}>
                        Seat #{s.seat_no} • {s.phone ? `Phone: ${s.phone}` : "Phone: —"}
                      </Text>
                    </View>

                    <View style={styles.positionPill}>
                      <Ionicons name="trophy-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.positionText}>
                        {s.payout_position ? `#${s.payout_position}` : "—"}
                      </Text>
                    </View>
                  </View>

                  {isAdmin ? (
                    <View style={{ marginTop: SPACING.md }}>
                      <Button
                        title="Create payout for this seat"
                        variant="secondary"
                        onPress={() =>
                          router.push({
                            pathname: "/merry/admin-payout-create" as any,
                            params: { merryId: String(schedule.merry.id), seatId: String(s.seat_id) },
                          })
                        }
                        leftIcon={<Ionicons name="send-outline" size={18} color={COLORS.dark} />}
                      />
                    </View>
                  ) : null}
                </Card>
              ))
            )}
          </Section>

          <View style={{ height: 24 }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kvLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kvValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },

  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  slotTitle: { fontFamily: FONT.bold, fontSize: 13, color: COLORS.dark },
  slotSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  slotPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
  },
  slotPillText: { fontFamily: FONT.bold, fontSize: 11 },

  rightMeta: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rightText: { fontFamily: FONT.bold, fontSize: 11, color: COLORS.primary },

  seatTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },
  meta: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  positionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  positionText: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.primary },
});