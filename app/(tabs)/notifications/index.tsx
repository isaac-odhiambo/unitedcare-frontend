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
import { SafeAreaView } from "react-native-safe-area-context";

import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Section from "@/components/ui/Section";
import { RADIUS, SHADOW, SPACING } from "@/constants/theme";
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
      return "#34D399";
    case "WARNING":
      return "#F59E0B";
    case "ERROR":
      return "#F87171";
    case "ACTION":
      return "#60A5FA";
    default:
      return "#8CF0C7";
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

    case "/profile/edit":
    case "/profile":
      return "/(tabs)/profile";

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
  const [hasBootstrapped, setHasBootstrapped] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const run = async () => {
        try {
          await load(true);
        } finally {
          if (active) {
            setHasBootstrapped(true);
          }
        }
      };

      run();

      return () => {
        active = false;
      };
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

  if (!hasBootstrapped && loading) {
    return <SafeAreaView style={styles.page} edges={["top"]} />;
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8CF0C7"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="notifications-outline" size={24} color="#0C6A80" />
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleMarkAllRead}
              disabled={markingAll || items.length === 0}
              style={[
                styles.readAllButton,
                (markingAll || items.length === 0) && styles.disabledButton,
              ]}
            >
              {markingAll ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-done-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.readAllButtonText}>Read all</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : "You are all caught up"}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <Section title="Recent updates">
          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <EmptyState
                title="No notifications yet"
                subtitle="Support updates, payment alerts, community messages, and action-needed updates will appear here."
              />
            </View>
          ) : (
            items.map((item) => {
              const typeColor = getTypeColor(item.notification_type);
              const iconName = getTypeIcon(item.notification_type);

              return (
                <Card
                  key={item.id}
                  style={[
                    styles.card,
                    !item.is_read ? styles.cardUnread : styles.cardRead,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => handleOpen(item)}
                  >
                    <View style={styles.cardTop}>
                      <View
                        style={[
                          styles.iconWrap,
                          { backgroundColor: `${typeColor}22` },
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
                              { borderColor: `${typeColor}66` },
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
                              <View style={styles.inlineBusyWrap}>
                                <ActivityIndicator size="small" color="#8CF0C7" />
                              </View>
                            ) : (
                              <>
                                <TouchableOpacity
                                  onPress={() => handleOpen(item)}
                                  style={styles.openBtn}
                                >
                                  <Ionicons
                                    name="arrow-forward-outline"
                                    size={14}
                                    color="#FFFFFF"
                                  />
                                  <Text style={styles.openBtnText}>Open</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                  onPress={() => handleDelete(item)}
                                  style={styles.deleteBtn}
                                >
                                  <Ionicons
                                    name="trash-outline"
                                    size={14}
                                    color="#FCA5A5"
                                  />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0A2230",
  },

  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(12,106,128,0.22)",
  },

  backgroundGlowBottom: {
    position: "absolute",
    bottom: -120,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(52,198,191,0.12)",
  },

  content: {
    padding: SPACING.lg,
    paddingBottom: 36,
  },

  heroCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 24,
    padding: 18,
    marginBottom: SPACING.lg,
    ...((SHADOW as any)?.soft || (SHADOW as any) || {}),
  },

  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },

  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(220,255,250,0.88)",
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "600",
  },

  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: "#FCA5A5",
    fontWeight: "700",
  },

  readAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0C6A80",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  readAllButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },

  disabledButton: {
    opacity: 0.5,
  },

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 22,
    overflow: "hidden",
  },

  card: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS?.xl || 20,
    padding: 0,
    overflow: "hidden",
    borderWidth: 1,
    ...((SHADOW as any)?.soft || (SHADOW as any) || {}),
  },

  cardUnread: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(140,240,199,0.20)",
  },

  cardRead: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(255,255,255,0.08)",
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.md,
    gap: SPACING.md,
  },

  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
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
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  newBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(140,240,199,0.18)",
    borderWidth: 1,
    borderColor: "rgba(140,240,199,0.25)",
  },

  newBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#8CF0C7",
  },

  cardMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.78)",
    fontWeight: "500",
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
    color: "rgba(255,255,255,0.62)",
    fontWeight: "600",
  },

  metaDot: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
  },

  bottomRow: {
    marginTop: 14,
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
    backgroundColor: "rgba(255,255,255,0.06)",
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

  inlineBusyWrap: {
    minWidth: 70,
    minHeight: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#0C6A80",
  },

  openBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.18)",
  },

  deleteBtnText: {
    color: "#FCA5A5",
    fontWeight: "800",
    fontSize: 12,
  },
});