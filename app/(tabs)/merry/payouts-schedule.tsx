// app/(tabs)/merry/payouts-schedule.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { fmtKES } from "@/services/merry";
import { getSessionUser, SessionUser } from "@/services/session";

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

type SlotConfigRow = {
  slot_no: number;
  weekday: number;
  weekday_name: string;
};

function slotName(slotConfigs: SlotConfigRow[], slotNo: number) {
  const row = slotConfigs.find((s) => s.slot_no === slotNo);
  return row?.weekday_name ? `Slot ${slotNo} • ${row.weekday_name}` : `Slot ${slotNo}`;
}

function getMerryPalette() {
  return {
    card: "rgba(98, 192, 98, 0.23)",
    border: "rgba(194, 255, 188, 0.16)",
    iconBg: "rgba(236, 255, 235, 0.76)",
    icon: "#379B4A",
    chip: "rgba(255,255,255,0.14)",
    amountBg: "rgba(255,255,255,0.10)",
    soft: "rgba(98, 192, 98, 0.08)",
  };
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

  const palette = getMerryPalette();

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
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={30} color="#74D16C" />
          <Text style={styles.emptyTitle}>Missing merry</Text>
          <Text style={styles.emptySubtitle}>Go back and open a merry again.</Text>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.emptyButton}
            onPress={() => router.back()}
          >
            <Text style={styles.emptyButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
              <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.brandWordmark}>Payout Schedule</Text>
              <Text style={styles.brandSub}>Merry circle schedule and payout order</Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: "/merry/[merryId]" as any,
                params: { merryId },
              })
            }
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!loading && !schedule ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="albums-outline" size={30} color="#74D16C" />
            <Text style={styles.emptyTitle}>Schedule not available</Text>
            <Text style={styles.emptySubtitle}>You may not have access to this merry.</Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                },
              ]}
            >
              <View style={styles.heroOrbOne} />
              <View style={styles.heroOrbTwo} />
              <View style={styles.heroOrbThree} />

              <Text style={styles.heroTag}>MERRY PAYOUTS</Text>
              <Text style={styles.heroTitle}>
                {schedule?.merry?.name || "Payout Schedule"}
              </Text>
              <Text style={styles.heroCaption}>
                Period {periodKey}. Keep the order and payout slots clear for all members.
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.heroPill}>
                  <Ionicons name="repeat-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.heroPillText}>
                    {String(schedule?.merry?.payout_frequency || "—")}
                  </Text>
                </View>

                <View style={styles.heroPill}>
                  <Ionicons name="grid-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.heroPillText}>
                    {String(schedule?.merry?.payouts_per_period || 1)} slots
                  </Text>
                </View>

                <View style={styles.heroPill}>
                  <Ionicons name="people-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.heroPillText}>
                    {String(schedule?.merry?.seats_count || 0)} seats
                  </Text>
                </View>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Contribution per slot</Text>
                  <Text style={styles.summaryValue}>
                    {schedule?.merry?.contribution_amount
                      ? fmtKES(schedule.merry.contribution_amount)
                      : "—"}
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>Order type</Text>
                  <Text style={styles.summaryValue}>
                    {String(schedule?.merry?.payout_order_type || "—").toUpperCase()}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() =>
                  router.push({
                    pathname: "/merry/[merryId]" as any,
                    params: { merryId },
                  })
                }
                style={styles.primaryAction}
              >
                <Ionicons name="chevron-back-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>Back to Merry</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Slots this period</Text>
            <View style={styles.noticeWrap}>
              {slotCards.map((s) => (
                <View
                  key={`slot-${s.slotNo}`}
                  style={[
                    styles.groupShortcutCard,
                    {
                      backgroundColor: s.used
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(98, 192, 98, 0.20)",
                      borderColor: s.used
                        ? "rgba(255,255,255,0.10)"
                        : "rgba(194, 255, 188, 0.16)",
                    },
                  ]}
                >
                  <View style={styles.slotRow}>
                    <View
                      style={[
                        styles.groupShortcutIcon,
                        {
                          backgroundColor: s.used
                            ? "rgba(255,255,255,0.88)"
                            : palette.iconBg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={s.used ? "checkmark-done-outline" : "time-outline"}
                        size={20}
                        color={s.used ? "#0C6A80" : palette.icon}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupShortcutTitle}>{s.label}</Text>
                      <Text style={styles.groupShortcutSubtitle}>
                        {s.used
                          ? "Payout already created for this slot."
                          : "Available for payout creation."}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusChip,
                        {
                          backgroundColor: s.used
                            ? "rgba(255,255,255,0.12)"
                            : "rgba(255,255,255,0.16)",
                          borderColor: s.used
                            ? "rgba(255,255,255,0.10)"
                            : "rgba(194, 255, 188, 0.18)",
                        },
                      ]}
                    >
                      <Text style={styles.statusChipText}>{s.used ? "USED" : "OPEN"}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Seats order</Text>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>
                  {String(schedule?.merry?.payout_order_type || "").toUpperCase()}
                </Text>
              </View>
            </View>

            {!loading && schedule?.seats?.length === 0 ? (
              <View style={styles.emptyPanel}>
                <Ionicons name="albums-outline" size={28} color="#74D16C" />
                <Text style={styles.emptyPanelTitle}>No seats</Text>
                <Text style={styles.emptyPanelSubtitle}>
                  Seats appear after join requests are approved.
                </Text>
              </View>
            ) : (
              <View style={styles.groupShortcutList}>
                {(schedule?.seats || []).map((s) => (
                  <View key={`seat-${s.seat_id}`} style={styles.groupShortcutCard}>
                    <View style={styles.groupShortcutTop}>
                      <View style={styles.groupShortcutIcon}>
                        <Ionicons name="person-outline" size={22} color="#0A6E8A" />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.groupShortcutTitle}>
                          {s.username || `User #${s.user_id}`}
                        </Text>
                        <Text style={styles.groupShortcutSubtitle}>
                          Seat #{s.seat_no} • {s.phone ? `Phone: ${s.phone}` : "Phone: —"}
                        </Text>
                      </View>

                      <View style={styles.positionPill}>
                        <Ionicons name="trophy-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.positionText}>
                          {s.payout_position ? `#${s.payout_position}` : "—"}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.groupShortcutValue}>
                      Payout position {s.payout_position ? `#${s.payout_position}` : "not set"}
                    </Text>

                    {isAdmin ? (
                      <View style={styles.groupShortcutActions}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() =>
                            router.push({
                              pathname: "/merry/admin-payout-create" as any,
                              params: {
                                merryId: String(schedule?.merry?.id),
                                seatId: String(s.seat_id),
                              },
                            })
                          }
                          style={[styles.groupShortcutBtn, styles.groupShortcutBtnPrimary]}
                        >
                          <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                          <Text
                            style={[
                              styles.groupShortcutBtnText,
                              styles.groupShortcutBtnTextPrimary,
                            ]}
                          >
                            Create payout
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#062C49",
  },

  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
    position: "relative",
  },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#062C49",
  },

  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
  },

  emptySubtitle: {
    color: "rgba(255,255,255,0.75)",
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
  },

  emptyButton: {
    marginTop: 16,
    backgroundColor: "#0C6A80",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },

  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -60,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(19, 195, 178, 0.10)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 260,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(52, 174, 213, 0.08)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: 80,
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(112, 208, 115, 0.09)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 100,
    left: 40,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.45)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    top: 180,
    right: 60,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xs,
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  brandWordmark: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.3,
  },

  brandSub: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    marginTop: 2,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },

  heroOrbOne: {
    position: "absolute",
    right: -36,
    top: -20,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(38, 208, 214, 0.18)",
  },

  heroOrbTwo: {
    position: "absolute",
    left: -12,
    bottom: -35,
    width: 145,
    height: 145,
    borderRadius: 999,
    backgroundColor: "rgba(42, 206, 180, 0.16)",
  },

  heroOrbThree: {
    position: "absolute",
    right: 60,
    bottom: -55,
    width: 210,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(102, 212, 109, 0.15)",
  },

  heroTag: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 34,
    fontWeight: "900",
    marginTop: 12,
  },

  heroCaption: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    maxWidth: "95%",
    fontWeight: "600",
  },

  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },

  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  heroPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },

  summaryValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 8,
  },

  primaryAction: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#197D71",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },

  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 2,
  },

  orderBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },

  orderBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },

  noticeWrap: {
    gap: 10,
    marginBottom: SPACING.lg,
  },

  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },

  statusChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  emptyPanel: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },

  emptyPanelTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },

  emptyPanelSubtitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },

  groupShortcutList: {
    gap: 0,
  },

  groupShortcutCard: {
    position: "relative",
    overflow: "hidden",
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(49, 180, 217, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.14)",
  },

  groupShortcutTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  groupShortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
  },

  groupShortcutTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  groupShortcutSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    lineHeight: 18,
  },

  groupShortcutValue: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
  },

  groupShortcutActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },

  groupShortcutBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  groupShortcutBtnPrimary: {
    backgroundColor: "#197D71",
  },

  groupShortcutBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },

  groupShortcutBtnTextPrimary: {
    color: "#FFFFFF",
  },

  positionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  positionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});