import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";


type DecodedToken = {
  username: string;
  role?: string;
};

export default function ProfileScreen() {
  const [username, setUsername] = useState<string>("");
  const [role, setRole] = useState<string>("member");

  useEffect(() => {
    const loadUser = async () => {
      const token = await AsyncStorage.getItem("access");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setUsername(decoded.username);
        if (decoded.role) setRole(decoded.role);
      } catch {
        handleLogout();
      }
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem("access");
    await AsyncStorage.removeItem("refresh");

    router.replace("/login");
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 20,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>
        Profile
      </Text>

      <Text style={{ fontSize: 16, marginBottom: 10 }}>
        Username: {username}
      </Text>

      <Text style={{ fontSize: 16, marginBottom: 30 }}>
        Role: {role}
      </Text>

      <TouchableOpacity
        onPress={handleLogout}
        style={{
          backgroundColor: "#e53935",
          padding: 15,
          borderRadius: 8,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 16 }}>
          LOGOUT
        </Text>
      </TouchableOpacity>
    </View>
  );
}
