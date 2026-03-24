// app/(tabs)/notifications/index.tsx
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
import useNotifications from "@/hooks/useNotifications";
import {
  AppNotification,
  NotificationType,
} from "@/services/notifications";

function formatWhen(value?: string | null) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function getTypeColor(type: NotificationType) {
  switch (String(type || "").toUpperCase()) {
    case "SUCCESS":
      return COLORS.secondary;
    case "WARNING":
      return "#D97706";
    case "ERROR":
      return COLORS.error || "#DC2626";
    case "ACTION":
      return COLORS.info || "#2563EB";
    default:
      return COLORS.primary;
  }
}

function getTypeIcon(type: NotificationType) {
  switch (String(type || "").toUpperCase()) {
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
      return "/(tabs)/profile/kyc";
    case "/notifications":
      return "/(tabs)/notifications";
    default:
      return actionUrl.startsWith("/") ? (actionUrl as any) : null;
  }
}

export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    load,
    refresh,
    markOneRead,
    markAllRead,
    removeOne,
  } = useNotifications({
    autoLoad: true,
    poll: true,
    pollIntervalMs: 10000,
    autoToastNew: false,
  });

  const [busyId, setBusyId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load])
  );

  const items = useMemo(
    () => (Array.isArray(notifications) ? notifications : []),
    [notifications]
  );

  const onRefresh = useCallback(async () => {
    try {
      await refresh();
    } catch (err: any) {
      Alert.alert(
        "Notifications",
        err?.message || "Failed to refresh notifications."
      );
    }
  }, [refresh]);

  const handleOpen = useCallback(
    async (item: AppNotification) => {
      try {
        setBusyId(item.id);

        if (!item.is_read) {
          await markOneRead(item.id);
        }

        const route = resolveRoute(item.action_url);
        if (route) {
          router.push(route as any);
        }
      } catch (err: any) {
        Alert.alert(
          "Notifications",
          err?.message || "Failed to open notification."
        );
      } finally {
        setBusyId(null);
      }
    },
    [markOneRead]
  );

  const handleDelete = useCallback(
    async (item: AppNotification) => {
      try {
        setBusyId(item.id);
        await removeOne(item.id);
      } catch (err: any) {
        Alert.alert(
          "Notifications",
          err?.message || "Failed to delete notification."
        );
      } finally {
        setBusyId(null);
      }
    },
    [removeOne]
  );

  const handleMarkAllRead = useCallback(async () => {
    try {
      setMarkingAll(true);
      await markAllRead();
    } catch (err: any) {
      Alert.alert(
        "Notifications",
        err?.message || "Failed to mark all notifications as read."
      );
    } finally {
      setMarkingAll(false);
    }
  }, [markAllRead]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loaderText}>Loading notifications.</Text>
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
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
                  style={[styles.card, !item.is_read ? styles.cardUnread : null]}
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
                              {String(item.notification_type || "INFO")}
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
    color: COLORS.gray || COLORS.textMuted || "#64748B",
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
    color: COLORS.gray || COLORS.textMuted || "#64748B",
    fontSize: 13,
  },

  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: COLORS.error || "#DC2626",
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
    ...((SHADOW as any)?.soft || (SHADOW as any) || {}),
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
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  cardBody: {
    flex: 1,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },

  cardTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    color: COLORS.text || "#0F172A",
  },

  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
  },

  newBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1D4ED8",
  },

  cardMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textMuted || "#64748B",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },

  metaText: {
    fontSize: 12,
    color: COLORS.gray || COLORS.textMuted || "#64748B",
  },

  metaDot: {
    fontSize: 12,
    color: COLORS.gray || COLORS.textMuted || "#64748B",
  },

  bottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },

  typePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.white || "#FFFFFF",
  },

  typePillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.primarySoft || "rgba(14, 94, 111, 0.10)",
  },

  openBtnText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
  },

  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(220, 38, 38, 0.10)",
  },

  deleteBtnText: {
    color: COLORS.error || "#DC2626",
    fontWeight: "700",
    fontSize: 12,
  },
});