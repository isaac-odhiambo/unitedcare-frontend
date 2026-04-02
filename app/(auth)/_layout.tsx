import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ title: "Register", headerShown: true }} />
      {/* <Stack.Screen name="verify-otp" options={{ title: "Verify OTP", headerShown: true }} /> */}
      <Stack.Screen name="forgot-password" options={{ title: "Forgot Password", headerShown: true }} />
      <Stack.Screen name="reset-password" options={{ title: "Reset Password", headerShown: true }} />
    </Stack>
  );
}