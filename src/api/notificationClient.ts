import { NotificationSettings, NotificationHistoryEntry } from '../types/notification';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * 通知設定を取得する
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`);
  if (!res.ok) throw new Error(`Failed to fetch notification settings: ${res.status}`);
  return res.json();
}

/**
 * 通知設定を更新する
 */
export async function updateNotificationSettings(
  data: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update notification settings: ${res.status}`);
  return res.json();
}

/**
 * 通知設定の変更履歴を取得する
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/notifications/history`);
  if (!res.ok) throw new Error(`Failed to fetch notification history: ${res.status}`);
  return res.json();
}
