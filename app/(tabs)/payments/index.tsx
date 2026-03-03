import { COLORS, RADIUS, SPACING } from "@/constants/theme";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

function Tile({ title, subtitle, to }: { title: string; subtitle: string; to: any }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(to)}
      style={{
        backgroundColor: COLORS.white,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.gray200,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.black }}>{title}</Text>
      <Text style={{ marginTop: 6, color: COLORS.gray600 }}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export default function PaymentsHome() {
  return (
    <View style={{ flex: 1, padding: SPACING.lg, backgroundColor: COLORS.gray50 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: SPACING.lg }}>
        Payments
      </Text>

      <Tile
        title="Deposit via M-Pesa"
        subtitle="STK push to deposit savings, merry contributions, loan repayment."
        to="/(tabs)/payments/deposit"
      />

      <Tile
        title="My Ledger"
        subtitle="See your full payment history."
        to="/(tabs)/payments/ledger"
      />

      <Tile
        title="My Withdrawals"
        subtitle="Track your withdrawal requests."
        to="/(tabs)/payments/withdrawals"
      />

      <Tile
        title="Request Withdrawal"
        subtitle="Ask admin to approve your withdrawal."
        to="/(tabs)/payments/request-withdrawal"
      />
    </View>
  );
}