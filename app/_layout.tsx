// app/_layout.tsx
import { NotificationProvider } from "@/context/NotificationContext";
import { setUnauthorizedHandler } from "@/services/api";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      router.replace("/(auth)/login" as any);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NotificationProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#FFFFFF" },
            animation: "fade",
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal" }}
          />
        </Stack>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}