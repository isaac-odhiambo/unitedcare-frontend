// app/(tabs)/loans/pay.tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

import { ROUTES } from "@/constants/routes";
import { COLORS, FONT, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import { getSessionUser } from "@/services/session";

function normalizePhone(phone: string) {
  const p = String(phone || "").trim().replace(/\s+/g, "");
  if (p.startsWith("+254")) return `0${p.slice(4)}`;
  if (p.startsWith("254")) return `0${p.slice(3)}`;
  return p;
}

function isValidPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function cleanAmount(v: string) {
  return (v || "").replace(/[^\d.]/g, "");
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams<{
    loan?: string;
    id?: string;
    amount?: string;
    due?: string;
  }>();

  const loanId = Number(params.loan ?? params.id ?? 0);

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(
    cleanAmount(String(params.amount ?? params.due ?? ""))
  );

  useEffect(() => {
    (async () => {
      try {
        const user = await getSessionUser();
        if (user?.phone) {
          setPhone(normalizePhone(user.phone));
        }
      } catch {}
    })();
  }, []);

  const cleanPhone = useMemo(() => normalizePhone(phone), [phone]);
  const cleanAmt = useMemo(() => cleanAmount(amount), [amount]);

  const canSubmit = useMemo(() => {
    return (
      isValidPhone(cleanPhone) &&
      Number(cleanAmt) > 0 &&
      Number.isFinite(loanId) &&
      loanId > 0
    );
  }, [cleanPhone, cleanAmt, loanId]);

  const handlePay = () => {
    if (!canSubmit) return;

    router.push({
      pathname: ROUTES.tabs.paymentsDeposit as any,
      params: {
        title: "Loan Repayment",
        purpose: "LOAN_REPAYMENT",
        reference: `loan${loanId}`,
        narration: `Loan repayment (Loan#${loanId})`,
        amount: cleanAmt,
        phone: cleanPhone,
        returnTo: ROUTES.dynamic.loanDetail(loanId),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Repay Loan</Text>
        </View>

        <Card style={styles.card}>
          <Input
            label="Phone"
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            placeholder="07XXXXXXXX"
            keyboardType="phone-pad"
          />

          <Input
            label="Amount"
            value={amount}
            onChangeText={(v) => setAmount(cleanAmount(v))}
            placeholder="500"
            keyboardType="numeric"
          />

          <View style={{ height: SPACING.lg }} />

          <Button
            title="Pay"
            onPress={handlePay}
            disabled={!canSubmit}
          />
        </Card>

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

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
  },

  header: {
    marginBottom: SPACING.lg,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 18,
    color: COLORS.text,
  },

  card: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOW.card,
  },
});