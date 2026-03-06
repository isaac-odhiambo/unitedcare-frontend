// app/(tabs)/savings/create.tsx (COMPLETE + UPDATED)
// --------------------------------------------------
// ✅ Matches updated services/savings.ts
// ✅ Creates FLEXIBLE / FIXED / TARGET savings accounts
// ✅ Keeps deposits centralized in payments/deposit
// ✅ Clean UI consistent with your other tabs

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { createSavingsAccount, SavingsAccountType } from "@/services/savings";

function cleanText(v: string) {
  return (v || "").replace(/\s+/g, " ").trim();
}

function cleanAmount(v: string) {
  const cleaned = (v || "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export default function SavingsCreateScreen() {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<SavingsAccountType>("FLEXIBLE");

  const [lockedUntil, setLockedUntil] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDeadline, setTargetDeadline] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const isFixed = useMemo(
    () => String(accountType).toUpperCase() === "FIXED",
    [accountType]
  );

  const isTarget = useMemo(
    () => String(accountType).toUpperCase() === "TARGET",
    [accountType]
  );

  const handleSubmit = async () => {
    const cleanNameValue = cleanText(name);

    if (!cleanNameValue) {
      Alert.alert("Savings", "Account name is required.");
      return;
    }

    try {
      setSubmitting(true);

      const payload: {
        name: string;
        account_type: "FLEXIBLE" | "FIXED" | "TARGET";
        locked_until?: string;
        target_amount?: string;
        target_deadline?: string;
      } = {
        name: cleanNameValue,
        account_type: String(accountType).toUpperCase() as
          | "FLEXIBLE"
          | "FIXED"
          | "TARGET",
      };

      if (isFixed && cleanText(lockedUntil)) {
        payload.locked_until = cleanText(lockedUntil);
      }

      if (isTarget) {
        if (cleanText(targetAmount)) payload.target_amount = cleanText(targetAmount);
        if (cleanText(targetDeadline)) payload.target_deadline = cleanText(targetDeadline);
      }

      await createSavingsAccount(payload);

      Alert.alert("Savings", "Savings account created successfully.");
      router.replace("/(tabs)/savings" as any);
    } catch (e: any) {
      Alert.alert("Savings", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Create Savings Account</Text>
            <Text style={styles.subtitle}>
              Add a flexible, fixed, or target savings wallet.
            </Text>
          </View>

          <Button
            variant="ghost"
            title="Back"
            onPress={() => router.back()}
            leftIcon={
              <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
            }
          />
        </View>

        {/* Account type */}
        <Section title="Account type">
          <Card style={styles.card}>
            <View style={styles.typeRow}>
              <Button
                title="Flexible"
                variant={accountType === "FLEXIBLE" ? "primary" : "secondary"}
                onPress={() => setAccountType("FLEXIBLE")}
                style={{ flex: 1 }}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Fixed"
                variant={accountType === "FIXED" ? "primary" : "secondary"}
                onPress={() => setAccountType("FIXED")}
                style={{ flex: 1 }}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Target"
                variant={accountType === "TARGET" ? "primary" : "secondary"}
                onPress={() => setAccountType("TARGET")}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ height: SPACING.md }} />

            <Text style={styles.helper}>
              Flexible is best for daily savings. Fixed can be locked until a date.
              Target helps track a goal and deadline.
            </Text>
          </Card>
        </Section>

        {/* Details */}
        <Section title="Account details">
          <Card style={styles.card}>
            <Text style={styles.label}>Account name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Wallet"
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />

            {isFixed ? (
              <>
                <View style={{ height: SPACING.md }} />
                <Text style={styles.label}>Locked until</Text>
                <TextInput
                  value={lockedUntil}
                  onChangeText={setLockedUntil}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.helperSmall}>
                  Use date format YYYY-MM-DD
                </Text>
              </>
            ) : null}

            {isTarget ? (
              <>
                <View style={{ height: SPACING.md }} />
                <Text style={styles.label}>Target amount</Text>
                <TextInput
                  value={targetAmount}
                  onChangeText={(t) => setTargetAmount(cleanAmount(t))}
                  placeholder="e.g. 10000"
                  keyboardType="decimal-pad"
                  style={styles.input}
                  placeholderTextColor={COLORS.textMuted}
                />

                <View style={{ height: SPACING.md }} />
                <Text style={styles.label}>Target deadline</Text>
                <TextInput
                  value={targetDeadline}
                  onChangeText={setTargetDeadline}
                  placeholder="YYYY-MM-DD"
                  style={styles.input}
                  placeholderTextColor={COLORS.textMuted}
                />
                <Text style={styles.helperSmall}>
                  Optional goal date in YYYY-MM-DD format
                </Text>
              </>
            ) : null}

            <View style={{ height: SPACING.lg }} />

            <Button
              title={submitting ? "Creating..." : "Create Account"}
              onPress={handleSubmit}
              disabled={submitting}
              leftIcon={
                submitting ? (
                  <ActivityIndicator />
                ) : (
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
                )
              }
            />
          </Card>
        </Section>

        {/* Deposit note */}
        <Section title="After creating">
          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>
              Deposits are handled through the centralized payments flow. After
              creating the account, use the Deposit screen to top up your savings.
            </Text>

            <View style={{ height: SPACING.md }} />

            <Button
              title="Go to Deposit"
              variant="secondary"
              onPress={() => router.push("/(tabs)/payments/deposit" as any)}
            />
          </Card>
        </Section>

        <View style={{ height: 18 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 30 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },

  title: {
    fontSize: 20,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  card: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  label: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textMuted,
    marginBottom: 8,
  },

  input: {
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },

  helper: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  helperSmall: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },

  noteCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },

  noteText: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },
});