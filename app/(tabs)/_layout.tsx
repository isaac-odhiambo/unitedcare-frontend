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
          backgroundColor: COLORS.white,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      {/* Visible bottom tabs */}
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
        name="savings/index"
        options={{
          title: "Savings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="payments/index"
        options={{
          title: "Payments",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="loans/index"
        options={{
          title: "Loans",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="merry/index"
        options={{
          title: "Merry",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="repeat-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="groups/index"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />

      {/* Hidden savings screens */}
      <Tabs.Screen name="savings/create" options={{ href: null }} />
      <Tabs.Screen name="savings/[id]" options={{ href: null }} />
      <Tabs.Screen name="savings/history" options={{ href: null }} />

      {/* Hidden payments screens */}
      <Tabs.Screen name="payments/ledger" options={{ href: null }} />
      <Tabs.Screen name="payments/deposit" options={{ href: null }} />
      <Tabs.Screen name="payments/withdrawals" options={{ href: null }} />
      <Tabs.Screen
        name="payments/request-withdrawal"
        options={{ href: null }}
      />

      {/* Hidden loans screens */}
      <Tabs.Screen name="loans/request" options={{ href: null }} />
      <Tabs.Screen name="loans/pay" options={{ href: null }} />
      <Tabs.Screen name="loans/add-guarantor" options={{ href: null }} />
      <Tabs.Screen name="loans/gaurantees" options={{ href: null }} />
      <Tabs.Screen name="loans/[Id]" options={{ href: null }} />
      <Tabs.Screen name="loans/admin-approve" options={{ href: null }} />

      {/* Hidden merry screens */}
      <Tabs.Screen name="merry/contribute" options={{ href: null }} />
      <Tabs.Screen name="merry/history" options={{ href: null }} />
      <Tabs.Screen name="merry/join-requests" options={{ href: null }} />
      <Tabs.Screen name="merry/contributions" options={{ href: null }} />
      <Tabs.Screen name="merry/create" options={{ href: null }} />
      <Tabs.Screen name="merry/members" options={{ href: null }} />
      <Tabs.Screen name="merry/payouts-schedule" options={{ href: null }} />
      <Tabs.Screen name="merry/admin-join-requests" options={{ href: null }} />
      <Tabs.Screen name="merry/admin-payout-create" options={{ href: null }} />
      <Tabs.Screen name="merry/[id]" options={{ href: null }} />

      {/* Hidden groups screens - only existing ones */}
      <Tabs.Screen name="groups/[id]" options={{ href: null }} />
      <Tabs.Screen name="groups/available" options={{ href: null }} />
      <Tabs.Screen name="groups/contribute" options={{ href: null }} />
      <Tabs.Screen name="groups/create" options={{ href: null }} />
      <Tabs.Screen name="groups/history" options={{ href: null }} />
      <Tabs.Screen name="groups/join-requests" options={{ href: null }} />
      <Tabs.Screen name="groups/memberships" options={{ href: null }} />
      <Tabs.Screen
        name="groups/admin-join-requests"
        options={{ href: null }}
      />
      <Tabs.Screen name="groups/my-savings" options={{ href: null }} />

      {/* Hidden profile screens */}
      <Tabs.Screen name="profile/edit" options={{ href: null }} />
      <Tabs.Screen name="profile/kyc" options={{ href: null }} />
    </Tabs>
  );
}