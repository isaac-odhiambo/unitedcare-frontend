// components/ui/Button.tsx
import { COLORS, P, RADIUS, SHADOW, SPACING, TYPE } from "@/constants/theme";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

export type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;

  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  leftIcon,
  rightIcon,
}: Props) {
  const isDisabled = disabled || loading;

  const textColor =
    variant === "primary"
      ? COLORS.textInverse
      : variant === "danger"
      ? COLORS.textInverse
      : variant === "outline"
      ? COLORS.primary
      : variant === "ghost"
      ? COLORS.primary
      : COLORS.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "danger" && styles.danger,
        variant === "ghost" && styles.ghost,
        variant === "outline" && styles.outline,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : leftIcon ? (
          <View style={styles.iconLeft}>{leftIcon}</View>
        ) : null}

        <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
          {title}
        </Text>

        {!loading && rightIcon ? (
          <View style={styles.iconRight}>{rightIcon}</View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  iconLeft: {
    marginRight: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  iconRight: {
    marginLeft: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  primary: {
    ...P.buttonPrimary,
    ...SHADOW.soft,
  },

  secondary: {
    ...P.buttonSecondary,
    backgroundColor: COLORS.white,
  },

  danger: {
    backgroundColor: COLORS.danger,
    borderWidth: 1,
    borderColor: COLORS.danger,
    ...SHADOW.soft,
  },

  ghost: {
    backgroundColor: "transparent",
    paddingHorizontal: 6,
    minHeight: 42,
  },

  outline: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  disabled: {
    opacity: 0.55,
  },

  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },

  text: {
    ...TYPE.button,
    textAlign: "center",
  },
});