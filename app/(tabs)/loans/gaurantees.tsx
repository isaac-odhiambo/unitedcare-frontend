import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { acceptGuarantee, fetchMyGuaranteeRequests, GuaranteeRequest, rejectGuarantee } from "@/services/loans";
import { useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function GuaranteesScreen() {
  const [rows, setRows] = useState<GuaranteeRequest[]>([]);

  const load = async () => {
    try {
      const data = await fetchMyGuaranteeRequests();
      setRows(data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load guarantees");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const accept = async (id: number) => {
    try {
      await acceptGuarantee(id);
      Alert.alert("Success", "Guarantee accepted.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Accept failed");
    }
  };

  const reject = async (id: number) => {
    try {
      await rejectGuarantee(id);
      Alert.alert("Success", "Guarantee rejected.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Reject failed");
    }
  };

  return (
    <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white }}>
      <Text style={{ fontSize: FONT.section, fontWeight: "800", marginBottom: SPACING.sm }}>Guarantee Requests</Text>

      <FlatList
        data={rows}
        keyExtractor={(i) => String(i.id)}
        ListEmptyComponent={<Text style={{ color: COLORS.gray }}>No pending requests.</Text>}
        renderItem={({ item }) => (
          <View style={{ borderWidth: 1, borderColor: COLORS.lightGray, padding: SPACING.md, borderRadius: RADIUS.lg, marginBottom: SPACING.sm }}>
            <Text style={{ fontWeight: "800" }}>Request #{item.id}</Text>
            <Text style={{ color: COLORS.gray }}>Loan ID: {item.loan}</Text>

            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm }}>
              <TouchableOpacity onPress={() => accept(item.id)} style={{ backgroundColor: COLORS.success, padding: SPACING.sm, borderRadius: RADIUS.md }}>
                <Text style={{ color: COLORS.white, fontWeight: "700" }}>Accept</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => reject(item.id)} style={{ backgroundColor: COLORS.danger, padding: SPACING.sm, borderRadius: RADIUS.md }}>
                <Text style={{ color: COLORS.white, fontWeight: "700" }}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}