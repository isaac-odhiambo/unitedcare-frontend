// app/(tabs)/merry/create.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { api, getErrorMessage } from "@/services/api";
import { getSessionUser, SessionUser } from "@/services/session";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

type Frequency = "WEEKLY" | "MONTHLY";

function toInt(x: string, fallback = 0) {
  const n = parseInt(String(x || "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toMoneyStr(x: string) {
  // allow "1000", "1000.50"
  const t = String(x || "").trim();
  if (!t) return "";
  const n = Number(t);
  if (!Number.isFinite(n)) return "";
  if (n <= 0) return "";
  return String(n);
}

export default function CreateMerryScreen() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const isAdmin = useMemo(() => {
    return !!me?.is_admin || String((me as any)?.role || "").toLowerCase() === "admin";
  }, [me]);

  // form
  const [name, setName] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [cycleWeeks, setCycleWeeks] = useState("1");
  const [payoutOrderType, setPayoutOrderType] = useState<"manual" | "random">("manual");
  const [payoutFrequency, setPayoutFrequency] = useState<Frequency>("WEEKLY");
  const [payoutsPerPeriod, setPayoutsPerPeriod] = useState("1");
  const [nextPayoutDate, setNextPayoutDate] = useState(""); // optional YYYY-MM-DD

  // ✅ added
  const [isOpen, setIsOpen] = useState(true);
  const [maxSeats, setMaxSeats] = useState("0"); // 0 = unlimited

  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const u = await getSessionUser();
          setMe(u);
        } catch {
          // ignore
        }
      })();
    }, [])
  );

  const validate = useCallback(() => {
    const cleanName = name.trim();
    if (!cleanName) return "Name is required.";

    const amt = Number(contributionAmount);
    if (!Number.isFinite(amt) || amt <= 0) return "Contribution amount must be a valid number > 0.";

    const cw = toInt(cycleWeeks, 1);
    if (cw < 1 || cw > 520) return "Cycle weeks must be between 1 and 520.";

    const pp = toInt(payoutsPerPeriod, 1);
    if (pp < 1 || pp > 14) return "Payouts per period must be between 1 and 14.";

    const ms = toInt(maxSeats, 0);
    if (ms < 0) return "Max seats cannot be negative.";

    if (nextPayoutDate.trim()) {
      // very light validation (backend will validate too)
      const v = nextPayoutDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Next payout date must be YYYY-MM-DD (or leave empty).";
    }

    return null;
  }, [name, contributionAmount, cycleWeeks, payoutsPerPeriod, maxSeats, nextPayoutDate]);

  const handleSubmit = useCallback(async () => {
    const err = validate();
    if (err) {
      Alert.alert("Create Merry", err);
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        name: name.trim(),
        contribution_amount: toMoneyStr(contributionAmount),
        cycle_duration_weeks: toInt(cycleWeeks, 1),
        payout_order_type: payoutOrderType,
        payout_frequency: payoutFrequency,
        payouts_per_period: toInt(payoutsPerPeriod, 1),
        next_payout_date: nextPayoutDate.trim() ? nextPayoutDate.trim() : null,

        // ✅ added
        is_open: isOpen,
        max_seats: toInt(maxSeats, 0),
      };

      const res = await api.post("/api/merry/create/", payload);

      const createdId = res?.data?.id;
      Alert.alert("Success", "Merry created successfully.");

      if (createdId) {
        router.replace(`/merry/${createdId}` as any);
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Create Merry", e?.response?.data?.detail || getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    validate,
    name,
    contributionAmount,
    cycleWeeks,
    payoutOrderType,
    payoutFrequency,
    payoutsPerPeriod,
    nextPayoutDate,
    isOpen,
    maxSeats,
  ]);

  if (me && !isAdmin) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin only"
          subtitle="Only admins can create a Merry."
        />
        <View style={{ height: SPACING.lg }} />
        <Button title="Go back" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card style={{ marginBottom: SPACING.lg }}>
        <View style={styles.header}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.hTitle}>Create Merry</Text>
            <Text style={styles.hSub}>Set contribution per seat and slot schedule settings.</Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
        </View>
      </Card>

      <Section title="Merry details">
        <Card>
          <Input
            label="Merry name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. United Care Monday Group"
          />

          <Input
            label="Contribution amount (per seat per slot)"
            value={contributionAmount}
            onChangeText={setContributionAmount}
            placeholder="e.g. 1000"
            keyboardType="decimal-pad"
          />

          <Input
            label="Cycle duration weeks (optional)"
            value={cycleWeeks}
            onChangeText={setCycleWeeks}
            placeholder="1"
            keyboardType="number-pad"
          />

          <Input
            label="Next payout date (optional)"
            value={nextPayoutDate}
            onChangeText={setNextPayoutDate}
            placeholder="YYYY-MM-DD"
          />
        </Card>
      </Section>

      <Section title="Payout configuration">
        <Card>
          <Text style={styles.label}>Payout order type</Text>
          <View style={styles.pillsRow}>
            <Button
              title="Manual"
              variant={payoutOrderType === "manual" ? "primary" : "secondary"}
              onPress={() => setPayoutOrderType("manual")}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Random"
              variant={payoutOrderType === "random" ? "primary" : "secondary"}
              onPress={() => setPayoutOrderType("random")}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ height: SPACING.md }} />

          <Text style={styles.label}>Payout frequency</Text>
          <View style={styles.pillsRow}>
            <Button
              title="Weekly"
              variant={payoutFrequency === "WEEKLY" ? "primary" : "secondary"}
              onPress={() => setPayoutFrequency("WEEKLY")}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Monthly"
              variant={payoutFrequency === "MONTHLY" ? "primary" : "secondary"}
              onPress={() => setPayoutFrequency("MONTHLY")}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ height: SPACING.md }} />

          <Input
            label="Payouts per period (slots)"
            value={payoutsPerPeriod}
            onChangeText={setPayoutsPerPeriod}
            placeholder="1"
            keyboardType="number-pad"
          />

          <View style={styles.helperBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.gray} />
            <Text style={styles.helperText}>
              Example: WEEKLY + payouts per period = 2 means Slot 1 (e.g. Monday) and Slot 2 (e.g. Friday).
              After creating, set the weekdays under Slot Config in the Merry detail screen.
            </Text>
          </View>
        </Card>
      </Section>

      {/* ✅ added */}
      <Section title="Joining settings">
        <Card>
          <Text style={styles.label}>Open for joining</Text>
          <View style={styles.pillsRow}>
            <Button
              title="Open"
              variant={isOpen ? "primary" : "secondary"}
              onPress={() => setIsOpen(true)}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Closed"
              variant={!isOpen ? "primary" : "secondary"}
              onPress={() => setIsOpen(false)}
              style={{ flex: 1 }}
            />
          </View>

          <View style={{ height: SPACING.md }} />

          <Input
            label="Max seats (0 = unlimited)"
            value={maxSeats}
            onChangeText={setMaxSeats}
            placeholder="0"
            keyboardType="number-pad"
          />

          <View style={styles.helperBox}>
            <Ionicons name="people-outline" size={18} color={COLORS.gray} />
            <Text style={styles.helperText}>
              Set max seats to control total participation capacity. Use 0 if the merry should allow unlimited seats.
            </Text>
          </View>
        </Card>
      </Section>

      <View style={{ height: SPACING.md }} />

      <Button
        title={submitting ? "Creating..." : "Create Merry"}
        onPress={handleSubmit}
        loading={submitting}
        leftIcon={<Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />}
      />

      <View style={{ height: SPACING.sm }} />

      <Button
        title="Cancel"
        variant="secondary"
        onPress={() => router.back()}
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

  label: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
    marginBottom: 8,
  },

  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  helperBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    gap: 10,
  },
  helperText: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },
});