import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import { COLORS, FONT, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type ActivityItem = {
  id: string | number;
  title: string;
  subtitle?: string;
  amount?: string; // "KES 1,000"
  tone?: "in" | "out" | "neutral";
  icon?: keyof typeof Ionicons.glyphMap;
};

type Props = {
  items: ActivityItem[];
};

export default function RecentActivity({ items }: Props) {
  return (
    <Section title="Recent Activity">
      <Card>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No recent activity yet.</Text>
          </View>
        ) : (
          items.map((a, idx) => (
            <View key={`${a.id}`} style={[styles.row, idx > 0 ? styles.dividerTop : null]}>
              <View style={styles.left}>
                <Ionicons
                  name={a.icon ?? "document-text-outline"}
                  size={18}
                  color={COLORS.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{a.title}</Text>
                  {a.subtitle ? <Text style={styles.subtitle}>{a.subtitle}</Text> : null}
                </View>
              </View>

              {a.amount ? (
                <Text
                  style={[
                    styles.amount,
                    a.tone === "in"
                      ? { color: COLORS.success }
                      : a.tone === "out"
                      ? { color: COLORS.danger }
                      : { color: COLORS.text },
                  ]}
                >
                  {a.amount}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  dividerTop: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  title: { fontSize: 13, fontFamily: FONT.semiBold, color: COLORS.text },
  subtitle: { marginTop: 2, fontSize: 12, fontFamily: FONT.regular, color: COLORS.textMuted },
  amount: { fontSize: 12, fontFamily: FONT.bold },
  empty: { padding: SPACING.md, flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { fontSize: 12, fontFamily: FONT.regular, color: COLORS.textMuted },
});