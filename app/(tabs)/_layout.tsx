// app/(tabs)/_layout.tsx
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          borderTopColor: COLORS.lightGray,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {/* ✅ Visible tabs (keep it professional: 4 max) */}
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="payments/index"
        options={{
          title: "Pay",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="savings/index"
        options={{
          title: "Savings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />

      {/* ✅ Hidden from tab bar (still navigable from Dashboard tiles) */}
      <Tabs.Screen name="loans/index" options={{ href: null }} />
      <Tabs.Screen name="merry/index" options={{ href: null }} />
    </Tabs>
  );
}

// import { Tabs } from "expo-router";

// export default function TabsLayout() {
//   return (
//     <Tabs screenOptions={{ headerShown: true }}>
//       <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
//       <Tabs.Screen name="savings" options={{ title: "Savings" }} />
//       <Tabs.Screen name="merry" options={{ title: "Merry" }} />
//       <Tabs.Screen name="loans" options={{ title: "Loans" }} />
//       <Tabs.Screen name="profile" options={{ title: "Profile" }} />
//     </Tabs>
//   );
// }