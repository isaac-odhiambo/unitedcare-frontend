import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  tone?: "info" | "warning" | "success";
  title: string;
  message: string;
};

function toneBg(tone: Props["tone"]) {
  switch (tone) {
    case "success":
      return "rgba(34,197,94,0.10)";
    case "warning":
      return "rgba(245,158,11,0.12)";
    case "info":
    default:
      return "rgba(59,130,246,0.10)";
  }
}

function toneIcon(tone: Props["tone"]): keyof typeof Ionicons.glyphMap {
  switch (tone) {
    case "success":
      return "checkmark-circle-outline";
    case "warning":
      return "alert-circle-outline";
    case "info":
    default:
      return "information-circle-outline";
  }
}

export default function InfoBanner({ tone = "info", title, message }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor: toneBg(tone) }]}>
      <Ionicons name={toneIcon(tone)} size={18} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.msg}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  title: { fontSize: 13, fontFamily: FONT.semiBold, color: COLORS.text },
  msg: { marginTop: 3, fontSize: 12, fontFamily: FONT.regular, color: COLORS.textMuted },
});