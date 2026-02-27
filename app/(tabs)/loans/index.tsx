import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { fetchMyLoans, Loan } from "@/services/loans";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function LoansHome() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetchMyLoans();
      setLoans(res);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white }}>
      <Text style={{ fontSize: FONT.section, fontWeight: "800", marginBottom: SPACING.sm }}>My Loans</Text>

      <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md }}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/loans/request")}
          style={{ backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: RADIUS.md }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "700" }}>Request Loan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/loans/guarantees")}
          style={{ backgroundColor: COLORS.accent, padding: SPACING.sm, borderRadius: RADIUS.md }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "700" }}>Guarantees</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={load}
          style={{ backgroundColor: COLORS.lightGray, padding: SPACING.sm, borderRadius: RADIUS.md }}
        >
          <Text style={{ color: COLORS.dark, fontWeight: "700" }}>{loading ? "..." : "Refresh"}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={{ color: COLORS.gray }}>No loans yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(tabs)/loans/[loanId]", params: { loanId: String(item.id) } })}
            style={{
              borderWidth: 1,
              borderColor: COLORS.lightGray,
              padding: SPACING.md,
              borderRadius: RADIUS.lg,
              marginBottom: SPACING.sm,
            }}
          >
            <Text style={{ fontWeight: "800", color: COLORS.dark }}>
              Loan #{item.id} • {item.status}
            </Text>
            <Text style={{ marginTop: 4, color: COLORS.gray }}>Principal: KES {item.principal}</Text>
            <Text style={{ color: COLORS.gray }}>Outstanding: KES {item.outstanding_balance}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}