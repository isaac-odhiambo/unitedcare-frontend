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

function normalizeDisplayPhone(phone: string) {
  const p = String(phone || "").trim().replace(/\s+/g, "");
  if (!p) return "";

  if (p.startsWith("+254")) return `0${p.slice(4)}`;
  if (p.startsWith("254")) return `0${p.slice(3)}`;

  return p;
}

function isValidKenyanPhone(phone: string) {
  return /^(07|01)\d{8}$/.test(phone);
}

function sanitizeAmount(value: string) {
  const cleaned = String(value || "").replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 2) return cleaned;
  return `${parts[0]}.${parts.slice(1).join("")}`;
}

function normalizeAmount(value: string) {
  return sanitizeAmount(value).trim();
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams<{
    loan?: string;
    id?: string;
    due?: string;
    balance?: string;
    amount?: string;
  }>();

  const loanId = Number(params.loan ?? params.id ?? 0);
  const dueFromParams = String(
    params.due ?? params.balance ?? params.amount ?? "0.00"
  );

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(normalizeAmount(dueFromParams));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const user = await getSessionUser();
        const p = normalizeDisplayPhone(String(user?.phone || ""));
        if (mounted && p) setPhone(p);
      } catch {
        // allow manual entry
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const cleanPhone = useMemo(() => normalizeDisplayPhone(phone), [phone]);
  const cleanAmount = useMemo(() => normalizeAmount(amount), [amount]);

  const canSubmit = useMemo(() => {
    const okPhone = isValidKenyanPhone(cleanPhone);
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

      if (!isValidKenyanPhone(cleanPhone)) {
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

      const res = await stkRepayLoan({
        phone: cleanPhone,
        amount: cleanAmount,
        loan_id: loanId,
        reference: `loan${loanId}`,
        narration: `Loan repayment (Loan#${loanId})`,
      });

      const notice =
        res?.message ||
        "STK push sent. Check your phone and enter your M-Pesa PIN.";

      const status = res?.tx?.status || "PENDING";
      const checkoutRequestId = res?.tx?.checkout_request_id || "";
      const chargedAmount = res?.tx?.amount ?? cleanAmount;
      const feeAmount = (res?.tx as any)?.transaction_fee ?? "0";

      Alert.alert("STK Sent", notice);

      router.replace({
        pathname: `/(tabs)/loans/${loanId}` as any,
        params: {
          paid: "1",
          notice,
          status,
          checkout_request_id: checkoutRequestId,
          baseAmount: cleanAmount,
          chargedAmount: String(chargedAmount),
          feeAmount: String(feeAmount),
          tx_id: String(res?.tx?.id || ""),
        },
      });
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
            Pay via M-Pesa STK Push. Loan #
            {Number.isFinite(loanId) && loanId > 0 ? loanId : "—"}
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
            onChangeText={(v) => setPhone(normalizeDisplayPhone(v))}
            placeholder="07XXXXXXXX"
            keyboardType="phone-pad"
            error={
              phone && !isValidKenyanPhone(cleanPhone)
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

          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Phone</Text>
              <Text style={styles.summaryValue}>{cleanPhone || "—"}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <Text style={styles.summaryValue}>
                {formatKes(cleanAmount || 0)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Purpose</Text>
              <Text style={styles.summaryValue}>LOAN_REPAYMENT</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reference</Text>
              <Text style={styles.summaryValue}>
                {Number.isFinite(loanId) && loanId > 0 ? `loan${loanId}` : "—"}
              </Text>
            </View>
          </View>

          <Text style={styles.note}>
            After you approve the STK Push on your phone, the backend callback
            updates the repayment and applies it to your loan.
          </Text>
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={loading ? "Sending STK..." : "Pay with M-Pesa"}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 24,
  },

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

  summaryBox: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.white,
  },

  summaryRow: {
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.md,
  },

  summaryLabel: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  summaryValue: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: FONT.bold,
    fontSize: 12,
    color: COLORS.dark,
  },

  actions: {
    marginTop: SPACING.lg,
  },
});