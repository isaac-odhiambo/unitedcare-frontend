import { loginUser } from "@/services/auth";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    console.log("✅ LOGIN BUTTON CLICKED");

    if (!phone || !password) {
      Alert.alert("Error", "Phone and password are required");
      return;
    }

    // 🔎 Frontend phone validation (UX only)
    if (!/^(07|01)\d{8}$/.test(phone)) {
      Alert.alert(
        "Invalid Phone",
        "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX"
      );
      return;
    }

    try {
      setLoading(true);
      console.log("🚀 SENDING LOGIN REQUEST", { phone });

      const response = await loginUser(phone, password);
      console.log("✅ LOGIN RESPONSE:", response);

      Alert.alert("Success", "Login successful");

      // ✅ Redirect to dashboard
      router.replace("/(tabs)");

    } catch (err: any) {
      console.log("❌ LOGIN ERROR:", err);

      const errorMsg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors ||
        "Invalid phone or password";

      // 🔐 Account not activated → redirect to OTP verification
      if (errorMsg.toLowerCase().includes("not activated")) {
        Alert.alert(
          "Verify Account",
          "Your account is not activated. Please verify using OTP.",
          [
            {
              text: "Verify Now",
              onPress: () =>
                router.push({
                  pathname: "/(auth)/verify-otp",
                  params: { phone },
                }),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      // 🔒 Account locked feedback
      if (errorMsg.toLowerCase().includes("locked")) {
        Alert.alert("Account Locked", errorMsg);
        return;
      }

      Alert.alert("Login Failed", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UNITED CARE</Text>
      <Text style={styles.subtitle}>Login to your account</Text>

      <TextInput
        placeholder="Phone (07XXXXXXXX)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Logging in..." : "LOGIN"}
        </Text>
      </TouchableOpacity>

      {/* 🔑 FORGOT PASSWORD */}
      <TouchableOpacity
        disabled={loading}
        onPress={() => router.push("/(auth)/forgot-password")}
      >
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      {/* 🔁 REGISTER */}
      <TouchableOpacity
        disabled={loading}
        onPress={() => router.push("/(auth)/register")}
      >
        <Text style={styles.link}>Don’t have an account? Register</Text>
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
    fontSize: 28,
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
    marginBottom: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: "#0a7ea4",
    textAlign: "center",
    marginTop: 10,
  },
});
