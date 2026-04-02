import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  acceptGuarantee,
  getMyGuaranteeRequests,
  rejectGuarantee,
} from "@/services/loans";

function StatusPill({ accepted }: { accepted: any }) {
  const isAccepted = accepted === true;
  const isRejected = accepted === false;

  const bg = isAccepted
    ? "rgba(140,240,199,0.18)"
    : isRejected
    ? "rgba(220,53,69,0.18)"
    : "rgba(255,204,102,0.18)";

  const label = isAccepted ? "ACCEPTED" : isRejected ? "REJECTED" : "PENDING";

  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

export default function GuaranteeRequestsScreen() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      const res = await getMyGuaranteeRequests();
      setData(res || []);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [])
  );

  const handleAccept = async (id: number) => {
    try {
      setBusyId(id);
      await acceptGuarantee(id);
      await load();
    } catch (e) {
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setBusyId(id);
      await rejectGuarantee(id);
      await load();
    } catch (e) {
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#8CF0C7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.heroCard}>
          <View style={styles.heroGlowOne} />
          <View style={styles.heroGlowTwo} />
          <View style={styles.heroGlowThree} />

          <View style={styles.heroTop}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.heroTag}>COMMUNITY SUPPORT</Text>
              <Text style={styles.heroTitle}>Support requests</Text>
              <Text style={styles.heroSubtitle}>
                Review requests where members need your support.
              </Text>
            </View>

            <View style={styles.heroIconWrap}>
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={COLORS.white}
              />
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>All</Text>
              <Text style={styles.heroStatValue}>{data.length}</Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Pending</Text>
              <Text style={styles.heroStatValue}>
                {data.filter((g) => g.accepted == null).length}
              </Text>
            </View>

            <View style={styles.heroStatPill}>
              <Text style={styles.heroStatLabel}>Accepted</Text>
              <Text style={styles.heroStatValue}>
                {data.filter((g) => g.accepted === true).length}
              </Text>
            </View>
          </View>
        </View>

        <Section title="Guarantee requests">
          {data.length === 0 ? (
            <View style={styles.emptyHolder}>
              <EmptyState
                title="No requests"
                subtitle="You have no pending support requests."
              />
            </View>
          ) : (
            data.map((g) => {
              const isPending = g.accepted == null;
              const busy = busyId === g.id;

              return (
                <Card key={g.id} style={styles.card}>
                  <View style={styles.cardGlowPrimary} />
                  <View style={styles.cardGlowAccent} />

                  <View style={styles.cardTopRow}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name="people-outline"
                        size={18}
                        color="#0A6E8A"
                      />
                    </View>

                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>
                        Support request #{g.loan || "-"}
                      </Text>
                      <Text style={styles.cardSub}>
                        Member:{" "}
                        {g.borrower_detail?.full_name ||
                          g.guarantor_detail?.full_name ||
                          "User"}
                      </Text>
                    </View>

                    <StatusPill accepted={g.accepted} />
                  </View>

                  <View style={styles.infoBox}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Support ID</Text>
                      <Text style={styles.infoValue}>{g.loan || "-"}</Text>
                    </View>

                    <View style={styles.infoDivider} />

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Borrower</Text>
                      <Text style={styles.infoValue}>
                        {g.borrower_detail?.full_name ||
                          g.guarantor_detail?.full_name ||
                          "User"}
                      </Text>
                    </View>

                    <View style={styles.infoDivider} />

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={styles.infoValue}>
                        {g.accepted === true
                          ? "Accepted"
                          : g.accepted === false
                          ? "Rejected"
                          : "Pending"}
                      </Text>
                    </View>
                  </View>

                  {isPending && (
                    <View style={styles.actionsRow}>
                      <Button
                        title={busy ? "Please wait..." : "Accept"}
                        onPress={() => handleAccept(g.id)}
                        disabled={busy}
                        style={{ flex: 1 }}
                      />
                      <View style={{ width: 10 }} />
                      <Button
                        title="Reject"
                        variant="secondary"
                        onPress={() => handleReject(g.id)}
                        disabled={busy}
                        style={{ flex: 1 }}
                      />
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </Section>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  container: {
    flex: 1,
    backgroundColor: "#0C6A80",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C6A80",
  },

  backgroundBlobTop: {
    position: "absolute",
    top: -120,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backgroundBlobMiddle: {
    position: "absolute",
    top: 240,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
  },

  backgroundBlobBottom: {
    position: "absolute",
    bottom: -120,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  backgroundGlowOne: {
    position: "absolute",
    top: 120,
    right: 20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  backgroundGlowTwo: {
    position: "absolute",
    bottom: 160,
    left: 10,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(140,240,199,0.08)",
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: RADIUS.xl || RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    ...SHADOW.card,
  },

  heroGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  heroGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  heroGlowThree: {
    position: "absolute",
    right: 30,
    bottom: -16,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(12,192,183,0.10)",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  heroTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    color: "#DFFFE8",
    fontSize: 11,
    fontFamily: FONT.bold,
    marginBottom: 12,
  },

  heroTitle: {
    fontFamily: FONT.bold,
    fontSize: 20,
    color: "#FFFFFF",
  },

  heroSubtitle: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    color: "rgba(255,255,255,0.84)",
  },

  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroStatsRow: {
    flexDirection: "row",
    gap: SPACING.sm as any,
    marginTop: SPACING.lg,
  },

  heroStatPill: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },

  heroStatLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontFamily: FONT.regular,
  },

  heroStatValue: {
    marginTop: 4,
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: FONT.bold,
  },

  emptyHolder: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },

  card: {
    position: "relative",
    overflow: "hidden",
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: RADIUS.xl,
    ...SHADOW.card,
  },

  cardGlowPrimary: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 105,
    height: 105,
    borderRadius: 52.5,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  cardGlowAccent: {
    position: "absolute",
    bottom: -22,
    left: -18,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(236,251,255,0.08)",
  },

  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(236, 251, 255, 0.88)",
    marginRight: 12,
  },

  cardTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  cardTitle: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  cardSub: {
    marginTop: 4,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusPillText: {
    color: "#FFFFFF",
    fontFamily: FONT.bold,
    fontSize: 11,
  },

  infoBox: {
    marginTop: SPACING.md,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },

  infoRow: {
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  infoLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
});