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

export async function getMyNotifications() {
  const res = await api.get("/notifications/");
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

export async function getUnreadNotificationCount() {
  const res = await api.get("/notifications/unread-count/");
  return Number(res.data?.unread_count ?? 0);
}

export async function markNotificationRead(notificationId: number) {
  const res = await api.post(`/notifications/${notificationId}/read/`);
  return res.data;
}

export async function markAllNotificationsRead() {
  const res = await api.post("/notifications/read-all/");
  return res.data;
}

export async function deleteNotification(notificationId: number) {
  const res = await api.post(`/notifications/${notificationId}/delete/`);
  return res.data;
}