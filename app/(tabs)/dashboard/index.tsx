import { COLORS, FONT, RADIUS, SPACING } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>UNITED CARE</Text>
        <Text style={styles.subtitle}>Self Help Group</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.cardRow}>
        <View style={[styles.card, { backgroundColor: COLORS.success }]}>
          <Ionicons name="wallet" size={28} color={COLORS.white} />
          <Text style={styles.cardLabel}>Total Savings</Text>
          <Text style={styles.cardValue}>KES 25,000</Text>
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.accent, marginRight: 0 }]}>
          <Ionicons name="cash" size={28} color={COLORS.white} />
          <Text style={styles.cardLabel}>Outstanding Loans</Text>
          <Text style={styles.cardValue}>KES 10,000</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.card, { backgroundColor: COLORS.primary, marginRight: 0 }]}>
          <Ionicons name="people" size={28} color={COLORS.white} />
          <Text style={styles.cardLabel}>Active Groups</Text>
          <Text style={styles.cardValue}>3</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => router.push("/(tabs)/savings")}
      >
        <Ionicons name="add-circle-outline" size={22} color={COLORS.white} />
        <Text style={styles.actionText}>Add Savings</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => router.push("/(tabs)/loans")}
      >
        <Ionicons name="document-text-outline" size={22} color={COLORS.white} />
        <Text style={styles.actionText}>Apply for Loan</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => router.push("/(tabs)/merry")}
      >
        <Ionicons name="people-outline" size={22} color={COLORS.white} />
        <Text style={styles.actionText}>View Merry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  appName: {
    fontSize: FONT.title,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: FONT.subtitle,
    color: COLORS.gray,
    marginTop: SPACING.xs,
  },
  cardRow: {
    flexDirection: "row",
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  cardLabel: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  cardValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "bold",
    marginTop: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT.section,
    fontWeight: "bold",
    color: COLORS.dark,
    marginVertical: SPACING.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  actionText: {
    color: COLORS.white,
    fontSize: FONT.body,
    marginLeft: SPACING.sm,
    fontWeight: "500",
  },
});