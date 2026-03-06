// app/(tabs)/merry/join-requests.tsx
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

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

type JoinRequestRow = {
  id: number;
  merry_id: number;
  merry_name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  note: string;
  requested_seats: number;
  created_at: string;
  reviewed_at: string | null;
};

function statusColor(status: string) {
  const s = String(status || "").toUpperCase();
  if (s === "APPROVED") return COLORS.success;
  if (s === "REJECTED") return COLORS.danger;
  if (s === "CANCELLED") return COLORS.gray;
  return COLORS.accent; // pending
}

export default function MyJoinRequestsScreen() {
  const [rows, setRows] = useState<JoinRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const pendingCount = useMemo(
    () => rows.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
    [rows]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/merry/join/requests/my/");
      setRows(Array.isArray(res.data) ? (res.data as JoinRequestRow[]) : []);
    } catch (e: any) {
      Alert.alert("Join requests", e?.response?.data?.detail || getErrorMessage(e));
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

  const cancel = useCallback(
    async (id: number) => {
      try {
        const res = await api.post(`/api/merry/join/requests/${id}/cancel/`, {});
        Alert.alert("Join request", res?.data?.message || "Cancelled.");
        load();
      } catch (e: any) {
        Alert.alert("Join request", e?.response?.data?.detail || getErrorMessage(e));
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
            <Text style={styles.hTitle}>My Join Requests</Text>
            <Text style={styles.hSub}>
              Track your requests across all merries • Pending: {pendingCount}
            </Text>
          </View>
          <Ionicons name="time-outline" size={22} color={COLORS.primary} />
        </View>
      </Card>

      <Section
        title="Requests"
        right={
          <Button
            title="Go to Merries"
            variant="secondary"
            onPress={() => router.push("/merry" as any)}
            leftIcon={<Ionicons name="home-outline" size={18} color={COLORS.dark} />}
          />
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="information-circle-outline"
            title="No requests yet"
            subtitle="Open a merry and tap Join to submit your request."
          />
        ) : (
          rows.map((r) => {
            const st = String(r.status || "").toUpperCase();
            const canCancel = st === "PENDING";

            return (
              <Card key={`jr-${r.id}`} style={{ marginBottom: SPACING.md }}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.name}>{r.merry_name}</Text>
                    <Text style={styles.meta}>Seats requested: {Number(r.requested_seats || 0)}</Text>
                  </View>

                  <View style={[styles.statusPill, { borderColor: statusColor(st) }]}>
                    <Text style={[styles.statusText, { color: statusColor(st) }]}>{st}</Text>
                  </View>
                </View>

                {!!r.note ? (
                  <View style={[styles.noteBox, { marginTop: SPACING.sm }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.gray} />
                    <Text style={styles.noteText}>{r.note}</Text>
                  </View>
                ) : null}

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Created</Text>
                  <Text style={styles.kvValue}>{r.created_at ? String(r.created_at) : "—"}</Text>
                </View>

                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Reviewed</Text>
                  <Text style={styles.kvValue}>{r.reviewed_at ? String(r.reviewed_at) : "—"}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <Button
                    title="Open Merry"
                    variant="secondary"
                    onPress={() =>
                      router.push({
                        pathname: "/merry/[merryId]" as any,
                        params: { merryId: String(r.merry_id) },
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={<Ionicons name="open-outline" size={18} color={COLORS.dark} />}
                  />
                  <View style={{ width: SPACING.sm }} />
                  <Button
                    title="Cancel"
                    variant="danger"
                    disabled={!canCancel}
                    onPress={() => cancel(r.id)}
                    style={{ flex: 1 }}
                    leftIcon={<Ionicons name="close-circle-outline" size={18} color={COLORS.white} />}
                  />
                </View>

                {!canCancel ? (
                  <Text style={styles.hint}>
                    Only pending requests can be cancelled.
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.white,
    borderWidth: 1,
  },
  statusText: { fontFamily: FONT.bold, fontSize: 11 },

  noteBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  noteText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

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
  },
});