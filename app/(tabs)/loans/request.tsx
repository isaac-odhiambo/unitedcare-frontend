// app/(tabs)/loans/request.tsx
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { requestLoan } from "@/services/loans";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

export default function RequestLoanScreen() {
  // -----------------------------
  // Form state
  // -----------------------------
  const [productId, setProductId] = useState(""); // TODO: later replace with dropdown from products endpoint
  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("12");

  // Context: exactly one (merry OR group)
  const [merryId, setMerryId] = useState("");
  const [groupId, setGroupId] = useState("");

  const [loading, setLoading] = useState(false);

  const contextError = useMemo(() => {
    const hasMerry = !!merryId.trim();
    const hasGroup = !!groupId.trim();
    if (!hasMerry && !hasGroup) return "Provide either Merry ID or Group ID.";
    if (hasMerry && hasGroup) return "Provide either Merry ID or Group ID (not both).";
    return "";
  }, [merryId, groupId]);

  const submit = async () => {
    try {
      // -----------------------------
      // Basic validation (UX)
      // -----------------------------
      if (!productId.trim() || Number(productId) <= 0) {
        Alert.alert("Request Loan", "Enter a valid Product ID.");
        return;
      }

      if (!principal.trim() || Number(principal) <= 0) {
        Alert.alert("Request Loan", "Enter a valid principal amount.");
        return;
      }

      if (!termWeeks.trim() || Number(termWeeks) <= 0) {
        Alert.alert("Request Loan", "Enter a valid term in weeks.");
        return;
      }

      if (contextError) {
        Alert.alert("Request Loan", contextError);
        return;
      }

      const payload: any = {
        product: Number(productId),
        principal: String(principal),
        term_weeks: Number(termWeeks),
      };

      if (merryId.trim()) payload.merry = Number(merryId);
      if (groupId.trim()) payload.group = Number(groupId);

      setLoading(true);

      const res = await requestLoan(payload);

      Alert.alert("Success", res?.message || "Loan request submitted.");
      router.replace(`/loans/${res.loan.id}` as any);
    } catch (e: any) {
      Alert.alert("Request Loan", getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Request Loan</Text>
        <Text style={styles.sub}>
          Choose your loan context (Merry or Group) and submit your request.
        </Text>
      </View>

      <Section title="Loan Details">
        <Card>
          <Input
            label="Product ID"
            value={productId}
            onChangeText={setProductId}
            placeholder="e.g. 1"
            keyboardType="number-pad"
          />

          <Input
            label="Principal (KES)"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="e.g. 10000"
            keyboardType="decimal-pad"
          />

          <Input
            label="Term (Weeks)"
            value={termWeeks}
            onChangeText={setTermWeeks}
            placeholder="e.g. 12"
            keyboardType="number-pad"
          />
        </Card>
      </Section>

      <Section title="Loan Context">
        <Card>
          <Text style={styles.hint}>
            Provide <Text style={styles.hintStrong}>either</Text> a Merry ID{" "}
            <Text style={styles.hintStrong}>or</Text> a Group ID.
          </Text>

          <View style={{ height: SPACING.md }} />

          <Input
            label="Merry ID (optional)"
            value={merryId}
            onChangeText={(v) => {
              setMerryId(v);
              // ensure exactly one is filled
              if (v.trim()) setGroupId("");
            }}
            placeholder="e.g. 3"
            keyboardType="number-pad"
            error={merryId.trim() && groupId.trim() ? "Remove Group ID to continue." : undefined}
          />

          <Input
            label="Group ID (optional)"
            value={groupId}
            onChangeText={(v) => {
              setGroupId(v);
              // ensure exactly one is filled
              if (v.trim()) setMerryId("");
            }}
            placeholder="e.g. 2"
            keyboardType="number-pad"
            error={merryId.trim() && groupId.trim() ? "Remove Merry ID to continue." : undefined}
          />

          {!!contextError && !merryId.trim() && !groupId.trim() ? (
            <Text style={styles.contextError}>{contextError}</Text>
          ) : null}
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={loading ? "Submitting..." : "Submit Request"}
          onPress={submit}
          loading={loading}
        />
        <View style={{ height: SPACING.sm }} />
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          disabled={loading}
        />
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.lg, paddingBottom: 24 },

  header: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  sub: { marginTop: 6, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  hint: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  hintStrong: { fontFamily: FONT.bold, color: COLORS.dark },

  contextError: {
    marginTop: 8,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.danger,
  },

  actions: { marginTop: SPACING.lg },
});