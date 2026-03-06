import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ActionItem = {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
};

type Props = {
  items: ActionItem[];
};

export default function QuickActions({ items }: Props) {
  return (
    <View style={styles.grid}>
      {items.map((a, i) => (
        <TouchableOpacity
          key={`${a.title}-${i}`}
          style={[styles.tile, a.disabled ? styles.tileDisabled : null]}
          activeOpacity={0.85}
          onPress={a.disabled ? undefined : a.onPress}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={a.icon} size={20} color={COLORS.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{a.title}</Text>
            {a.subtitle ? <Text style={styles.subtitle}>{a.subtitle}</Text> : null}
          </View>

          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  tile: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  tileDisabled: { opacity: 0.55 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },
});