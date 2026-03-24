// services/notifications.ts
import { api } from "@/services/api";

export type NotificationType =
  | "INFO"
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "ACTION"
  | string;

export type AppNotification = {
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

type NotificationListResponse =
  | AppNotification[]
  | {
      results?: AppNotification[];
      count?: number;
      next?: string | null;
      previous?: string | null;
    };

function normalizeNotificationList(data: NotificationListResponse): AppNotification[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function sortNewestFirst(items: AppNotification[]): AppNotification[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return bTime - aTime;
  });
}

export async function getMyNotifications(): Promise<AppNotification[]> {
  const res = await api.get("/notifications/");
  return sortNewestFirst(normalizeNotificationList(res.data));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await api.get("/notifications/unread-count/");
  return Number(res.data?.unread_count ?? 0);
}

export async function markNotificationRead(notificationId: number): Promise<unknown> {
  const res = await api.post(`/notifications/${notificationId}/read/`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<unknown> {
  const res = await api.post("/notifications/read-all/");
  return res.data;
}

export async function deleteNotification(notificationId: number): Promise<unknown> {
  const res = await api.post(`/notifications/${notificationId}/delete/`);
  return res.data;
}

export async function getUnreadNotifications(): Promise<AppNotification[]> {
  const items = await getMyNotifications();
  return items.filter((item) => !item.is_read && !item.is_deleted);
}