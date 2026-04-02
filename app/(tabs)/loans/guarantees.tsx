import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  RefreshControl,
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
import { getErrorMessage } from "@/services/api";
import {
  acceptGuarantee,
  getApiErrorMessage,
  getMyGuaranteeRequests,
  LoanGuarantor,
  rejectGuarantee,
} from "@/services/loans";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad";
}) {
  const bg =
    tone === "ok"
      ? "rgba(140,240,199,0.18)"
      : tone === "bad"
      ? "rgba(220,53,69,0.18)"
      : "rgba(255,204,102,0.18)";

  const color = "#FFFFFF";

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function GuaranteeCard({
  item,
  onAccept,
  onReject,
  busy,
}: {
  item: LoanGuarantor;
  onAccept: () => void;
  onReject: () => void;
  busy?: boolean;
}) {
  const accepted = !!item.accepted;
  const guarantorName = item.guarantor_detail?.full_name || "Selected member";

  return (
    <Card style={styles.itemCard}>
      <View style={styles.cardGlowPrimary} />
      <View style={styles.cardGlowAccent} />

      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>Support request</Text>
          <Text style={styles.sub}>Requested for {guarantorName}</Text>
        </View>

        {accepted ? (
          <Pill label="ACCEPTED" tone="ok" />
        ) : (
          <Pill label="PENDING" tone="warn" />
        )}
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.label}>Support</Text>
          <Text style={styles.value}>Member support request</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Reserved</Text>
          <Text style={styles.value}>
            {formatKes(item.reserved_amount ?? "0.00")}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.label}>Accepted at</Text>
          <Text style={styles.value}>{formatDateTime(item.accepted_at)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Requested</Text>
          <Text style={styles.value}>{formatDateTime(item.created_at)}</Text>
        </View>
      </View>

      {item.request_note ? (
        <Text style={styles.note}>Request note: {item.request_note}</Text>
      ) : null}

      {accepted ? (
        <View style={styles.acceptedRow}>
          <Ionicons
            name="checkmark-circle-outline"
            size={18}
            color="#8CF0C7"
          />
          <Text style={styles.acceptedText}>Support accepted.</Text>

          <Text
            style={styles.link}
            onPress={() => router.push(`/(tabs)/loans/${item.loan}` as any)}
          >
            View support
          </Text>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <Button
            title="Accept"
            onPress={onAccept}
            loading={busy}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <View style={{ width: SPACING.sm }} />
          <Button
            title="Reject"
            variant="secondary"
            onPress={onReject}
            disabled={busy}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <Text style={styles.helpText}>
        Reserved amount is applied by the system at approval after support
        coverage is computed.
      </Text>
    </Card>
  );
}

export default function GuaranteesScreen() {
  const [items, setItems] = useState<LoanGuarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setError("");
      const data = await getMyGuaranteeRequests();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setItems([]);
      setError(getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const pending = useMemo(() => items.filter((x) => !x.accepted), [items]);
  const accepted = useMemo(() => items.filter((x) => x.accepted), [items]);

  const doAccept = useCallback(
    async (id: number) => {
      try {
        setBusyId(id);
        setError("");
        const res = await acceptGuarantee(id);
        Alert.alert("Success", res?.message || "Support accepted.");
        await load();
      } catch (e: any) {
        const msg = getApiErrorMessage(e) || getErrorMessage(e);
        setError(msg);
        Alert.alert("Accept support", msg);
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  const doReject = useCallback(
    async (id: number) => {
      try {
        setBusyId(id);
        setError("");
        const res = await rejectGuarantee(id);
        Alert.alert("Done", res?.message || "Support rejected.");
        await load();
      } catch (e: any) {
        const msg = getApiErrorMessage(e) || getErrorMessage(e);
        setError(msg);
        Alert.alert("Reject support", msg);
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
            colors={["#8CF0C7", "#0CC0B7"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backgroundBlobTop} />
        <View style={styles.backgroundBlobMiddle} />
        <View style={styles.backgroundBlobBottom} />
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />

        <View style={styles.header}>
          <View style={styles.headerGlowOne} />
          <View style={styles.headerGlowTwo} />

          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.headerTag}>MEMBER SUPPORT</Text>
            <Text style={styles.hTitle}>Support requests</Text>
            <Text style={styles.hSub}>
              Accept or reject requests to support a member.
            </Text>
          </View>

          <View style={styles.headerIconWrap}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={COLORS.white}
            />
          </View>
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : null}

        <Section title={`Pending (${pending.length})`}>
          {loading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : pending.length === 0 ? (
            <EmptyState
              title="No pending requests"
              subtitle="New requests will appear here."
            />
          ) : (
            pending.map((g) => (
              <GuaranteeCard
                key={g.id}
                item={g}
                busy={busyId === g.id}
                onAccept={() => doAccept(g.id)}
                onReject={() => doReject(g.id)}
              />
            ))
          )}
        </Section>

        <Section title={`Accepted (${accepted.length})`}>
          {!loading && accepted.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="No accepted support"
              subtitle="Accepted requests will appear here."
            />
          ) : (
            accepted.map((g) => (
              <GuaranteeCard
                key={g.id}
                item={g}
                busy={busyId === g.id}
                onAccept={() => {}}
                onReject={() => {}}
              />
            ))
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

  header: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: "rgba(49, 180, 217, 0.22)",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: "rgba(189, 244, 255, 0.15)",
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  headerGlowOne: {
    position: "absolute",
    right: -28,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.09)",
  },

  headerGlowTwo: {
    position: "absolute",
    left: -20,
    bottom: -26,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(236,251,255,0.10)",
  },

  headerTag: {
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

  headerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 20,
    color: "#FFFFFF",
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
    lineHeight: 18,
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: "rgba(255,255,255,0.78)",
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: RADIUS.lg,
    backgroundColor: "rgba(220,53,69,0.18)",
  },

  errorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  itemCard: {
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

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 18,
  },

  grid: {
    marginTop: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  cell: {
    width: "48%",
  },

  label: {
    fontFamily: FONT.regular,
    fontSize: 11,
    color: "rgba(255,255,255,0.72)",
  },

  value: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  actionsRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
  },

  acceptedRow: {
    marginTop: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  acceptedText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.84)",
  },

  link: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: "#8CF0C7",
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 18,
  },

  helpText: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 18,
  },

  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  pillText: {
    fontFamily: FONT.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});