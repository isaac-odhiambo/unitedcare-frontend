// app/(tabs)/groups/contribute.tsx
// ------------------------------------------------
// ✅ New/updated group contribution screen
// ✅ Matches latest services/groups.ts
// ✅ Uses group_id from query params
// ✅ Uses getGroup() for header details
// ✅ Uses postGroupContribution() as manual/fallback entry
// ✅ Clearly notes that real payments should use centralized payments
// ------------------------------------------------

import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
  getApiErrorMessage,
  getGroup,
  Group,
  postGroupContribution,
} from "@/services/groups";

function cleanAmount(v: string) {
  const cleaned = (v || "").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function cleanText(v: string) {
  return (v || "").replace(/\s+/g, " ").trim();
}

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";

  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function groupTypeLabel(group?: Group | null) {
  return group?.group_type_display || group?.group_type || "Group";
}

export default function GroupContributeScreen() {
  const params = useLocalSearchParams();

  const groupId = Number(params.groupId ?? params.group_id);
  const [group, setGroup] = useState<Group | null>(null);

  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"MANUAL" | "BANK" | "OTHER">("MANUAL");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isValidGroupId = useMemo(
    () => Number.isFinite(groupId) && groupId > 0,
    [groupId]
  );

  const load = useCallback(async () => {
    if (!isValidGroupId) {
      Alert.alert("Group", "Invalid group id.");
      return;
    }

    try {
      setLoading(true);
      const data = await getGroup(groupId);
      setGroup(data ?? null);
    } catch (e: any) {
      Alert.alert("Group", getApiErrorMessage(e));
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, isValidGroupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSubmit = async () => {
    if (!isValidGroupId) {
      Alert.alert("Group", "Invalid group id.");
      return;
    }

    const cleanAmountValue = cleanAmount(amount);
    const cleanReferenceValue = cleanText(reference);
    const cleanNoteValue = cleanText(note);

    if (!cleanAmountValue || Number(cleanAmountValue) <= 0) {
      Alert.alert("Group", "Enter a valid contribution amount.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await postGroupContribution({
        group_id: groupId,
        amount: cleanAmountValue,
        source,
        reference: cleanReferenceValue || undefined,
        note: cleanNoteValue || undefined,
      });

      Alert.alert(
        "Contribution",
        res?.message || "Contribution posted successfully.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace(ROUTES.dynamic.groupDetail(groupId) as any),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Contribution", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

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
            <Text style={styles.title}>Group Contribution</Text>
            <Text style={styles.subtitle}>
              {group?.name || `Group #${groupId}`} • {groupTypeLabel(group)}
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

        {/* Group Info */}
        <Section title="Group details">
          <Card style={styles.card}>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Group</Text>
              <Text style={styles.kvValue}>{group?.name || `#${groupId}`}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Type</Text>
              <Text style={styles.kvValue}>{groupTypeLabel(group)}</Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Contribution Rule</Text>
              <Text style={styles.kvValue}>
                {group?.requires_contributions
                  ? formatKes(group?.contribution_amount)
                  : "Optional"}
              </Text>
            </View>

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Frequency</Text>
              <Text style={styles.kvValue}>
                {group?.contribution_frequency || "—"}
              </Text>
            </View>
          </Card>
        </Section>

        {/* Contribution Entry */}
        <Section title="Contribution entry">
          <Card style={styles.card}>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={(t) => setAmount(cleanAmount(t))}
              placeholder="e.g. 500"
              keyboardType="decimal-pad"
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={{ height: SPACING.md }} />

            <Text style={styles.label}>Source</Text>
            <View style={styles.sourceRow}>
              <Button
                title="Manual"
                variant={source === "MANUAL" ? "primary" : "secondary"}
                onPress={() => setSource("MANUAL")}
                style={{ flex: 1 }}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Bank"
                variant={source === "BANK" ? "primary" : "secondary"}
                onPress={() => setSource("BANK")}
                style={{ flex: 1 }}
              />
              <View style={{ width: SPACING.sm }} />
              <Button
                title="Other"
                variant={source === "OTHER" ? "primary" : "secondary"}
                onPress={() => setSource("OTHER")}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ height: SPACING.md }} />

            <Text style={styles.label}>Reference</Text>
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="Optional reference"
              style={styles.input}
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={{ height: SPACING.md }} />

            <Text style={styles.label}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={COLORS.textMuted}
            />

            <View style={{ height: SPACING.lg }} />

            <Button
              title={submitting ? "Posting..." : "Post Contribution"}
              onPress={handleSubmit}
              disabled={submitting}
              leftIcon={
                submitting ? (
                  <ActivityIndicator />
                ) : (
                  <Ionicons
                    name="cash-outline"
                    size={18}
                    color={COLORS.white}
                  />
                )
              }
            />
          </Card>
        </Section>

        {/* Important Note */}
        <Section title="Important">
          <Card style={styles.noteCard}>
            <Text style={styles.noteText}>
              This screen posts a direct/manual contribution entry. For real
              member payments such as M-Pesa STK, use the centralized payments
              flow so payment confirmation and group accounting stay in sync.
            </Text>

            <View style={{ height: SPACING.md }} />

            <Button
              title="Open Group"
              variant="secondary"
              onPress={() =>
                isValidGroupId &&
                router.push(ROUTES.dynamic.groupDetail(groupId) as any)
              }
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

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },

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

  kvRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: SPACING.md,
  },

  kvLabel: {
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.gray,
  },

  kvValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: 12,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  label: {
    fontSize: 12,
    fontFamily: FONT.medium,
    color: COLORS.textMuted,
    marginBottom: 8,
  },

  input: {
    minHeight: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.text,
  },

  textArea: {
    minHeight: 100,
  },

  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
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