import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";
import { COLORS, RADIUS, SHADOW, SPACING } from "@/constants/theme";
import {
    deleteNotification,
    getMyNotifications,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/services/notifications";

type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "ACTION"
  | string;

type AppNotification = {
  id: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  action_url?: string | null;
  loan_id?: number | null;
  merry_id?: number | null;
  group_id?: number | null;
  is_read: boolean;
  is_deleted?: boolean;
  sender_name?: string;
  created_at: string;
  read_at?: string | null;
};

function formatWhen(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function getTypeColor(type: NotificationType) {
  switch (type) {
    case "SUCCESS":
      return "#15803D";
    case "WARNING":
      return "#D97706";
    case "ERROR":
      return "#DC2626";
    case "ACTION":
      return "#2563EB";
    default:
      return COLORS.primary;
  }
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case "SUCCESS":
      return "checkmark-circle";
    case "WARNING":
      return "alert-circle";
    case "ERROR":
      return "close-circle";
    case "ACTION":
      return "flash";
    default:
      return "information-circle";
  }
}

function resolveRoute(actionUrl?: string | null) {
  if (!actionUrl) return null;

  switch (actionUrl) {
    case "/dashboard":
      return "/(tabs)/dashboard";
    case "/loans/my-loans":
      return "/(tabs)/loans";
    case "/merry":
      return "/(tabs)/merry";
    case "/savings":
      return "/(tabs)/savings";
    case "/profile/kyc":
      return "/profile/kyc";
    default:
      return null;
  }
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items]
  );

  const loadNotifications = useCallback(async () => {
    try {
      const rows = await getMyNotifications();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error: any) {
      Alert.alert(
        "Notifications",
        error?.message || "Failed to load notifications."
      );
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleOpen = useCallback(async (item: AppNotification) => {
    try {
      if (!item.is_read) {
        setBusyId(item.id);
        await markNotificationRead(item.id);

        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  is_read: true,
                  read_at: row.read_at ?? new Date().toISOString(),
                }
              : row
          )
        );
      }

      const route = resolveRoute(item.action_url);
      if (route) {
        router.push(route as any);
      }
    } catch (error: any) {
      Alert.alert(
        "Notifications",
        error?.message || "Failed to open notification."
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleDelete = useCallback(async (item: AppNotification) => {
    try {
      setBusyId(item.id);
      await deleteNotification(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (error: any) {
      Alert.alert(
        "Notifications",
        error?.message || "Failed to delete notification."
      );
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();

      setItems((prev) =>
        prev.map((row) => ({
          ...row,
          is_read: true,
          read_at: row.read_at ?? new Date().toISOString(),
        }))
      );
    } catch (error: any) {
      Alert.alert(
        "Notifications",
        error?.message || "Failed to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loaderText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                : "You are all caught up"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleMarkAllRead}
            disabled={markingAll || items.length === 0}
            style={[
              styles.readAllButton,
              (markingAll || items.length === 0) && styles.disabledButton,
            ]}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-done-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={styles.readAllButtonText}>Read all</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Section title="Recent updates">
          {items.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              subtitle="Admin messages, loan updates, payment alerts, and action-needed updates will appear here."
            />
          ) : (
            items.map((item) => {
              const typeColor = getTypeColor(item.notification_type);
              const iconName = getTypeIcon(item.notification_type);

              return (
                <Card
                  key={item.id}
                  style={[
                    styles.card,
                    !item.is_read ? styles.cardUnread : null,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => handleOpen(item)}
                  >
                    <View style={styles.cardTop}>
                      <View
                        style={[
                          styles.iconWrap,
                          { backgroundColor: `${typeColor}18` },
                        ]}
                      >
                        <Ionicons
                          name={iconName as any}
                          size={20}
                          color={typeColor}
                        />
                      </View>

                      <View style={styles.cardBody}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.cardTitle}>{item.title}</Text>

                          {!item.is_read ? (
                            <View style={styles.newBadge}>
                              <Text style={styles.newBadgeText}>New</Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={styles.cardMessage}>{item.message}</Text>

                        <View style={styles.metaRow}>
                          <Text style={styles.metaText}>
                            {item.sender_name || "System"}
                          </Text>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.metaText}>
                            {formatWhen(item.created_at)}
                          </Text>
                        </View>

                        <View style={styles.bottomRow}>
                          <View
                            style={[
                              styles.typePill,
                              { borderColor: `${typeColor}55` },
                            ]}
                          >
                            <Text
                              style={[styles.typePillText, { color: typeColor }]}
                            >
                              {item.notification_type}
                            </Text>
                          </View>

                          <View style={styles.actionsRow}>
                            {busyId === item.id ? (
                              <ActivityIndicator
                                size="small"
                                color={COLORS.primary}
                              />
                            ) : (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleOpen(item)}
                                  style={styles.openBtn}
                                >
                                  <Text style={styles.openBtnText}>Open</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => handleDelete(item)}
                                  style={styles.deleteBtn}
                                >
                                  <Text style={styles.deleteBtnText}>
                                    Delete
                                  </Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || "#F8FAFC",
  },

  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background || "#F8FAFC",
  },

  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.gray || "#64748B",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl || 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text || "#0F172A",
  },

  subtitle: {
    marginTop: 4,
    color: COLORS.gray || "#64748B",
    fontSize: 13,
  },

  readAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  readAllButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },

  disabledButton: {
    opacity: 0.6,
  },

  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS?.xl || 18,
    padding: 0,
    overflow: "hidden",
    ...SHADOW,
  },

  cardUnread: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#F8FBFF",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.md,
    gap: SPACING.md,
  },

  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  cardBody: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text || "#0F172A",
  },

  newBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  newBadgeText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "800",
  },

  cardMessage: {
    marginTop: 8,
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
  },

  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },

  metaText: {
    fontSize: 12,
    color: COLORS.gray || "#64748B",
  },

  metaDot: {
    marginHorizontal: 6,
    fontSize: 12,
    color: COLORS.gray || "#64748B",
  },

  bottomRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  typePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },

  typePillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  openBtn: {
    paddingVertical: 4,
  },

  openBtnText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 13,
  },

  deleteBtn: {
    paddingVertical: 4,
  },

  deleteBtnText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
});