import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
          <Ionicons name="wallet" size={28} color="#fff" />
          <Text style={styles.cardLabel}>Total Savings</Text>
          <Text style={styles.cardValue}>KES 25,000</Text>
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.accent }]}>
          <Ionicons name="cash" size={28} color="#fff" />
          <Text style={styles.cardLabel}>Outstanding Loans</Text>
          <Text style={styles.cardValue}>KES 10,000</Text>
        </View>
      </View>

      <View style={styles.cardRow}>
        <View style={[styles.card, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="people" size={28} color="#fff" />
          <Text style={styles.cardLabel}>Active Groups</Text>
          <Text style={styles.cardValue}>3</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="add-circle-outline" size={22} color="#fff" />
        <Text style={styles.actionText}>Add Savings</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="document-text-outline" size={22} color="#fff" />
        <Text style={styles.actionText}>Apply for Loan</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="people-outline" size={22} color="#fff" />
        <Text style={styles.actionText}>View Groups</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  cardRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    marginRight: 12,
  },
  cardLabel: {
    color: "#fff",
    fontSize: 14,
    marginTop: 10,
  },
  cardValue: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.dark,
    marginVertical: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  actionText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 12,
    fontWeight: "500",
  },
});
