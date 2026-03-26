import { NotificationProvider } from "@/context/NotificationContext";
import { setUnauthorizedHandler } from "@/services/api";
import { router, Stack } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      router.replace("/(auth)/login" as any);
    });
  }, []);

  return (
    <NotificationProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
      </Stack>
    </NotificationProvider>
  );
}