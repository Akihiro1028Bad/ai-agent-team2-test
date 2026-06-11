/**
 * 通知頻度の種別
 */
export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

/**
 * 通知設定
 */
export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: NotificationFrequency;
}

/**
 * 通知頻度の表示ラベル
 */
export const FREQUENCY_LABELS: Record<NotificationFrequency, string> = {
  immediate: '即時',
  daily: '日次ダイジェスト',
  weekly: '週次ダイジェスト',
};

/**
 * 通知設定のデフォルト値
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};

/**
 * 未読通知件数
 */
export interface UnreadNotificationCount {
  count: number;
}
