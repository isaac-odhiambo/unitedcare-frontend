import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import React from "react";
import {
  GestureResponderEvent,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from "react-native";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>; // <-- ADD THIS instead of changing the rest
  onPress?: (event: GestureResponderEvent) => void;
};

export default function Card({ children, style, onPress }: Props) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && onPress ? styles.pressed : null,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },

  pressed: {
    opacity: 0.96,
  },
});