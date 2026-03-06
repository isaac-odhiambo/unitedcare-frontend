// app/(tabs)/loans/add-guarantor.tsx
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { addGuarantor } from "@/services/loans";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

export default function AddGuarantorScreen() {
  const params = useLocalSearchParams();
  const loanFromParams = params.loan ? String(params.loan) : "";
  const defaultLoanId = loanFromParams && !Number.isNaN(Number(loanFromParams)) ? loanFromParams : "";

  const [loanId, setLoanId] = useState(defaultLoanId);
  const [guarantorId, setGuarantorId] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const l = Number(loanId);
    const g = Number(guarantorId);
    return Number.isFinite(l) && l > 0 && Number.isFinite(g) && g > 0;
  }, [loanId, guarantorId]);

  const submit = async () => {
    try {
      if (!canSubmit) {
        Alert.alert("Add Guarantor", "Enter a valid Loan ID and Guarantor User ID.");
        return;
      }

      setLoading(true);

      const res = await addGuarantor({
        loan: Number(loanId),
        guarantor: Number(guarantorId),
      });

      Alert.alert("Success", res?.message || "Guarantor request sent.");
      router.replace(`/loans/${Number(loanId)}` as any);
    } catch (e: any) {
      Alert.alert("Add Guarantor", getErrorMessage(e));
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
        <Text style={styles.title}>Add Guarantor</Text>
        <Text style={styles.sub}>
          Send a guarantee request to a member in the same Merry/Group context.
        </Text>
      </View>

      <Section title="Guarantor Request">
        <Card>
          <Input
            label="Loan ID"
            value={loanId}
            onChangeText={setLoanId}
            placeholder="e.g. 12"
            keyboardType="number-pad"
          />

          <Input
            label="Guarantor User ID"
            value={guarantorId}
            onChangeText={setGuarantorId}
            placeholder="e.g. 5"
            keyboardType="number-pad"
          />

          <Text style={styles.note}>
            Tip: Use the exact user ID of the guarantor. They must be an active member of the same
            Merry/Group and cannot guarantee more than one active loan in the same context.
          </Text>
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={loading ? "Sending..." : "Send Request"}
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
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

  note: { marginTop: 8, fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },

  actions: { marginTop: SPACING.lg },
});