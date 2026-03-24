// app/(tabs)/_layout.tsx
import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";

export default function TabsLayout() {
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: {
          borderTopColor: COLORS.lightGray,
          backgroundColor: COLORS.white,
          height: isWeb ? 92 : 80,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "600",
          textAlign: "center",
        },
      }}
    >
      {/* Visible tabs */}
      <Tabs.Screen
        name="dashboard/index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="savings/index"
        options={{
          title: "Save",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "wallet" : "wallet-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="merry/index"
        options={{
          title: "Merry",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "repeat" : "repeat-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="groups/index"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="loans/index"
        options={{
          title: "Loans",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cash" : "cash-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile/index"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      {/* Hidden routes */}
      <Tabs.Screen name="notifications/index" options={{ href: null }} />

      <Tabs.Screen name="savings/create" options={{ href: null }} />
      <Tabs.Screen name="savings/[id]" options={{ href: null }} />
      <Tabs.Screen name="savings/history" options={{ href: null }} />
      <Tabs.Screen name="savings/save" options={{ href: null }} />

      <Tabs.Screen name="payments/index" options={{ href: null }} />
      <Tabs.Screen name="payments/ledger" options={{ href: null }} />
      <Tabs.Screen name="payments/deposit" options={{ href: null }} />
      <Tabs.Screen name="payments/withdrawals" options={{ href: null }} />
      <Tabs.Screen
        name="payments/request-withdrawal"
        options={{ href: null }}
      />

      <Tabs.Screen name="loans/request" options={{ href: null }} />
      <Tabs.Screen name="loans/pay" options={{ href: null }} />
      <Tabs.Screen name="loans/add-guarantor" options={{ href: null }} />
      <Tabs.Screen name="loans/gaurantees" options={{ href: null }} />
      <Tabs.Screen name="loans/guarantee-requests" options={{ href: null }} />
      <Tabs.Screen name="loans/[Id]" options={{ href: null }} />
      <Tabs.Screen name="loans/admin-approve" options={{ href: null }} />

      <Tabs.Screen name="merry/contribute" options={{ href: null }} />
      <Tabs.Screen name="merry/history" options={{ href: null }} />
      <Tabs.Screen name="merry/join-request" options={{ href: null }} />
      <Tabs.Screen name="merry/contributions" options={{ href: null }} />
      <Tabs.Screen name="merry/create" options={{ href: null }} />
      <Tabs.Screen name="merry/members" options={{ href: null }} />
      <Tabs.Screen name="merry/payouts-schedule" options={{ href: null }} />
      <Tabs.Screen
        name="merry/admin-join-requests"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="merry/admin-payout-create"
        options={{ href: null }}
      />
      <Tabs.Screen name="merry/[id]" options={{ href: null }} />

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

      <Tabs.Screen name="profile/edit" options={{ href: null }} />
      <Tabs.Screen name="profile/kyc" options={{ href: null }} />
    </Tabs>
  );
}