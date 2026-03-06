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
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

type MerryDetail = {
  id: number;
  name: string;
  contribution_amount: string;
  payout_order_type: "manual" | "random" | string;
  next_payout_date: string | null;
  payout_frequency: "WEEKLY" | "MONTHLY" | string;
  payouts_per_period: number;
  members_count: number;
  seats_count: number;
  total_pool_per_slot: string;
  total_pool_per_period: string;
  created_by: number;
  created_at: string;
};

type SlotRow = { slot_no: number; weekday: number; weekday_name: string };

type MyDuesResponse = {
  merry_id: number;
  period_key: string;
  payouts_per_period: number;
  data: Array<{
    due_id: number;
    period_key: string;
    slot_no: number;
    seat_id: number;
    seat_no: number;
    due_amount: string;
    paid_amount: string;
    status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED" | string;
    outstanding: string;
    updated_at: string;
  }>;
};

function toNum(x?: string | number) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function weekdayFromConfig(slotConfigs: SlotRow[], slotNo: number) {
  const row = slotConfigs.find((s) => s.slot_no === slotNo);
  return row?.weekday_name ?? `Slot ${slotNo}`;
}

export default function MerryDetailScreen() {
  const params = useLocalSearchParams();
  const merryId = useMemo(() => String(params?.merryId || ""), [params]);

  const [me, setMe] = useState<SessionUser | null>(null);
  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

  const [detail, setDetail] = useState<MerryDetail | null>(null);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [dues, setDues] = useState<MyDuesResponse | null>(null);

  const [periodKey, setPeriodKey] = useState(""); // admin optional input for ensure
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!merryId) return;

    try {
      setLoading(true);

      const u = await getSessionUser();
      setMe(u);

      // 1) Merry detail
      const d1 = await api.get(`/api/merry/${merryId}/`);
      setDetail(d1.data as MerryDetail);

      // 2) Slot config (public to member/admin)
      const d2 = await api.get(`/api/merry/${merryId}/slots/`);
      setSlots(Array.isArray(d2.data) ? (d2.data as SlotRow[]) : []);

      // 3) My dues (auto ensures dues per your backend)
      const d3 = await api.get(`/api/merry/${merryId}/dues/my/`);
      setDues(d3.data as MyDuesResponse);
    } catch (e: any) {
      Alert.alert("Merry", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [merryId]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
  }, [fetchAll]);

  const duesSummary = useMemo(() => {
    const rows = dues?.data ?? [];
    const bySlot: Record<number, { due: number; paid: number; out: number }> = {};
    for (const r of rows) {
      const s = Number(r.slot_no || 0);
      bySlot[s] = bySlot[s] || { due: 0, paid: 0, out: 0 };
      bySlot[s].due += toNum(r.due_amount);
      bySlot[s].paid += toNum(r.paid_amount);
      bySlot[s].out += toNum(r.outstanding);
    }
    const slotNos = Object.keys(bySlot)
      .map((x) => Number(x))
      .sort((a, b) => a - b);

    const totalDue = slotNos.reduce((acc, s) => acc + bySlot[s].due, 0);
    const totalPaid = slotNos.reduce((acc, s) => acc + bySlot[s].paid, 0);
    const totalOut = slotNos.reduce((acc, s) => acc + bySlot[s].out, 0);

    return { bySlot, slotNos, totalDue, totalPaid, totalOut };
  }, [dues]);

  const handleEnsureDues = useCallback(async () => {
    if (!merryId) return;
    try {
      const body = periodKey.trim() ? { period_key: periodKey.trim() } : {};
      const res = await api.post(`/api/merry/${merryId}/dues/ensure/`, body);
      Alert.alert("Dues", res?.data?.message || "Dues ensured.");
      setPeriodKey("");
      fetchAll();
    } catch (e: any) {
      Alert.alert("Dues", e?.response?.data?.detail || getErrorMessage(e));
    }
  }, [merryId, periodKey, fetchAll]);

  if (!merryId) {
    return (
      <View style={[styles.container, { padding: SPACING.lg }]}>
        <EmptyState title="Missing merryId" subtitle="Go back and open a merry again." />
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
        <View style={{ paddingVertical: 30 }}>
          <ActivityIndicator />
        </View>
      ) : !detail ? (
        <EmptyState title="Merry not found" subtitle="This merry may have been deleted or you don’t have access." />
      ) : (
        <>
          {/* Header */}
          <Card style={{ marginBottom: SPACING.lg }}>
            <View style={styles.headerTop}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.hTitle}>{detail.name}</Text>
                <Text style={styles.hSub}>
                  {fmtKES(detail.contribution_amount)} per seat • {detail.payout_frequency} • Slots:{" "}
                  {detail.payouts_per_period}
                </Text>
              </View>

              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{String(detail.payout_order_type || "").toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.kpiRow}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Members</Text>
                <Text style={styles.kpiValue}>{String(detail.members_count ?? 0)}</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Seats</Text>
                <Text style={styles.kpiValue}>{String(detail.seats_count ?? 0)}</Text>
              </View>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Expected pool / slot</Text>
              <Text style={styles.kvValue}>{fmtKES(detail.total_pool_per_slot)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Expected pool / period</Text>
              <Text style={styles.kvValue}>{fmtKES(detail.total_pool_per_period)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Next payout date</Text>
              <Text style={styles.kvValue}>{detail.next_payout_date ?? "—"}</Text>
            </View>

            <View style={styles.actionsRow}>
              <Button
                title="Contribute"
                onPress={() =>
                  router.push({
                    pathname: "/merry/contribute" as any,
                    params: { merryId: String(detail.id) },
                  })
                }
                style={{ flex: 1 }}
                leftIcon={<Ionicons name="cash-outline" size={18} color={COLORS.white} />}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Members"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: "/merry/members" as any,
                    params: { merryId: String(detail.id) },
                  })
                }
                style={{ flex: 1 }}
                leftIcon={<Ionicons name="people-outline" size={18} color={COLORS.dark} />}
              />
            </View>

            <View style={{ height: SPACING.sm }} />

            <Button
              title="Payout Schedule"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/merry/payouts-schedule" as any,
                  params: { merryId: String(detail.id) },
                })
              }
              leftIcon={<Ionicons name="calendar-outline" size={18} color={COLORS.dark} />}
            />
          </Card>

          {/* Slot config */}
          <Section title="Slot schedule">
            {slots.length === 0 ? (
              <EmptyState
                icon="calendar-outline"
                title="No slot config yet"
                subtitle="Admin can set slot weekdays (e.g., slot 1 Monday, slot 2 Friday)."
              />
            ) : (
              <Card>
                {Array.from({ length: Number(detail.payouts_per_period || 1) }).map((_, idx) => {
                  const slotNo = idx + 1;
                  return (
                    <View key={`slot-${slotNo}`} style={[styles.kvRow, idx === 0 ? { marginTop: 0 } : null]}>
                      <Text style={styles.kvLabel}>Slot {slotNo}</Text>
                      <Text style={styles.kvValue}>{weekdayFromConfig(slots, slotNo)}</Text>
                    </View>
                  );
                })}
              </Card>
            )}
          </Section>

          {/* My dues */}
          <Section
            title="My dues (current period)"
            right={
              dues?.period_key ? (
                <Text style={{ fontFamily: FONT.bold, color: COLORS.primary }}>
                  {dues.period_key}
                </Text>
              ) : null
            }
          >
            {!dues || (dues.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No dues yet"
                subtitle="If you recently joined, admin may need to generate dues for this period."
              />
            ) : (
              <>
                <Card style={{ marginBottom: SPACING.md }}>
                  <View style={styles.kpiRow}>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Total due</Text>
                      <Text style={styles.kpiValue}>{fmtKES(duesSummary.totalDue)}</Text>
                    </View>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Total paid</Text>
                      <Text style={styles.kpiValue}>{fmtKES(duesSummary.totalPaid)}</Text>
                    </View>
                    <View style={styles.kpiBox}>
                      <Text style={styles.kpiLabel}>Outstanding</Text>
                      <Text style={[styles.kpiValue, { color: duesSummary.totalOut > 0 ? COLORS.danger : COLORS.success }]}>
                        {fmtKES(duesSummary.totalOut)}
                      </Text>
                    </View>
                  </View>
                </Card>

                {duesSummary.slotNos.map((slotNo) => {
                  const s = duesSummary.bySlot[slotNo];
                  return (
                    <Card key={`slot-sum-${slotNo}`} style={{ marginBottom: SPACING.md }}>
                      <Text style={styles.slotTitle}>
                        Slot {slotNo} • {weekdayFromConfig(slots, slotNo)}
                      </Text>

                      <View style={styles.kvRow}>
                        <Text style={styles.kvLabel}>Due</Text>
                        <Text style={styles.kvValue}>{fmtKES(s.due)}</Text>
                      </View>
                      <View style={styles.kvRow}>
                        <Text style={styles.kvLabel}>Paid</Text>
                        <Text style={styles.kvValue}>{fmtKES(s.paid)}</Text>
                      </View>
                      <View style={styles.kvRow}>
                        <Text style={styles.kvLabel}>Outstanding</Text>
                        <Text style={[styles.kvValue, { color: s.out > 0 ? COLORS.danger : COLORS.success }]}>
                          {fmtKES(s.out)}
                        </Text>
                      </View>
                    </Card>
                  );
                })}
              </>
            )}
          </Section>

          {/* Admin tools */}
          {isAdmin ? (
            <Section title="Admin tools">
              <Card>
                <Text style={styles.note}>
                  Generate dues for all active seats for a period, moderate join requests, and create payout records.
                </Text>

                <View style={{ height: SPACING.sm }} />

                <Input
                  label="Ensure dues (optional period_key)"
                  value={periodKey}
                  onChangeText={setPeriodKey}
                  placeholder='Leave empty for current (e.g. "2026-W10" or "2026-03")'
                />

                <Button
                  title="Ensure dues now"
                  onPress={handleEnsureDues}
                  leftIcon={<Ionicons name="refresh-outline" size={18} color={COLORS.white} />}
                />

                <View style={{ height: SPACING.sm }} />

                <Button
                  title="Admin: Join Requests"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/merry/admin-join-requests" as any,
                      params: { merryId: String(detail.id) },
                    })
                  }
                  leftIcon={<Ionicons name="checkmark-done-outline" size={18} color={COLORS.dark} />}
                />

                <View style={{ height: SPACING.sm }} />

                <Button
                  title="Admin: Create Payout"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/merry/admin-payout-create" as any,
                      params: { merryId: String(detail.id) },
                    })
                  }
                  leftIcon={<Ionicons name="send-outline" size={18} color={COLORS.dark} />}
                />
              </Card>
            </Section>
          ) : null}

          <View style={{ height: 24 }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeText: { fontFamily: FONT.bold, fontSize: 11, color: COLORS.primary },

  kpiRow: { marginTop: SPACING.md, flexDirection: "row", gap: SPACING.sm },
  kpiBox: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kpiValue: { marginTop: 6, fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kvLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kvValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },

  actionsRow: { marginTop: SPACING.md, flexDirection: "row", alignItems: "center" },

  slotTitle: { fontFamily: FONT.bold, fontSize: 13, color: COLORS.dark, marginBottom: 8 },

  note: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray, lineHeight: 18 },
});