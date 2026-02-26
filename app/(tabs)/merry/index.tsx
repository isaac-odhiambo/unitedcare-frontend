import { router } from "expo-router";
import { Button, Text, View } from "react-native";

export default function MerryDashboard() {
  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold" }}>
        Merry-Go-Round
      </Text>

      <Button
        title="Make Contribution"
        onPress={() => router.push("./contribute")}
      />

      <Button
        title="View History"
        onPress={() => router.push("./history")}
      />
    </View>
  );
}
