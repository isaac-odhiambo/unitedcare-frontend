import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { payLoan } from "@/services/loans";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function PayLoanScreen() {
  const { loanId } = useLocalSearchParams();
  const id = Number(loanId);

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");

  const submit = async () => {
    try {
      if (!amount) {
        Alert.alert("Missing", "Enter amount.");
        return;
      }
      await payLoan(id, { amount, method: "MANUAL", reference: reference || undefined });
      Alert.alert("Success", "Payment applied.");
      router.replace({ pathname: "/(tabs)/loans/[loanId]", params: { loanId: String(id) } });
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Payment failed");
    }
  };

  return (
    <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white, gap: SPACING.sm }}>
      <Text style={{ fontSize: FONT.section, fontWeight: "800" }}>Pay Loan #{id}</Text>

      <TextInput style={styles.input} placeholder="Amount" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Reference (optional)" value={reference} onChangeText={setReference} />

      <TouchableOpacity onPress={submit} style={{ backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" }}>
        <Text style={{ color: COLORS.white, fontWeight: "800" }}>Pay</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
};