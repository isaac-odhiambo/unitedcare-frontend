// hooks/useNotifications.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNotification } from "@/context/NotificationContext";
import {
    AppNotification,
    deleteNotification,
    getMyNotifications,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
} from "@/services/notifications";

type UseNotificationsOptions = {
  autoLoad?: boolean;
  poll?: boolean;
  pollIntervalMs?: number;
  autoToastNew?: boolean;
  autoMarkToastAsRead?: boolean;
};

type UseNotificationsReturn = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  load: (silent?: boolean) => Promise<void>;
  refresh: () => Promise<void>;

  markOneRead: (notificationId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeOne: (notificationId: number) => Promise<void>;

  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
};

function sortNewestFirst(items: AppNotification[]) {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return bTime - aTime;
  });
}

function normalizeType(type?: string) {
  const value = String(type || "INFO").toUpperCase();

  if (value === "SUCCESS") return "SUCCESS";
  if (value === "WARNING") return "WARNING";
  if (value === "ERROR") return "ERROR";
  if (value === "ACTION") return "ACTION";
  return "INFO";
}

function getToastDuration(type?: string) {
  const normalized = normalizeType(type);

  switch (normalized) {
    case "SUCCESS":
      return 3000;
    case "WARNING":
      return 4500;
    case "ERROR":
      return 5000;
    case "ACTION":
      return 0;
    case "INFO":
    default:
      return 3200;
  }
}

export default function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const {
    autoLoad = true,
    poll = false,
    pollIntervalMs = 15000,
    autoToastNew = true,
    autoMarkToastAsRead = false,
  } = options;

  const { showToast } = useNotification();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(autoLoad);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const firstLoadDoneRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncSeenIds = useCallback((items: AppNotification[]) => {
    seenIdsRef.current = new Set(items.map((item) => item.id));
  }, []);

  const handleAutoToasts = useCallback(
    async (items: AppNotification[]) => {
      if (!autoToastNew) return;

      if (!firstLoadDoneRef.current) {
        syncSeenIds(items);
        firstLoadDoneRef.current = true;
        return;
      }

      const newUnreadItems = sortNewestFirst(items).filter(
        (item) =>
          !item.is_read &&
          !item.is_deleted &&
          !seenIdsRef.current.has(item.id)
      );

      syncSeenIds(items);

      for (const item of newUnreadItems) {
        showToast({
          type: normalizeType(item.notification_type),
          title: item.title || "New notification",
          message: item.message || "",
          duration: getToastDuration(item.notification_type),
          actionLabel: item.action_url ? "Open" : undefined,
        });

        if (autoMarkToastAsRead) {
          try {
            await markNotificationRead(item.id);
          } catch {
            // keep silent so toast flow is not broken
          }
        }
      }
    },
    [autoToastNew, autoMarkToastAsRead, showToast, syncSeenIds]
  );

  const load = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        setError(null);

        const [items, unread] = await Promise.all([
          getMyNotifications(),
          getUnreadNotificationCount(),
        ]);

        const sorted = sortNewestFirst(items || []);
        setNotifications(sorted);
        setUnreadCount(Number.isFinite(unread) ? unread : 0);

        await handleAutoToasts(sorted);
      } catch (err: any) {
        setError(err?.message || "Failed to load notifications.");
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [handleAutoToasts]
  );

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const markOneRead = useCallback(
    async (notificationId: number) => {
      try {
        await markNotificationRead(notificationId);

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  is_read: true,
                  read_at: item.read_at ?? new Date().toISOString(),
                }
              : item
          )
        );

        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err: any) {
        showToast({
          type: "ERROR",
          title: "Could not update notification",
          message: err?.message || "Please try again.",
        });
      }
    },
    [showToast]
  );

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: item.read_at ?? new Date().toISOString(),
        }))
      );

      setUnreadCount(0);
    } catch (err: any) {
      showToast({
        type: "ERROR",
        title: "Could not mark all as read",
        message: err?.message || "Please try again.",
      });
    }
  }, [showToast]);

  const removeOne = useCallback(
    async (notificationId: number) => {
      try {
        const target = notifications.find((item) => item.id === notificationId);

        await deleteNotification(notificationId);

        setNotifications((prev) =>
          prev.filter((item) => item.id !== notificationId)
        );

        if (target && !target.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err: any) {
        showToast({
          type: "ERROR",
          title: "Could not delete notification",
          message: err?.message || "Please try again.",
        });
      }
    },
    [notifications, showToast]
  );

  useEffect(() => {
    if (!autoLoad) return;
    load();
  }, [autoLoad, load]);

  useEffect(() => {
    if (!poll) return;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    pollingRef.current = setInterval(() => {
      load(true);
    }, pollIntervalMs);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [poll, pollIntervalMs, load]);

  const value = useMemo(
    () => ({
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
      setNotifications,
    }),
    [
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
    ]
  );

  return value;
}