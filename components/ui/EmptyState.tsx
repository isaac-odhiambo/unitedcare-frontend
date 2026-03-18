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
      {/* Icon badge */}
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}

      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.action}
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
    padding: SPACING.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 48,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },

  title: {
    fontFamily: FONT.bold,
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
  },

  sub: {
    fontFamily: FONT.regular,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },

  action: {
    marginTop: SPACING.md,
    minWidth: 140,
  },
});