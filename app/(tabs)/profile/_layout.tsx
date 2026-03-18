// app/(tabs)/profile/_layout.tsx
import { Stack } from "expo-router";
import React from "react";

export default function ProfileStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="kyc" />
    </Stack>
  );
}