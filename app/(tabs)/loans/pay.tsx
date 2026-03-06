// app/(tabs)/loans/pay.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { getErrorMessage } from "@/services/api";
import { stkRepayLoan } from "@/services/loans";
import { getSessionUser } from "@/services/session";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Section from "@/components/ui/Section";

function formatKes(value?: string | number) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "KES 0.00";
  return `KES ${n.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizePhone(phone: string) {
  // Backend validator: ^(07|01)\d{8}$
  const p = (phone || "").trim();
  if (!p) return "";

  // allow +2547... / 2547... / 07...
  if (p.startsWith("+254")) return "0" + p.slice(4);
  if (p.startsWith("254")) return "0" + p.slice(3);

  return p;
}

export default function PayLoanScreen() {
  const params = useLocalSearchParams();

  const loanId = Number(params.loan);
  const dueFromParams = String(params.due ?? "0.00");

  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(dueFromParams);
  const [loading, setLoading] = useState(false);

  // ✅ load session user phone (getSessionUser is async)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const user = await getSessionUser();
        const p = normalizePhone(String(user?.phone || ""));
        if (mounted && p) setPhone(p);
      } catch {
        // ignore: phone can be entered manually
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const canSubmit = useMemo(() => {
    const okPhone = /^(07|01)\d{8}$/.test(phone);
    const amt = Number(amount);
    const okAmount = Number.isFinite(amt) && amt > 0;
    const okLoan = Number.isFinite(loanId) && loanId > 0;
    return okPhone && okAmount && okLoan;
  }, [phone, amount, loanId]);

  const submit = async () => {
    try {
      if (!Number.isFinite(loanId) || loanId <= 0) {
        Alert.alert("Pay Loan", "Invalid loan ID.");
        return;
      }

      const cleanPhone = normalizePhone(phone);
      if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
        Alert.alert("Invalid Phone", "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX");
        return;
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        Alert.alert("Pay Loan", "Enter a valid amount.");
        return;
      }

      setLoading(true);

      // ✅ Centralized Payments App — STK Push (via loans service helper)
      await stkRepayLoan({
        phone: cleanPhone,
        amount: String(amount),
        loan_id: loanId,
      });

      Alert.alert(
        "STK Sent",
        "Check your phone and enter M-Pesa PIN to complete payment."
      );

      router.replace(`/loans/${loanId}` as any);
    } catch (e: any) {
      Alert.alert("Pay Loan", getErrorMessage(e));
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
          <Text style={styles.title}>Pay Loan</Text>
          <Text style={styles.sub}>
            Repay via MPESA STK Push (Payments app). Loan #{loanId}
          </Text>
        </View>
        <Ionicons
          name="phone-portrait-outline"
          size={22}
          color={COLORS.primary}
        />
      </View>

      <Section title="Payment Details">
        <Card>
          <Input
            label="Phone (payer)"
            value={phone}
            onChangeText={(v) => setPhone(normalizePhone(v))}
            placeholder="07XXXXXXXX"
            keyboardType="phone-pad"
            error={
              phone && !/^(07|01)\d{8}$/.test(normalizePhone(phone))
                ? "Phone must be 07XXXXXXXX or 01XXXXXXXX"
                : undefined
            }
          />

          <Input
            label="Amount (KES)"
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 500"
            keyboardType="decimal-pad"
          />

          <View style={styles.inline}>
            <Text style={styles.inlineLabel}>Suggested due</Text>
            <Text style={styles.inlineValue}>{formatKes(dueFromParams)}</Text>
          </View>

          <Text style={styles.note}>
            After you enter your M-Pesa PIN, the backend callback updates the
            transaction, posts ledger entries, and applies the repayment to your
            loan.
          </Text>
        </Card>
      </Section>

      <View style={styles.actions}>
        <Button
          title={loading ? "Sending STK..." : "Pay with MPESA"}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: COLORS.dark },
  sub: {
    marginTop: 6,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  note: {
    marginTop: 10,
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
  },

  inline: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineLabel: { fontFamily: FONT.regular, fontSize: 12, color: COLORS.gray },
  inlineValue: { fontFamily: FONT.bold, fontSize: 12, color: COLORS.dark },

  actions: { marginTop: SPACING.lg },
});