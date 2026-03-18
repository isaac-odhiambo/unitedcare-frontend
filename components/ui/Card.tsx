import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import React from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

export type CardVariant = "default" | "soft" | "elevated";

type Props = {
  children: React.ReactNode;

  style?: StyleProp<ViewStyle>;

  onPress?: (event: GestureResponderEvent) => void;

  variant?: CardVariant;

  padding?: boolean;
};

export default function Card({
  children,
  style,
  onPress,
  variant = "default",
  padding = true,
}: Props) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,

        variant === "default" && styles.default,
        variant === "soft" && styles.soft,
        variant === "elevated" && styles.elevated,

        padding && styles.padding,

        pressed && onPress ? styles.pressed : null,

        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  padding: {
    padding: SPACING.md,
  },

  default: {
    backgroundColor: COLORS.card,
    ...SHADOW.card,
  },

  soft: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.gray200,
  },

  elevated: {
    backgroundColor: COLORS.card,
    ...SHADOW.strong,
  },

  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.97,
  },
});