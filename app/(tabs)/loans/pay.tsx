// app/(tabs)/loans/pay.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { getApiErrorMessage, stkRepayLoan } from "@/services/loans";
import { getSessionUser } from "@/services/session";

function formatKes(value?: string | number | null) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizePhone(phone: string) {
  const p = (phone || "").trim().replace(/\s+/g, "");
  if (!p) return "";

  if (p.startsWith("+254")) return "0" + p.slice(4);
  if (p.startsWith("254")) return "0" + p.slice(3);

  return p;
}

function normalizeAmount(value: string) {
  return String(value || "").replace(/,/g, "").trim();
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams();

  const loanId = Number(params.loan);
  const dueFromParams = String(params.due ?? "0.00");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(normalizeAmount(dueFromParams));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const user = await getSessionUser();
        const p = normalizePhone(String(user?.phone || ""));
        if (mounted && p) setPhone(p);
      } catch {
        // ignore; user can type manually
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const cleanPhone = useMemo(() => normalizePhone(phone), [phone]);
  const cleanAmount = useMemo(() => normalizeAmount(amount), [amount]);

  const canSubmit = useMemo(() => {
    const okPhone = /^(07|01)\d{8}$/.test(cleanPhone);
    const amt = Number(cleanAmount);
    const okAmount = Number.isFinite(amt) && amt > 0;
    const okLoan = Number.isFinite(loanId) && loanId > 0;
    return okPhone && okAmount && okLoan;
  }, [cleanPhone, cleanAmount, loanId]);

  const submit = async () => {
    try {
      if (!Number.isFinite(loanId) || loanId <= 0) {
        Alert.alert("Pay Loan", "Invalid loan ID.");
        return;
      }

      if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
        Alert.alert(
          "Invalid Phone",
          "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX."
        );
        return;
      }

      const amt = Number(cleanAmount);
      if (!Number.isFinite(amt) || amt <= 0) {
        Alert.alert("Pay Loan", "Enter a valid amount.");
        return;
      }

      setLoading(true);

      await stkRepayLoan({
        phone: cleanPhone,
        amount: cleanAmount,
        loan_id: loanId,
        reference: `LOAN-${loanId}`,
      });

      Alert.alert(
        "STK Sent",
        "Check your phone and enter your M-Pesa PIN to complete payment."
      );

      router.replace(`/(tabs)/loans/${loanId}` as any);
    } catch (e: any) {
      Alert.alert("Pay Loan", getApiErrorMessage(e) || getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <Text style={styles.title}>Repay Loan</Text>
          <Text style={styles.sub}>
            Pay via MPESA STK Push. Loan #{Number.isFinite(loanId) ? loanId : "—"}
          </Text>
        </View>
        <Ionicons
          name="phone-portrait-outline"
          size={22}
          color={COLORS.primary}
        />
      </View>

      <Section title="Payment Details">
        <Card style={styles.card}>
          <Input
            label="Phone number"
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            placeholder="07XXXXXXXX"
            keyboardType="phone-pad"
            error={
              phone && !/^(07|01)\d{8}$/.test(cleanPhone)
                ? "Phone must be 07XXXXXXXX or 01XXXXXXXX"
                : undefined
            }
          />

          <Input
            label="Amount (KES)"
            value={amount}
            onChangeText={(v) => setAmount(normalizeAmount(v))}
            placeholder="e.g. 500"
            keyboardType="decimal-pad"
          />

          <View style={styles.inline}>
            <Text style={styles.inlineLabel}>Suggested due</Text>
            <Text style={styles.inlineValue}>{formatKes(dueFromParams)}</Text>
          </View>

          <Text style={styles.note}>
            After you approve the STK Push on your phone, the backend callback
            updates the repayment and applies it to your loan.
          </Text>
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={loading ? "Sending STK..." : "Pay with MPESA"}
          onPress={submit}
          loading={loading}
          disabled={!canSubmit || loading}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...SHADOW.card,
  },

  card: {
    padding: SPACING.md,
    ...SHADOW.card,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.dark,
  },

  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
  },

  inline: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  inlineLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  inlineValue: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  actions: {
    marginTop: SPACING.lg,
  },
});