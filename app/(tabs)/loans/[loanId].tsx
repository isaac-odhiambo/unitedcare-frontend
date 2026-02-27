import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { approveLoan, fetchLoanDetail } from "@/services/loans";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: COLORS.gray }}>{label}</Text>
      <Text style={{ fontWeight: "700", color: COLORS.dark }}>{value}</Text>
    </View>
  );
}

export default function LoanDetailScreen() {
  const { loanId } = useLocalSearchParams();
  const id = Number(loanId);

  const [loan, setLoan] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await fetchLoanDetail(id);
      setLoan(data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load loan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleApprove = async () => {
    try {
      const role = await SecureStore.getItemAsync("role");
      if (role !== "admin") {
        Alert.alert("Not allowed", "Only admin can approve loans.");
        return;
      }

      await approveLoan(id);
      Alert.alert("Success", "Loan approved.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Approval failed");
    }
  };

  if (!loan) {
    return (
      <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white }}>
        <Text style={{ color: COLORS.gray }}>{loading ? "Loading..." : "Loan not found."}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: SPACING.md, backgroundColor: COLORS.white, gap: SPACING.md }}>
      <Text style={{ fontSize: FONT.section, fontWeight: "900" }}>Loan #{loan.id}</Text>

      <View style={{ borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: RADIUS.lg, padding: SPACING.md }}>
        <Row label="Status" value={loan.status} />
        <Row label="Principal" value={`KES ${loan.principal}`} />
        <Row label="Total Payable" value={`KES ${loan.total_payable}`} />
        <Row label="Total Paid" value={`KES ${loan.total_paid}`} />
        <Row label="Outstanding" value={`KES ${loan.outstanding_balance}`} />
        <Row label="Term Weeks" value={`${loan.term_weeks}`} />
      </View>

      {/* ✅ Security block (new fields) */}
      <View style={{ borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: RADIUS.lg, padding: SPACING.md }}>
        <Text style={{ fontWeight: "900", marginBottom: 6 }}>Security Coverage</Text>
        <Row label="Target Security" value={`KES ${loan.security_target ?? "0.00"}`} />
        <Row label="Borrower Reserved Savings" value={`KES ${loan.borrower_reserved_savings ?? "0.00"}`} />
        <Row label="Borrower Merry Credit" value={`KES ${loan.borrower_reserved_merry_credit ?? "0.00"}`} />
      </View>

      <View style={{ flexDirection: "row", gap: SPACING.sm }}>
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(tabs)/loans/pay", params: { loanId: String(loan.id) } })}
          style={{ backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: RADIUS.md, flex: 1, alignItems: "center" }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "800" }}>Pay Loan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(tabs)/loans/add-guarantor", params: { loanId: String(loan.id) } })}
          style={{ backgroundColor: COLORS.accent, padding: SPACING.md, borderRadius: RADIUS.md, flex: 1, alignItems: "center" }}
        >
          <Text style={{ color: COLORS.white, fontWeight: "800" }}>Add Guarantor</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleApprove}
        style={{ backgroundColor: COLORS.success, padding: SPACING.md, borderRadius: RADIUS.md, alignItems: "center" }}
      >
        <Text style={{ color: COLORS.white, fontWeight: "900" }}>Admin Approve Loan</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={load} style={{ alignItems: "center" }}>
        <Text style={{ color: COLORS.primary, fontWeight: "800" }}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );
}