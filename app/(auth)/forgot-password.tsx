import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { forgotPassword } from "@/services/auth";

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    if (!phone) {
      Alert.alert("Missing phone", "Enter your phone number.");
      return;
    }
    if (!/^(07|01)\d{8}$/.test(phone)) {
      Alert.alert("Invalid phone", "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX.");
      return;
    }

    try {
      setLoading(true);
      await forgotPassword({ phone });
      Alert.alert("OTP Sent", "Password reset OTP sent to your phone.");
      router.push({ pathname: "/(auth)/reset-password", params: { phone } });
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Failed to send OTP.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Forgot Password</Text>

      <TextInput
        placeholder="Phone (07XXXXXXXX)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      <TouchableOpacity
        onPress={handleRequestOtp}
        disabled={loading}
        style={{
          backgroundColor: "black",
          padding: 14,
          borderRadius: 10,
          alignItems: "center",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Sending..." : "Send OTP"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// /* =========================
//    STYLES
// ========================= */
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: "center",
//     padding: 24,
//   },
//   title: {
//     fontSize: 26,
//     fontWeight: "bold",
//     textAlign: "center",
//     color: "#0a7ea4",
//     marginBottom: 8,
//   },
//   subtitle: {
//     textAlign: "center",
//     color: "#666",
//     marginBottom: 30,
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: "#ddd",
//     borderRadius: 10,
//     padding: 14,
//     marginBottom: 16,
//     backgroundColor: "#fff",
//   },
//   button: {
//     backgroundColor: "#0a7ea4",
//     padding: 16,
//     borderRadius: 10,
//     alignItems: "center",
//     marginBottom: 20,
//   },
//   buttonText: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: "bold",
//   },
//   link: {
//     color: "#0a7ea4",
//     textAlign: "center",
//   },
// });
