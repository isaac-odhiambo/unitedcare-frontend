import { Stack } from "expo-router";

const UI = {
  page: "#062C49",
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // 🔥 REMOVE ALL HEADERS
        contentStyle: { backgroundColor: UI.page }, // 🔥 match dashboard theme
        animation: "fade",
      }}
    >
      <Stack.Screen name="login" />

      <Stack.Screen name="register" />

      {/* <Stack.Screen name="verify-otp" /> */}

      <Stack.Screen name="forgot-password" />

      <Stack.Screen name="reset-password" />
    </Stack>
  );
}