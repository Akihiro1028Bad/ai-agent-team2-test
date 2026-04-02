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
 * 通知設定の変更対象フィールド
 */
export type NotificationSettingField = keyof NotificationSettings;

/**
 * 通知設定フィールドの表示ラベル
 */
export const SETTING_FIELD_LABELS: Record<NotificationSettingField, string> = {
  emailEnabled: 'メール通知',
  pushEnabled: 'プッシュ通知',
  frequency: '通知頻度',
};

/**
 * 通知設定の変更履歴エントリ
 */
export interface NotificationHistoryEntry {
  id: string;
  changedAt: string;  // ISO 8601 形式
  field: NotificationSettingField;
  oldValue: string;
  newValue: string;
}
