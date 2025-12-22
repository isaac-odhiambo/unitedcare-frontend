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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "@/services/auth";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    try {
      setLoading(true);
      const data = await loginUser(username, password);

      await AsyncStorage.setItem("access", data.access);
      await AsyncStorage.setItem("refresh", data.refresh);

      router.replace("/(tabs)");
    } catch {
      Alert.alert("Login Failed", "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UNITED CARE</Text>
      <Text style={styles.subtitle}>Login to your account</Text>

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
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

      <TouchableOpacity onPress={() => router.push("/register")}>
        <Text style={styles.link}>Don’t have an account? Register</Text>
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
    alignItems: "center", // ✅ now correctly typed
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
