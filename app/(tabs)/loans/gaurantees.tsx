import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

/* =========================
   Types
========================= */
type LoanGuarantor = {
  id: number;
  loan: number;
  guarantor: number;

  accepted: boolean;
  accepted_at?: string | null;

  reserved_amount?: string;
};

/* =========================
   API
========================= */
async function getMyGuaranteeRequests(): Promise<LoanGuarantor[]> {
  const res = await api.get("/loans/guarantee/my-requests/");
  return res.data;
}

async function acceptGuarantee(id: number): Promise<{ message: string }> {
  const res = await api.patch(`/loans/guarantee/${id}/accept/`);
  return res.data;
}

async function rejectGuarantee(id: number): Promise<{ message: string }> {
  const res = await api.patch(`/loans/guarantee/${id}/reject/`);
  return res.data;
}

/* =========================
   Helpers
========================= */
function money(v?: string | number | null) {
  const n =
    typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n)) return "KES 0";
  const parts = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `KES ${parts}`;
}

export default function GuaranteesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<LoanGuarantor[]>([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyGuaranteeRequests();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await getMyGuaranteeRequests();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const pendingCount = useMemo(
    () => items.filter((x) => !x.accepted).length,
    [items]
  );

  const openLoan = (loanId: number) => {
  router.push({
    pathname: "/(tabs)/loans/[Id]",
    params: { Id: String(loanId) },
  });
};

  const renderItem = ({ item }: { item: LoanGuarantor }) => {
    const badgeBg = item.accepted ? COLORS.success : COLORS.accent;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Guarantee Request</Text>
            <Text style={styles.cardSub}>Request #{item.id}</Text>

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => openLoan(item.loan)}
              activeOpacity={0.9}
            >
              <Ionicons name="open-outline" size={16} color={COLORS.primary} />
              <Text style={styles.linkText}>Open Loan #{item.loan}</Text>
            </TouchableOpacity>

            {item.reserved_amount ? (
              <Text style={styles.cardSub}>
                Reserved:{" "}
                <Text style={{ fontWeight: "900" }}>
                  {money(item.reserved_amount)}
                </Text>
              </Text>
            ) : null}
          </View>

          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Text style={styles.badgeText}>
              {item.accepted ? "ACCEPTED" : "PENDING"}
            </Text>
          </View>
        </View>

        {!item.accepted ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: COLORS.success }]}
              activeOpacity={0.9}
              onPress={() => {
                Alert.alert(
                  "Accept guarantee?",
                  `You will guarantee Loan #${item.loan}. Your reserved savings may be locked until the loan completes.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Accept",
                      onPress: async () => {
                        try {
                          const res = await acceptGuarantee(item.id);
                          Alert.alert("Success", res.message || "Accepted.");
                          await onRefresh();
                        } catch (e: any) {
                          Alert.alert("Error", getErrorMessage(e));
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={18}
                color={COLORS.success}
              />
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: COLORS.danger }]}
              activeOpacity={0.9}
              onPress={() => {
                Alert.alert(
                  "Reject guarantee?",
                  `Reject guarantee request #${item.id}?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Reject",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          const res = await rejectGuarantee(item.id);
                          Alert.alert("Done", res.message || "Rejected.");
                          await onRefresh();
                        } catch (e: any) {
                          Alert.alert("Error", getErrorMessage(e));
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={COLORS.danger}
              />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>
                Reject
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.note}>
            Accepted. If the admin approves the loan, your reserved savings can be
            applied automatically.
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.dark} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Guarantees</Text>
          <Text style={styles.h2}>
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`
              : "No pending requests"}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.centerText}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 120 }}
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="shield-outline" size={28} color={COLORS.gray} />
              <Text style={styles.emptyText}>No guarantee requests yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark },
  h2: { marginTop: 2, fontSize: FONT.subtitle, color: COLORS.gray },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  centerText: { color: COLORS.gray },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
    gap: 10,
  },
  emptyText: { color: COLORS.gray },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    marginBottom: SPACING.md,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  cardTitle: { fontSize: FONT.section, fontWeight: "900", color: COLORS.dark },
  cardSub: { marginTop: 3, fontSize: 12, color: COLORS.gray },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: COLORS.white, fontWeight: "900", fontSize: 11 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  linkText: { color: COLORS.primary, fontWeight: "900" },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: "#F9FAFB",
  },
  actionText: { color: COLORS.dark, fontWeight: "900" },

  note: { marginTop: 10, color: COLORS.gray, fontSize: 12, lineHeight: 18 },
});