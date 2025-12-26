import { registerUser } from "@/services/auth";
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

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // ✅ Required fields
    if (!username || !phone || !password) {
      Alert.alert("Error", "Username, phone and password are required");
      return;
    }

    // 🔎 Username validation (backend-aligned)
    if (!/^[A-Za-z]+$/.test(username)) {
      Alert.alert(
        "Invalid Username",
        "Username must contain letters only"
      );
      return;
    }

    // 🔎 Phone validation (backend-aligned)
    if (!/^(07|01)\d{8}$/.test(phone)) {
      Alert.alert(
        "Invalid Phone",
        "Use Kenyan format: 07XXXXXXXX or 01XXXXXXXX"
      );
      return;
    }

    // 🔎 ID number validation (OPTIONAL field)
    if (idNumber && !/^\d{1,9}$/.test(idNumber)) {
      Alert.alert(
        "Invalid ID Number",
        "ID number must be numeric and not more than 9 digits"
      );
      return;
    }

    // 🔎 Password validation
    if (password.length < 4) {
      Alert.alert(
        "Weak Password",
        "Password must be at least 4 characters"
      );
      return;
    }

    // ✅ Payload strictly matches backend
    const payload: any = {
      username,
      phone,
      password,
    };

    if (idNumber) {
      payload.id_number = idNumber;
    }

    try {
      setLoading(true);

      await registerUser(payload);

      Alert.alert("Success", "OTP sent to your phone");

      router.push({
        pathname: "../verify-otp",
        params: { phone },
      });

    } catch (err: any) {
      Alert.alert(
        "Registration Failed",
        err?.response?.data?.username ||
          err?.response?.data?.phone ||
          err?.response?.data?.id_number ||
          err?.response?.data?.detail ||
          "Please try again"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join UNITED CARE today</Text>

      <TextInput
        placeholder="Username (letters only)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Phone (07XXXXXXXX)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="ID Number (optional)"
        value={idNumber}
        onChangeText={setIdNumber}
        keyboardType="number-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Password (min 4 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity
        onPress={handleRegister}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Registering..." : "REGISTER"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.replace("../login")}
        disabled={loading}
      >
        <Text style={styles.link}>Already have an account? Login</Text>
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
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#0a7ea4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: "#0a7ea4",
    textAlign: "center",
  },
});
