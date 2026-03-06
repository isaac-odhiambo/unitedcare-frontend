import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { COLORS, FONT, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  nextDueLabel?: string; // e.g. "Slot 1 (Mon) - This week"
  nextDueAmount?: string; // e.g. "KES 1,000"
  loanStatus?: string; // e.g. "No active loan" / "Outstanding KES 12,300"
  onOpenMerryDues: () => void;
  onOpenLoans: () => void;
};

export default function MemberSnapshot({
  nextDueLabel = "Next merry due",
  nextDueAmount = "—",
  loanStatus = "—",
  onOpenMerryDues,
  onOpenLoans,
}: Props) {
  return (
    <Section title="My Snapshot">
      <Card>
        <TouchableOpacity style={styles.row} onPress={onOpenMerryDues} activeOpacity={0.85}>
          <View style={styles.left}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
            <View>
              <Text style={styles.label}>{nextDueLabel}</Text>
              <Text style={styles.muted}>Tap to view dues</Text>
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.value}>{nextDueAmount}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={onOpenLoans} activeOpacity={0.85}>
          <View style={styles.left}>
            <Ionicons name="cash-outline" size={18} color={COLORS.primary} />
            <View>
              <Text style={styles.label}>Loan</Text>
              <Text style={styles.muted}>Repayments & status</Text>
            </View>
          </View>
          <View style={styles.right}>
            <Text style={styles.value}>{loanStatus}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </View>
        </TouchableOpacity>
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  right: { flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "55%" },
  label: { fontSize: 13, fontFamily: FONT.semiBold, color: COLORS.text },
  muted: { marginTop: 2, fontSize: 12, fontFamily: FONT.regular, color: COLORS.textMuted },
  value: { fontSize: 12, fontFamily: FONT.bold, color: COLORS.text, textAlign: "right" },
  divider: { height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
});