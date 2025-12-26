import { resetPassword } from "@/services/auth";
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

export default function ResetPasswordScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!otp || !password) {
      Alert.alert("Error", "OTP and new password are required");
      return;
    }

    if (password.length < 4) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 4 characters"
      );
      return;
    }

    try {
      setLoading(true);

      await resetPassword(phone!, otp, password);

      Alert.alert("Success", "Password reset successful");

      // 🔑 Auto-login → go to dashboard
      router.replace("/(tabs)");

    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.detail || "Password reset failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      <TextInput
        placeholder="OTP"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="New Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        onPress={handleResetPassword}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Resetting..." : "RESET PASSWORD"}
        </Text>
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
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
