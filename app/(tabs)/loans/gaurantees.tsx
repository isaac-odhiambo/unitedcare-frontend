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
      ? "rgba(46, 125, 50, 0.12)"
      : tone === "bad"
      ? "rgba(211, 47, 47, 0.12)"
      : "rgba(242, 140, 40, 0.14)";

  const color =
    tone === "ok"
      ? COLORS.success
      : tone === "bad"
      ? COLORS.danger
      : COLORS.accent;

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
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>Guarantee Request</Text>
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
          <Text style={styles.label}>Loan</Text>
          <Text style={styles.value}>Loan request</Text>
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
            color={COLORS.success}
          />
          <Text style={styles.acceptedText}>Guarantee accepted.</Text>

          <Text
            style={styles.link}
            onPress={() => router.push(`/(tabs)/loans/${item.loan}` as any)}
          >
            View Loan
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
        Reserved amount is applied by the system at loan approval after security
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
        Alert.alert("Success", res?.message || "Guarantee accepted.");
        await load();
      } catch (e: any) {
        const msg = getApiErrorMessage(e) || getErrorMessage(e);
        setError(msg);
        Alert.alert("Accept Guarantee", msg);
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
        Alert.alert("Done", res?.message || "Guarantee rejected.");
        await load();
      } catch (e: any) {
        const msg = getApiErrorMessage(e) || getErrorMessage(e);
        setError(msg);
        Alert.alert("Reject Guarantee", msg);
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>Guarantee Requests</Text>
            <Text style={styles.hSub}>
              Accept or reject requests to guarantee a loan.
            </Text>
          </View>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.primary}
          />
        </View>

        {error ? (
          <Card style={styles.errorCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger}
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
              title="No accepted guarantees"
              subtitle="Accepted guarantees will appear here."
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
    backgroundColor: COLORS.background,
  },

  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  hTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  hSub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  muted: {
    marginTop: 6,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  errorCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  errorText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  itemCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOW.card,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
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
    color: COLORS.gray,
  },

  value: {
    marginTop: 6,
    fontFamily: FONT.bold,
    fontSize: 13,
    color: COLORS.dark,
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
    color: COLORS.gray,
  },

  link: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.primary,
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  helpText: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
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