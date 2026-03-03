import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { stkPush } from "@/services/payments";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";

export default function DepositScreen() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("SAVINGS_DEPOSIT");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!/^(07|01)\d{8}$/.test(phone)) {
      Alert.alert("Invalid phone", "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      const res = await stkPush({ phone, amount, purpose, reference: "APP" });
      Alert.alert("STK Sent", res?.message || "Check your phone to complete payment.");
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Could not initiate STK push.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: SPACING.lg, backgroundColor: COLORS.gray50 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: SPACING.lg }}>
        Deposit (STK Push)
      </Text>

      <Text style={{ marginBottom: 6 }}>Phone</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="07XXXXXXXX"
        keyboardType="phone-pad"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.gray200,
          padding: SPACING.md,
          marginBottom: SPACING.md,
        }}
      />

      <Text style={{ marginBottom: 6 }}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="100"
        keyboardType="number-pad"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.gray200,
          padding: SPACING.md,
          marginBottom: SPACING.md,
        }}
      />

      <Text style={{ marginBottom: 6 }}>Purpose</Text>
      <TextInput
        value={purpose}
        onChangeText={setPurpose}
        placeholder="SAVINGS_DEPOSIT"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.gray200,
          padding: SPACING.md,
          marginBottom: SPACING.lg,
        }}
      />
      <Text style={{ color: COLORS.gray600, marginBottom: SPACING.lg }}>
        Examples: SAVINGS_DEPOSIT, MERRY_CONTRIBUTION, LOAN_REPAYMENT
      </Text>

      <TouchableOpacity
        onPress={submit}
        disabled={loading}
        style={{
          backgroundColor: COLORS.primary,
          padding: SPACING.md,
          borderRadius: RADIUS.md,
          alignItems: "center",
          opacity: loading ? 0.7 : 1,
        }}
      >
        <Text style={{ color: COLORS.white, fontWeight: "700" }}>
          {loading ? "Sending..." : "Send STK Push"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}