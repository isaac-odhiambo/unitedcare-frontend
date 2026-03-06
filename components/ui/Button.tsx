// components/ui/Button.tsx
import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
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
  loading,
  disabled,
  variant = "primary",
  style,
  leftIcon,
  rightIcon,
}: Props) {
  const isDisabled = !!disabled || !!loading;

  const textColor =
    variant === "secondary" || variant === "ghost" || variant === "outline"
      ? COLORS.dark
      : COLORS.white;

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
        variant === "outline" && styles.outline, // added
        isDisabled && styles.disabled,
        pressed && !isDisabled ? styles.pressed : null,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={textColor} />
        ) : leftIcon ? (
          <View style={styles.iconLeft}>{leftIcon}</View>
        ) : null}

        <Text
          style={[
            styles.text,
            { color: textColor },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    alignItems: "center",
    justifyContent: "center",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  iconLeft: { marginRight: SPACING.sm },
  iconRight: { marginLeft: SPACING.sm },

  primary: { backgroundColor: COLORS.primary },

  secondary: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  danger: { backgroundColor: COLORS.danger },

  ghost: {
    backgroundColor: "transparent",
  },

  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },

  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.9 },

  text: {
    fontFamily: FONT.bold,
    fontSize: 14,
  },
});