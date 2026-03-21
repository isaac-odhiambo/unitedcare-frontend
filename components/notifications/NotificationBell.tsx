// components/notifications/NotificationBell.tsx
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "@/constants/theme";
import { getUnreadNotificationCount } from "@/services/notifications";

export default function NotificationBell() {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const unread = await getUnreadNotificationCount();
      setCount(unread);
    } catch {
      setCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCount();
    }, [loadCount])
  );

  return (
    <TouchableOpacity
      onPress={() => router.push("/notifications")}
      activeOpacity={0.85}
      style={styles.wrap}
    >
      <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />

      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: 3,
    right: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.danger ?? "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});