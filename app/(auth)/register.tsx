import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { registerUser } from "@/services/auth";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !phone || !password) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    try {
      setLoading(true);
      await registerUser(username, email, phone, password);

      Alert.alert("Success", "Account created successfully. Please login.");
      router.replace("/login");
    } catch {
      Alert.alert("Registration Failed", "Please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join UNITED CARE today</Text>

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        style={styles.input}
      />

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Phone"
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
        onPress={handleRegister}
        disabled={loading}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {loading ? "Registering..." : "REGISTER"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

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
