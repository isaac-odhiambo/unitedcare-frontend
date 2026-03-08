import { getErrorMessage } from "@/services/api";
import { forgotPassword } from "@/services/auth";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function ForgotPasswordScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async () => {
    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      Alert.alert("Missing phone", "Enter your phone number.");
      return;
    }

    if (!/^(07|01)\d{8}$/.test(cleanPhone)) {
      Alert.alert(
        "Invalid phone",
        "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX."
      );
      return;
    }

    try {
      setLoading(true);

      await forgotPassword({ phone: cleanPhone });

      Alert.alert("OTP Sent", "Password reset OTP sent to your phone.");

      router.push({
        pathname: "/(auth)/reset-password",
        params: { phone: cleanPhone },
      });
    } catch (e: any) {
      Alert.alert("Error", getErrorMessage(e));
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
        autoCapitalize="none"
        autoCorrect={false}
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