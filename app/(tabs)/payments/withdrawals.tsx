import { COLORS, RADIUS, SPACING } from "@/constants/theme";
import { requestWithdrawal } from "@/services/payments";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RequestWithdrawalScreen() {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<"SAVINGS" | "MERRY" | "OTHER">("SAVINGS");
  const [phone, setPhone] = useState(""); // optional
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!amount || Number(amount) <= 0) {
      Alert.alert("Invalid amount", "Enter a valid amount");
      return;
    }
    if (phone && !/^(07|01)\d{8}$/.test(phone)) {
      Alert.alert("Invalid phone", "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX");
      return;
    }

    try {
      setLoading(true);
      const res = await requestWithdrawal({ amount, source, phone: phone || undefined });
      Alert.alert("Submitted", res?.message || "Withdrawal request submitted.");
    } catch (e: any) {
      Alert.alert("Failed", e?.response?.data?.detail || "Could not submit request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: SPACING.lg, backgroundColor: COLORS.gray50 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: SPACING.lg }}>
        Request Withdrawal
      </Text>

      <Text style={{ marginBottom: 6 }}>Amount</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        placeholder="500"
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

      <Text style={{ marginBottom: 6 }}>Source</Text>
      <TextInput
        value={source}
        onChangeText={(v) => setSource((v.toUpperCase() as any) || "SAVINGS")}
        placeholder="SAVINGS"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.gray200,
          padding: SPACING.md,
          marginBottom: SPACING.md,
        }}
      />
      <Text style={{ color: COLORS.gray600, marginBottom: SPACING.md }}>
        Use: SAVINGS, MERRY, or OTHER
      </Text>

      <Text style={{ marginBottom: 6 }}>Phone (optional)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder="07XXXXXXXX (leave empty to use your account phone)"
        keyboardType="phone-pad"
        style={{
          backgroundColor: COLORS.white,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.gray200,
          padding: SPACING.md,
          marginBottom: SPACING.lg,
        }}
      />

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
          {loading ? "Submitting..." : "Submit Withdrawal Request"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}