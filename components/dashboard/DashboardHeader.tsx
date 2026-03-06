import { COLORS, FONT, SPACING } from "@/constants/theme";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  orgName?: string;
  subtitle?: string;
  userName?: string;
  role?: string;
  status?: string;
};

export default function DashboardHeader({
  orgName = "UNITED CARE",
  subtitle = "Self Help Group",
  userName,
  role,
  status,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.org}>{orgName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.right}>
        {userName ? <Text style={styles.user}>{userName}</Text> : null}
        {(role || status) ? (
          <View style={styles.badges}>
            {role ? (
              <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                <Text style={styles.badgeText}>{role.toUpperCase()}</Text>
              </View>
            ) : null}
            {status ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: status === "approved" ? COLORS.success : COLORS.warning },
                ]}
              >
                <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  left: { flex: 1 },
  right: { alignItems: "flex-end", gap: 6 },
  org: {
    fontSize: 22,
    fontFamily: FONT.bold,
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: FONT.regular,
    color: COLORS.textMuted,
  },
  user: {
    fontSize: 13,
    fontFamily: FONT.semiBold,
    color: COLORS.text,
  },
  badges: { flexDirection: "row", gap: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONT.semiBold,
    color: COLORS.white,
  },
});