import { resendOtp, verifyOtp } from "@/services/auth";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function VerifyOTPScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();

  if (!phone) {
    Alert.alert("Error", "Missing phone number");
    router.replace("/(auth)/register");
    return null;
  }

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!code) {
      Alert.alert("Error", "Please enter the OTP");
      return;
    }

    try {
      setLoading(true);

      await verifyOtp({
        phone: String(phone),
        code,
      });

      Alert.alert("Success", "Phone verified successfully");

      router.replace({
        pathname: "/(auth)/login",
      });
    } catch (err: any) {
      Alert.alert(
        "Verification Failed",
        err.response?.data?.error || "Invalid or expired OTP"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await resendOtp(String(phone));
      Alert.alert("Success", "OTP resent successfully");
    } catch {
      Alert.alert("Error", "Failed to resend OTP");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>
        Enter the code sent to {phone}
      </Text>

      <TextInput
        placeholder="Enter OTP"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        style={styles.input}
      />

      <TouchableOpacity
        onPressIn={handleVerify}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Verifying..." : "VERIFY OTP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPressIn={handleResend}>
        <Text style={styles.resend}>Resend OTP</Text>
      </TouchableOpacity>
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    color: "#0a7ea4",
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  resend: {
    textAlign: "center",
    color: "#0a7ea4",
    fontSize: 14,
  },
});
