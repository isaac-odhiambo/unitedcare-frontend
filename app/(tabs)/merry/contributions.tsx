// app/(tabs)/merry/contributions.tsx
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

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { fmtKES } from "@/services/merry";
import { getSessionUser, SessionUser } from "@/services/session";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

type PaymentRow = {
  id: number;
  merry_id: number;
  merry_name: string;
  beneficiary_member_id: number;
  amount: string;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED" | string;
  paid_at: string | null;
  payer_phone: string;
  mpesa_receipt_number: string | null;
  period_key: string;
  created_at: string;
};

function statusMeta(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMED") return { label: "CONFIRMED", color: COLORS.success, icon: "checkmark-circle-outline" as const };
  if (s === "FAILED") return { label: "FAILED", color: COLORS.danger, icon: "close-circle-outline" as const };
  if (s === "CANCELLED") return { label: "CANCELLED", color: COLORS.gray, icon: "ban-outline" as const };
  return { label: "PENDING", color: COLORS.accent, icon: "time-outline" as const };
}

export default function MerryContributionsScreen() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const totals = useMemo(() => {
    const total = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const confirmed = rows
      .filter((r) => String(r.status).toUpperCase() === "CONFIRMED")
      .reduce((acc, r) => acc + Number(r.amount || 0), 0);
    return { total, confirmed };
  }, [rows]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const u = await getSessionUser();
      setMe(u);

      const res = await api.get("/api/merry/payments/my/");
      setRows(Array.isArray(res.data) ? (res.data as PaymentRow[]) : []);
    } catch (e: any) {
      Alert.alert("Payments", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  const confirmDev = useCallback(
    async (paymentId: number) => {
      try {
        // Dev helper: admin confirms payment then allocation happens backend-side
        const res = await api.post(`/api/merry/payments/${paymentId}/confirm/`, {
          mpesa_receipt_number: "",
        });
        Alert.alert("Payment", res?.data?.message || "Confirmed.");
        load();
      } catch (e: any) {
        Alert.alert("Payment", e?.response?.data?.detail || getErrorMessage(e));
      }
    },
    [load]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Card style={{ marginBottom: SPACING.lg }}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>My Payments</Text>
            <Text style={styles.hSub}>
              Total: {fmtKES(totals.total)} • Confirmed: {fmtKES(totals.confirmed)}
            </Text>
          </View>
          <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
        </View>

        <View style={{ height: SPACING.sm }} />

        <Button
          title="Go to Merries"
          variant="secondary"
          onPress={() => router.push("/merry" as any)}
          leftIcon={<Ionicons name="home-outline" size={18} color={COLORS.dark} />}
        />
      </Card>

      <Section title="Payments history">
        {loading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="No payments yet"
            subtitle="Open a merry and contribute via STK to see payments here."
          />
        ) : (
          rows.map((p) => {
            const sm = statusMeta(p.status);
            return (
              <Card key={`p-${p.id}`} style={{ marginBottom: SPACING.md }}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.name}>{p.merry_name}</Text>
                    <Text style={styles.meta}>
                      Amount: {fmtKES(p.amount)} • Period: {p.period_key}
                    </Text>
                  </View>

                  <View style={[styles.statusPill, { borderColor: sm.color }]}>
                    <Ionicons name={sm.icon} size={14} color={sm.color} />
                    <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
                  </View>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Payment ID</Text>
                  <Text style={styles.kvValue}>#{p.id}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Payer phone</Text>
                  <Text style={styles.kvValue}>{p.payer_phone || "—"}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Receipt</Text>
                  <Text style={styles.kvValue}>{p.mpesa_receipt_number || "—"}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Created</Text>
                  <Text style={styles.kvValue}>{p.created_at ? String(p.created_at) : "—"}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Paid at</Text>
                  <Text style={styles.kvValue}>{p.paid_at ? String(p.paid_at) : "—"}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title="Open Merry"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/merry/[merryId]" as any,
                        params: { merryId: String(p.merry_id) },
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={<Ionicons name="open-outline" size={18} color={COLORS.dark} />}
                  />

                  {isAdmin ? (
                    <>
                      <View style={{ width: SPACING.sm }} />
                      <Button
                        title="Confirm (Dev)"
                        variant="primary"
                        onPress={() => confirmDev(p.id)}
                        style={{ flex: 1 }}
                        leftIcon={<Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />}
                      />
                    </>
                  ) : null}
                </View>

                {!isAdmin ? (
                  <Text style={styles.hint}>
                    Payments become CONFIRMED after Mpesa callback. If still PENDING, wait or contact admin.
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}
      </Section>

      <View style={{ height: 24 }} />
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

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },
  meta: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
  },
  statusText: { fontFamily: FONT.bold, fontSize: 11 },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kvLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kvValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },

  actionsRow: { marginTop: SPACING.md, flexDirection: "row", alignItems: "center" },

  hint: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },
});