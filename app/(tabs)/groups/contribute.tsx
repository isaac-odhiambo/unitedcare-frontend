// app/(tabs)/groups/contribute.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { postGroupContribution } from "@/services/groups";

function toAmountString(v: string) {
  const cleaned = (v || "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

export default function GroupContributeScreen() {
  const params = useLocalSearchParams();
  const groupId = Number(params?.group_id);

  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(async () => {
    const a = String(amount || "").trim();
    const n = Number(a);
    if (!Number.isFinite(groupId) || groupId <= 0) {
      Alert.alert("Group", "Invalid group id.");
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      Alert.alert("Amount", "Enter a valid amount greater than 0.");
      return;
    }

    try {
      setSubmitting(true);
      await postGroupContribution({ group_id: groupId, amount: a });
      Alert.alert("Success", "Contribution recorded.");
      router.back();
    } catch (e: any) {
      Alert.alert("Contribution", getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [amount, groupId]);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hTitle}>Group Contribution</Text>
            <Text style={styles.hSub}>Group #{groupId}</Text>
          </View>

          <Button
            variant="ghost"
            title="Back"
            onPress={() => router.back()}
            leftIcon={<Ionicons name="chevron-back" size={16} color={COLORS.primary} />}
          />
        </View>

        <Section title="Amount">
          <Card style={styles.card}>
            <Text style={styles.label}>Enter amount</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(toAmountString(t))}
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={{ height: SPACING.md }} />

            <Button
              title={submitting ? "Submitting..." : "Submit"}
              onPress={submit}
              disabled={submitting}
              leftIcon={submitting ? undefined : <Ionicons name="paper-plane-outline" size={18} color={COLORS.white} />}
            />
          </Card>
        </Section>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },

  hTitle: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.text },
  hSub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.textMuted },

  card: { padding: SPACING.lg, borderRadius: RADIUS.lg, ...SHADOW.card },
  label: { fontFamily: FONT.medium, fontSize: 12, color: COLORS.textMuted, marginBottom: 8 },

  input: {
    height: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },
});