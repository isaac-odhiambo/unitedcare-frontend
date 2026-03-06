// app/(tabs)/savings/create.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { createSavingsAccount } from "@/services/savings";

export default function CreateSavingsAccountScreen() {
  const [name, setName] = useState("");
  const [type, setType] = useState<"FLEXIBLE" | "FIXED" | "TARGET">("FLEXIBLE");

  const [lockedUntil, setLockedUntil] = useState(""); // YYYY-MM-DD
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDeadline, setTargetDeadline] = useState("");

  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (type === "FIXED") return !!lockedUntil.trim();
    if (type === "TARGET") return !!targetAmount.trim();
    return true;
  }, [name, type, lockedUntil, targetAmount]);

  const submit = async () => {
    try {
      if (!canSubmit) return;

      setLoading(true);
      await createSavingsAccount({
        name: name.trim(),
        account_type: type,
        locked_until: type === "FIXED" ? lockedUntil.trim() : undefined,
        target_amount: type === "TARGET" ? targetAmount.trim() : undefined,
        target_deadline: type === "TARGET" ? targetDeadline.trim() : undefined,
      });

      Alert.alert("Savings", "Account created.");
      router.back();
    } catch (e: any) {
      Alert.alert("Savings", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.hTitle}>Create savings account</Text>
          <Text style={styles.hSub}>Flexible, Fixed or Target account</Text>
        </View>
        <Ionicons name="add-circle-outline" size={22} color={COLORS.primary} />
      </View>

      <Section title="Details">
        <Card>
          <Text style={styles.label}>Account name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Main Wallet"
            style={styles.input}
          />

          <View style={{ height: SPACING.md }} />

          <Text style={styles.label}>Account type</Text>
          <View style={styles.typeRow}>
            <Button
              title="Flexible"
              variant={type === "FLEXIBLE" ? "primary" : "secondary"}
              onPress={() => setType("FLEXIBLE")}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Fixed"
              variant={type === "FIXED" ? "primary" : "secondary"}
              onPress={() => setType("FIXED")}
              style={{ flex: 1 }}
            />
            <View style={{ width: SPACING.sm }} />
            <Button
              title="Target"
              variant={type === "TARGET" ? "primary" : "secondary"}
              onPress={() => setType("TARGET")}
              style={{ flex: 1 }}
            />
          </View>

          {type === "FIXED" ? (
            <>
              <View style={{ height: SPACING.md }} />
              <Text style={styles.label}>Locked until (YYYY-MM-DD)</Text>
              <TextInput
                value={lockedUntil}
                onChangeText={setLockedUntil}
                placeholder="2026-12-31"
                style={styles.input}
              />
            </>
          ) : null}

          {type === "TARGET" ? (
            <>
              <View style={{ height: SPACING.md }} />
              <Text style={styles.label}>Target amount</Text>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="e.g. 20000"
                keyboardType="numeric"
                style={styles.input}
              />

              <View style={{ height: SPACING.md }} />
              <Text style={styles.label}>Target deadline (optional)</Text>
              <TextInput
                value={targetDeadline}
                onChangeText={setTargetDeadline}
                placeholder="2026-12-20"
                style={styles.input}
              />
            </>
          ) : null}

          <View style={{ height: SPACING.lg }} />
          <Button title={loading ? "Creating…" : "Create"} onPress={submit} disabled={!canSubmit || loading} />
        </Card>
      </Section>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  label: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontFamily: FONT.regular,
    backgroundColor: COLORS.white,
  },

  typeRow: { flexDirection: "row", alignItems: "center" },
});