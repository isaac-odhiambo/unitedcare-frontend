import { useState } from "react";
import { View, TextInput, Button, Alert, Text } from "react-native";
import { useRouter } from "expo-router";
import { loginUser } from "../services/auth";

export default function Login() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert("Error", "Phone and password are required");
      return;
    }

    try {
      setLoading(true);
      await loginUser(phone, password);
      Alert.alert("Success", "Login successful");
      router.replace("/"); // 🔴 change to dashboard later
    } catch (err: any) {
      Alert.alert(
        "Login Failed",
        err.response?.data?.non_field_errors ||
        err.response?.data?.detail ||
        "Invalid credentials"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ marginBottom: 10 }}>Login</Text>

      <TextInput
        placeholder="Phone"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        style={{
          borderWidth: 1,
          borderRadius: 6,
          padding: 10,
          marginBottom: 15,
        }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderRadius: 6,
          padding: 10,
          marginBottom: 20,
        }}
      />

      <Button
        title={loading ? "Logging in..." : "Login"}
        onPress={handleLogin}
        disabled={loading}
      />
    </View>
  );
}
