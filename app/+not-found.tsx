// app/+not-found.tsx
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Text, TouchableOpacity, View } from "react-native";

export default function NotFound() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <Ionicons name="alert-circle-outline" size={54} color="black" />
      <Text style={{ fontSize: 22, fontWeight: "800", marginTop: 14 }}>Page not found</Text>
      <Text style={{ textAlign: "center", marginTop: 8, opacity: 0.7 }}>
        That screen doesn’t exist or the route is wrong.
      </Text>

      <TouchableOpacity
        onPress={() => router.replace("/(tabs)/dashboard")}
        style={{
          marginTop: 18,
          backgroundColor: "black",
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 10,
        }}
        activeOpacity={0.9}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Go to Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          marginTop: 12,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#ddd",
        }}
        activeOpacity={0.9}
      >
        <Text style={{ fontWeight: "700" }}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}