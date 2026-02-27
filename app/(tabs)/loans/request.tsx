import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { requestLoan } from "@/services/loans";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RequestLoanScreen() {
  const [product, setProduct] = useState("1");
  const [principal, setPrincipal] = useState("");
  const [termWeeks, setTermWeeks] = useState("12");
  const [merryId, setMerryId] = useState("");
  const [groupId, setGroupId] = useState("");

  const submit = async () => {
    try {
      if (!product || !principal || !termWeeks) {
        Alert.alert("Missing", "Product, principal and term weeks are required.");
        return;
      }

      // require exactly one context
      const hasMerry = !!merryId;
      const hasGroup = !!groupId;
      if (hasMerry === hasGroup) {
        Alert.alert("Context required", "Provide either Merry ID OR Group ID (not both).");
        return;
      }

      await requestLoan({
        product: Number(product),
        principal,
        term_weeks: Number(termWeeks),
        merry: hasMerry ? Number(merryId) : null,
        group: hasGroup ? Number(groupId) : null,
      });

      Alert.alert("Success", "Loan request submitted.");
      router.replace("/(tabs)/loans");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Loan request failed");
    }
  };

  return (
    <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white, gap: SPACING.sm }}>
      <Text style={{ fontSize: FONT.section, fontWeight: "800" }}>Request Loan</Text>

      <TextInput style={styles.input} placeholder="Product ID (e.g 1)" value={product} onChangeText={setProduct} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Principal (e.g 5000)" value={principal} onChangeText={setPrincipal} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Term weeks (e.g 12)" value={termWeeks} onChangeText={setTermWeeks} keyboardType="number-pad" />

      <Text style={{ marginTop: SPACING.sm, fontWeight: "700" }}>Choose ONE context:</Text>
      <TextInput style={styles.input} placeholder="Merry ID (optional)" value={merryId} onChangeText={setMerryId} keyboardType="number-pad" />
      <TextInput style={styles.input} placeholder="Group ID (optional)" value={groupId} onChangeText={setGroupId} keyboardType="number-pad" />

      <TouchableOpacity onPress={submit} style={{ backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" }}>
        <Text style={{ color: COLORS.white, fontWeight: "800" }}>Submit Request</Text>
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