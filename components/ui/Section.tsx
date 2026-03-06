// components/Section.tsx
import { COLORS, FONT, SPACING } from "@/constants/theme";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Props = {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode; // optional actions (button/link)
  style?: StyleProp<ViewStyle>;

  // ✅ NEW: allow removing the default top spacing for the content area
  noTopPadding?: boolean;
};

export default function Section({ title, children, right, style, noTopPadding }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {right ? <View>{right}</View> : null}
      </View>

      <View style={[styles.body, noTopPadding && styles.bodyNoTop]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontSize: FONT.section,
    fontFamily: FONT.bold,
    color: COLORS.dark,
  },

  // ✅ moved inline style into stylesheet
  body: {
    marginTop: SPACING.sm,
  },
  bodyNoTop: {
    marginTop: 0,
  },
});