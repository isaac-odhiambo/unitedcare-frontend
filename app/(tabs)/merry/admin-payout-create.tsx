// app/(tabs)/merry/admin-payout-create.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { fmtKES } from "@/services/merry";
import { getSessionUser, SessionUser } from "@/services/session";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
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

type CreatePayoutResp = {
  message: string;
  payout_id: number;
  status: string;
  merry_id: number;
  seat_id: number;
  member_id: number;
  user_id: number;
  amount: string;
  period_key: string;
  slot_no: number;
};

function toIntSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

export default function AdminPayoutCreateScreen() {
  const params = useLocalSearchParams();
  const merryId = useMemo(() => String(params?.merryId || ""), [params]);

  // optional preselect from schedule screen
  const initialSeatId = useMemo(() => String(params?.seatId || ""), [params]);

  const [me, setMe] = useState<SessionUser | null>(null);
  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [seatId, setSeatId] = useState<string>(initialSeatId);
  const [periodKey, setPeriodKey] = useState<string>("");
  const [slotNo, setSlotNo] = useState<string>(""); // optional (blank => backend picks next available)
  const [amount, setAmount] = useState<string>(""); // required if compute=false
  const [computeAmount, setComputeAmount] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!merryId) return;

    try {
      setLoading(true);

      const u = await getSessionUser();
      setMe(u);

      const res = await api.get(`/api/merry/${merryId}/payouts/schedule/`);
      const sch = res.data as ScheduleResponse;
      setSchedule(sch);

      setPeriodKey((prev) => prev || sch.current_period_key || "");
      setSeatId((prev) => prev || initialSeatId || "");
    } catch (e: any) {
      Alert.alert("Create payout", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [merryId, initialSeatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const usedSlots = useMemo(() => new Set(schedule?.used_slots_in_period || []), [schedule]);
  const maxSlots = schedule?.merry?.payouts_per_period || 1;

  const selectedSeat = useMemo(() => {
    const sid = toIntSafe(seatId);
    if (!Number.isFinite(sid) || !schedule) return null;
    return schedule.seats.find((s) => s.seat_id === sid) || null;
  }, [seatId, schedule]);

  const create = useCallback(async () => {
    if (!merryId) return;
    if (!schedule) return;

    const sid = toIntSafe(seatId);
    if (!Number.isFinite(sid) || sid <= 0) {
      Alert.alert("Create payout", "Select a seat_id.");
      return;
    }

    const body: any = {
      seat_id: sid,
      compute_amount: !!computeAmount,
      notes: "",
    };

    const pk = String(periodKey || "").trim();
    if (pk) body.period_key = pk;

    const sn = String(slotNo || "").trim();
    if (sn) {
      const n = toIntSafe(sn);
      if (!Number.isFinite(n) || n < 1 || n > maxSlots) {
        Alert.alert("Create payout", `slot_no must be between 1 and ${maxSlots}.`);
        return;
      }
      if (usedSlots.has(n)) {
        Alert.alert("Create payout", `Slot ${n} is already used in this period.`);
        return;
      }
      body.slot_no = n;
    }

    if (!computeAmount) {
      const amt = Number(String(amount || "").trim());
      if (!Number.isFinite(amt) || amt <= 0) {
        Alert.alert("Create payout", "Enter a valid amount > 0 or enable Compute Amount.");
        return;
      }
      body.amount = amt;
    }

    try {
      setSubmitting(true);
      const res = await api.post(`/api/merry/${merryId}/payouts/create/`, body);
      const payload = res.data as CreatePayoutResp;

      Alert.alert(
        "Payout created",
        `Payout #${payload.payout_id}\nSeat: ${payload.seat_id}\nAmount: ${fmtKES(payload.amount)}\nPeriod: ${payload.period_key}\nSlot: ${payload.slot_no}`,
        [
          {
            text: "View schedule",
            onPress: () =>
              router.replace({
                pathname: "/merry/payouts-schedule" as any,
                params: { merryId: String(merryId) },
              }),
          },
          { text: "OK" },
        ]
      );
    } catch (e: any) {
      Alert.alert("Create payout", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [merryId, schedule, seatId, periodKey, slotNo, amount, computeAmount, maxSlots, usedSlots]);

  if (!merryId) {
    return (
      <View style={[styles.container, { padding: SPACING.lg }]}>
        <EmptyState title="Missing merryId" subtitle="Go back and open a merry again." />
        <View style={{ height: SPACING.lg }} />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  if (me && !isAdmin) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EmptyState icon="lock-closed-outline" title="Admin only" subtitle="Only admins can create payout records." />
        <View style={{ height: SPACING.lg }} />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? (
        <Card>
          <View style={{ paddingVertical: SPACING.md, alignItems: "center" }}>
             <ActivityIndicator color={COLORS.primary} />
          </View>
        </Card>

      ) : !schedule ? (
        <EmptyState title="Cannot load schedule" subtitle="Check your access and try again." />
      ) : (
        <>
          <Card style={{ marginBottom: SPACING.lg }}>
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.hTitle}>Create Payout</Text>
                <Text style={styles.hSub}>{schedule.merry.name}</Text>
              </View>
              <Ionicons name="send-outline" size={22} color={COLORS.primary} />
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Current period</Text>
              <Text style={styles.kvValue}>{schedule.current_period_key}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Slots / period</Text>
              <Text style={styles.kvValue}>{String(schedule.merry.payouts_per_period || 1)}</Text>
            </View>

            <View style={{ height: SPACING.sm }} />

            <Button
              title="Back to schedule"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/merry/payouts-schedule" as any,
                  params: { merryId: String(merryId) },
                })
              }
              leftIcon={<Ionicons name="calendar-outline" size={18} color={COLORS.dark} />}
            />
          </Card>

          <Section title="Payout details">
            <Card>
              <Input
                label="Seat ID (from schedule)"
                value={seatId}
                onChangeText={setSeatId}
                placeholder="e.g. 12"
                keyboardType="number-pad"
                error={!seatId ? "Seat ID is required." : undefined}
              />

              {selectedSeat ? (
                <View style={styles.preview}>
                  <Ionicons name="person-outline" size={18} color={COLORS.gray} />
                  <Text style={styles.previewText}>
                    {selectedSeat.username || `User #${selectedSeat.user_id}`} • Seat #{selectedSeat.seat_no}{" "}
                    {selectedSeat.payout_position ? `• Position #${selectedSeat.payout_position}` : ""}
                  </Text>
                </View>
              ) : null}

              <Input
                label="Period key (optional)"
                value={periodKey}
                onChangeText={setPeriodKey}
                placeholder={schedule.current_period_key}
              />

              <Input
                label={`Slot no (optional; 1..${maxSlots})`}
                value={slotNo}
                onChangeText={setSlotNo}
                placeholder="Leave blank to auto-pick next available"
                keyboardType="number-pad"
              />

              <Card style={styles.toggleCard}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.toggleTitle}>Compute amount</Text>
                    <Text style={styles.toggleSub}>
                      If ON, backend computes total paid allocations for the selected period+slot.
                    </Text>
                  </View>

                  <Button
                    title={computeAmount ? "ON" : "OFF"}
                    variant={computeAmount ? "primary" : "secondary"}
                    onPress={() => setComputeAmount((v) => !v)}
                    style={{ width: 90 }}
                  />
                </View>
              </Card>

              {!computeAmount ? (
                <Input
                  label="Amount (required if compute is OFF)"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 15000"
                  keyboardType="decimal-pad"
                />
              ) : null}

              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.gray} />
                <Text style={styles.infoText}>
                  Backend prevents duplicate payouts for the same period+slot, and prevents paying the same seat twice
                  within the same period.
                </Text>
              </View>

              <View style={{ height: SPACING.md }} />

              <Button
                title={submitting ? "Creating..." : "Create payout record"}
                onPress={create}
                loading={submitting}
                leftIcon={<Ionicons name="send-outline" size={18} color={COLORS.white} />}
              />
            </Card>
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

  preview: {
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  previewText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  toggleCard: { padding: SPACING.md, marginBottom: SPACING.md },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  toggleTitle: { fontFamily: FONT.bold, fontSize: 13, color: COLORS.dark },
  toggleSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  infoBox: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },
});