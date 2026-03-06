import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type KPI = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "success" | "warning" | "danger" | "neutral";
};

type Props = {
  items: KPI[];
};

function toneColor(tone?: KPI["tone"]) {
  switch (tone) {
    case "success":
      return COLORS.success;
    case "warning":
      return COLORS.warning;
    case "danger":
      return COLORS.danger;
    case "neutral":
      return COLORS.card;
    case "primary":
    default:
      return COLORS.primary;
  }
}

export default function KpiRow({ items }: Props) {
  return (
    <View style={styles.row}>
      {items.map((k, idx) => (
        <View
          key={`${k.label}-${idx}`}
          style={[
            styles.card,
            { backgroundColor: k.tone === "neutral" ? COLORS.card : toneColor(k.tone) },
          ]}
        >
          <Ionicons
            name={k.icon}
            size={22}
            color={k.tone === "neutral" ? COLORS.text : COLORS.white}
          />
          <Text style={[styles.label, { color: k.tone === "neutral" ? COLORS.textMuted : COLORS.white }]}>
            {k.label}
          </Text>
          <Text style={[styles.value, { color: k.tone === "neutral" ? COLORS.text : COLORS.white }]}>
            {k.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: SPACING.lg,
    flexDirection: "row",
    gap: SPACING.md,
  },
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: FONT.regular,
  },
  value: {
    fontSize: 16,
    fontFamily: FONT.bold,
  },
});