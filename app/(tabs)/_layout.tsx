// app/(tabs)/_layout.tsx

import { COLORS } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAIN_THEME = "#0C6A80";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";
  const isIOS = Platform.OS === "ios";

  const baseHeight = isWeb ? 70 : isAndroid ? 66 : 70;
  const bottomInset = isWeb ? 0 : Math.max(insets.bottom, isIOS ? 10 : 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,

        // Preload tab screens so first switch is quieter
        lazy: false,

        sceneStyle: {
          backgroundColor: COLORS.background,
        },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.72)",
        tabBarStyle: {
          borderTopColor: "rgba(255,255,255,0.10)",
          borderTopWidth: 1,
          backgroundColor: MAIN_THEME,
          height: baseHeight + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          paddingHorizontal: 6,
          elevation: 0,
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarItemStyle: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingVertical: 4,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          textAlign: "center",
          paddingBottom: 2,
        },
      }}
    >
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
          title: "Support",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "heart" : "heart-outline"}
              color={color}
              size={20}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person-circle" : "person-circle-outline"}
              color={color}
              size={22}
            />
          ),
        }}
      />

      <Tabs.Screen name="notifications/index" options={{ href: null }} />

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

      <Tabs.Screen name="loans/[id]" options={{ href: null }} />
      <Tabs.Screen name="loans/add-guarantor" options={{ href: null }} />
      <Tabs.Screen name="loans/admin-approve" options={{ href: null }} />
      <Tabs.Screen name="loans/guarantee-requests" options={{ href: null }} />
      <Tabs.Screen name="loans/guarantees" options={{ href: null }} />
      <Tabs.Screen name="loans/history" options={{ href: null }} />
      <Tabs.Screen name="loans/pay" options={{ href: null }} />
      <Tabs.Screen name="loans/request" options={{ href: null }} />

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
      <Tabs.Screen name="groups/history" options={{ href: null }} />
      <Tabs.Screen name="groups/join-requests" options={{ href: null }} />
      <Tabs.Screen name="groups/memberships" options={{ href: null }} />
      <Tabs.Screen name="groups/dependants" options={{ href: null }} />
      <Tabs.Screen
        name="groups/admin-join-requests"
        options={{ href: null }}
      />
      <Tabs.Screen name="groups/my-savings" options={{ href: null }} />
    </Tabs>
  );
}