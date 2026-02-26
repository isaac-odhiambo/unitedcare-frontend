import { StyleSheet, Text, View } from "react-native";

interface Props {
  amount: number;
  paid: boolean;
  date: string;
}

export default function ContributionCard({ amount, paid, date }: Props) {
  return (
    <View style={styles.card}>
      <Text>Amount: KES {amount}</Text>
      <Text>Status: {paid ? "Paid ✅" : "Pending ⏳"}</Text>
      <Text>Date: {date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 3,
  },
});