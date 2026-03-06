// app/(tabs)/merry/members.tsx
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

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

type MemberRow = {
  member_id: number;
  user_id: number;
  username: string | null;
  phone: string | null;
  joined_at: string;
  seats_count: number;
};

export default function MerryMembersScreen() {
  const params = useLocalSearchParams();
  const merryId = useMemo(() => String(params?.merryId || ""), [params]);

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!merryId) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/merry/${merryId}/members/`);
      setRows(Array.isArray(res.data) ? (res.data as MemberRow[]) : []);
    } catch (e: any) {
      Alert.alert("Members", e?.response?.data?.detail || getErrorMessage(e));
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

  const totalSeats = useMemo(() => {
    return rows.reduce((acc, r) => acc + Number(r.seats_count || 0), 0);
  }, [rows]);

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
      <Card style={{ marginBottom: SPACING.lg }}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>Members</Text>
            <Text style={styles.hSub}>
              {rows.length} member(s) • {totalSeats} seat(s)
            </Text>
          </View>
          <Ionicons name="people-outline" size={22} color={COLORS.primary} />
        </View>
      </Card>

      <Section
        title="Member list"
        right={
          <Text style={styles.smallRight}>Merry #{merryId}</Text>
        }
      >
        {loading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No members yet"
            subtitle="Once join requests are approved, members will appear here."
          />
        ) : (
          rows.map((m) => (
            <Card key={`m-${m.member_id}`} style={{ marginBottom: SPACING.md }}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.name}>{m.username || `User #${m.user_id}`}</Text>
                  <Text style={styles.meta}>
                    {m.phone ? `Phone: ${m.phone}` : "Phone: —"}
                  </Text>
                </View>

                <View style={styles.seatPill}>
                  <Ionicons name="albums-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.seatText}>{Number(m.seats_count || 0)} seat(s)</Text>
                </View>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Joined</Text>
                <Text style={styles.kvValue}>{m.joined_at ? String(m.joined_at) : "—"}</Text>
              </View>
            </Card>
          ))
        )}
      </Section>

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

  smallRight: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.primary },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  name: { fontFamily: FONT.bold, fontSize: 14, color: COLORS.dark },
  meta: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  seatPill: {
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
  seatText: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.primary },

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kvLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  kvValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },
});