// app/_layout.tsx

import { NotificationProvider } from "@/context/NotificationContext";
import { setUnauthorizedHandler } from "@/services/api";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

const UI = {
  page: "#062C49", // your main app background
};

export default function RootLayout() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      router.replace("/(auth)/login" as any);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NotificationProvider>

        {/* Match your app dark theme */}
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false, // 🔥 FORCE NO HEADER ANYWHERE
            animation: "fade",
            contentStyle: {
              backgroundColor: UI.page, // 🔥 match dashboard theme
            },
          }}
        >
          {/* AUTH FLOW */}
          <Stack.Screen
            name="(auth)"
            options={{
              headerShown: false,
              animation: "fade",
            }}
          />

          {/* MAIN APP */}
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />

          {/* MODALS */}
          <Stack.Screen
            name="modal"
            options={{
              presentation: "transparentModal",
              headerShown: false,
            }}
          />
        </Stack>
      </NotificationProvider>
    </SafeAreaProvider>
  );
}