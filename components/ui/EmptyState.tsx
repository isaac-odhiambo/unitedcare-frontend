import Button from "@/components/ui/Button";
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({
  icon = "information-circle-outline",
  title = "Nothing here yet",
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={28} color={COLORS.gray} />

      <Text style={styles.title}>{title}</Text>

      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}

      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={{ marginTop: SPACING.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    alignItems: "center",
    gap: 8,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: COLORS.dark,
  },

  sub: {
    fontFamily: FONT.regular,
    fontSize: 12,
    color: COLORS.gray,
    textAlign: "center",
  },
});