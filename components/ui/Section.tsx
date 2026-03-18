// components/ui/Section.tsx
import { COLORS, FONT, SPACING } from "@/constants/theme";
import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

type Props = {
  title: string;
  subtitle?: string;

  children: React.ReactNode;

  right?: React.ReactNode;

  style?: StyleProp<ViewStyle>;

  noTopPadding?: boolean;

  showDivider?: boolean;
};

export default function Section({
  title,
  subtitle,
  children,
  right,
  style,
  noTopPadding,
  showDivider,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>

          {subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>

        {right ? <View>{right}</View> : null}
      </View>

      {showDivider && <View style={styles.divider} />}

      <View style={[styles.body, noTopPadding && styles.bodyNoTop]}>
        {children}
      </View>
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

  titleWrap: {
    flex: 1,
  },

  title: {
    fontSize: FONT.section,
    fontFamily: FONT.bold,
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 2,
    fontSize: FONT.caption,
    color: COLORS.textMuted,
    fontFamily: FONT.regular,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginTop: SPACING.sm,
  },

  body: {
    marginTop: SPACING.md,
  },

  bodyNoTop: {
    marginTop: 0,
  },
});