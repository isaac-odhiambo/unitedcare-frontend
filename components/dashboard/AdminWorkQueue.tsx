import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { COLORS, FONT, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  pendingJoinRequests?: number;
  pendingWithdrawals?: number;
  overdueLoans?: number;
  onOpenJoinRequests: () => void;
  onOpenWithdrawals: () => void;
  onOpenLoans: () => void;
};

function Row({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>

      <View style={styles.rowRight}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{value}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminWorkQueue({
  pendingJoinRequests = 0,
  pendingWithdrawals = 0,
  overdueLoans = 0,
  onOpenJoinRequests,
  onOpenWithdrawals,
  onOpenLoans,
}: Props) {
  return (
    <Section title="Admin Work Queue">
      <Card>
        <Row
          label="Pending Join Requests"
          value={pendingJoinRequests}
          icon="person-add-outline"
          onPress={onOpenJoinRequests}
        />
        <View style={styles.divider} />
        <Row
          label="Withdrawal Approvals"
          value={pendingWithdrawals}
          icon="cash-outline"
          onPress={onOpenWithdrawals}
        />
        <View style={styles.divider} />
        <Row label="Overdue Loans" value={overdueLoans} icon="warning-outline" onPress={onOpenLoans} />
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLabel: { fontSize: 13, fontFamily: FONT.semiBold, color: COLORS.text },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.06)",
    minWidth: 36,
    alignItems: "center",
  },
  pillText: { fontSize: 12, fontFamily: FONT.bold, color: COLORS.text },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
});