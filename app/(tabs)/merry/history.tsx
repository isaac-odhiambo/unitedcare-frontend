import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { fmtKES, getMyMerries, MyMerriesResponse } from "@/services/merry";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

type MyDuesResp = {
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

function pillColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "PAID") return COLORS.success;
  if (s === "PARTIAL") return COLORS.warning;
  if (s === "CANCELLED") return COLORS.gray;
  return COLORS.accent; // PENDING
}

export default function MerryHistoryScreen() {
  const insets = useSafeAreaInsets();

  const [merries, setMerries] = useState<MyMerriesResponse | null>(null);
  const [selectedMerryId, setSelectedMerryId] = useState<string>("");

  const [periodKey, setPeriodKey] = useState<string>(""); // optional; backend defaults current
  const [dues, setDues] = useState<MyDuesResp | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingDues, setFetchingDues] = useState(false);

  const membershipOptions = useMemo(() => {
    const memberships = merries?.memberships || [];
    return memberships.map((m) => ({ id: String(m.merry_id), name: m.name }));
  }, [merries]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyMerries();
      setMerries(res);

      // auto-select first membership
      const first = res?.memberships?.[0];
      if (first && !selectedMerryId) setSelectedMerryId(String(first.merry_id));
    } catch (e: any) {
      Alert.alert("History", getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMerryId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const fetchMyDues = useCallback(async () => {
    if (!selectedMerryId) {
      Alert.alert("History", "Select a merry first.");
      return;
    }

    try {
      setFetchingDues(true);
      const qs = periodKey.trim() ? `?period_key=${encodeURIComponent(periodKey.trim())}` : "";
      const res = await api.get(`/api/merry/${selectedMerryId}/dues/my/${qs}`);
      setDues(res.data as MyDuesResp);
    } catch (e: any) {
      Alert.alert("History", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setFetchingDues(false);
    }
  }, [selectedMerryId, periodKey]);

  // auto-fetch when a merry is selected
  useFocusEffect(
    useCallback(() => {
      if (selectedMerryId) fetchMyDues();
    }, [selectedMerryId, fetchMyDues])
  );

  const totals = useMemo(() => {
    const rows = dues?.data || [];
    const dueTotal = rows.reduce((a, r) => a + Number(r.due_amount || 0), 0);
    const paidTotal = rows.reduce((a, r) => a + Number(r.paid_amount || 0), 0);
    const outTotal = rows.reduce((a, r) => a + Number(r.outstanding || 0), 0);
    return { dueTotal, paidTotal, outTotal };
  }, [dues]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 32) },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ marginBottom: SPACING.lg }}>
          <View style={styles.header}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.hTitle}>Contribution History</Text>
              <Text style={styles.hSub}>Shows your dues status per slot & seat (PAID/PARTIAL/PENDING).</Text>
            </View>
            <Ionicons name="time-outline" size={22} color={COLORS.primary} />
          </View>

          <View style={{ height: SPACING.md }} />

          <Button
            title="My Payments"
            variant="secondary"
            onPress={() => router.push("/merry/contributions" as any)}
            leftIcon={<Ionicons name="receipt-outline" size={18} color={COLORS.dark} />}
          />
        </Card>

        <Section title="Pick Merry & Period">
          {loading ? (
            <Card>
              <View style={styles.loader}>
                <ActivityIndicator color={COLORS.primary} />
              </View>
            </Card>
          ) : membershipOptions.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No memberships"
              subtitle="Join a merry first, then your dues history will show here."
            />
          ) : (
            <Card>
              <View style={styles.pickerRow}>
                <Text style={styles.pickerLabel}>Selected Merry</Text>
                <View style={styles.pickerButtons}>
                  {membershipOptions.slice(0, 3).map((m) => (
                    <Button
                      key={m.id}
                      title={m.name.length > 10 ? m.name.slice(0, 10) + "…" : m.name}
                      variant={selectedMerryId === m.id ? "primary" : "secondary"}
                      onPress={() => setSelectedMerryId(m.id)}
                      style={{ flex: 1 }}
                    />
                  ))}
                </View>
                {membershipOptions.length > 3 ? (
                  <Text style={styles.hint}>
                    You have more than 3 merries. You can extend this picker or make a dedicated select screen.
                  </Text>
                ) : null}
              </View>

              <Input
                label="Period key (optional)"
                value={periodKey}
                onChangeText={setPeriodKey}
                placeholder='Leave blank for current (e.g. "2026-W10" or "2026-03")'
              />

              <Button
                title={fetchingDues ? "Loading..." : "Load Dues"}
                onPress={fetchMyDues}
                loading={fetchingDues}
                leftIcon={<Ionicons name="refresh-outline" size={18} color={COLORS.white} />}
              />
            </Card>
          )}
        </Section>

        {dues ? (
          <Section title="Summary">
            <Card>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Period</Text>
                <Text style={styles.kvValue}>{dues.period_key}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Total due</Text>
                <Text style={styles.kvValue}>{fmtKES(totals.dueTotal)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Total paid</Text>
                <Text style={styles.kvValue}>{fmtKES(totals.paidTotal)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Outstanding</Text>
                <Text style={[styles.kvValue, { color: totals.outTotal > 0 ? COLORS.danger : COLORS.success }]}>
                  {fmtKES(totals.outTotal)}
                </Text>
              </View>
            </Card>
          </Section>
        ) : null}

        <Section title="Dues (slot → seat)">
          {!dues ? (
            <EmptyState icon="albums-outline" title="No dues loaded" subtitle="Pick a merry and load dues." />
          ) : dues.data.length === 0 ? (
            <EmptyState icon="albums-outline" title="No dues rows" subtitle="Admin may not have generated dues yet." />
          ) : (
            dues.data.map((d) => {
              const c = pillColor(d.status);
              return (
                <Card key={`due-${d.due_id}`} style={{ marginBottom: SPACING.md }}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.title}>
                        Slot {d.slot_no} • Seat #{d.seat_no}
                      </Text>
                      <Text style={styles.sub}>
                        Due: {fmtKES(d.due_amount)} • Paid: {fmtKES(d.paid_amount)} • Outstanding: {fmtKES(d.outstanding)}
                      </Text>
                    </View>

                    <View style={[styles.pill, { borderColor: c }]}>
                      <Text style={[styles.pillText, { color: c }]}>{String(d.status).toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Updated</Text>
                    <Text style={styles.kvValue}>{d.updated_at ? String(d.updated_at) : "—"}</Text>
                  </View>
                </Card>
              );
            })
          )}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  loader: { paddingVertical: SPACING.md, alignItems: "center" },

  pickerRow: { marginBottom: SPACING.md },
  pickerLabel: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark, marginBottom: SPACING.sm },
  pickerButtons: { flexDirection: "row", gap: SPACING.sm },

  hint: { marginTop: 8, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray, lineHeight: 18 },

  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  title: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },
  sub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
  },
  pillText: { fontFamily: FONT.bold, fontSize: 11 },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kvLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kvValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },
});