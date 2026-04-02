'use client';

import React from 'react';
import {
  NotificationHistoryEntry,
  NotificationSettingField,
  NotificationFrequency,
  FREQUENCY_LABELS,
  SETTING_FIELD_LABELS,
} from '../types/notification';
import styles from './NotificationHistory.module.css';

interface NotificationHistoryProps {
  history: NotificationHistoryEntry[];
  loading: boolean;
  error: Error | null;
}

/**
 * boolean系フィールドの値を ON/OFF に、frequency を日本語ラベルに変換
 */
function formatHistoryValue(field: NotificationSettingField, value: string): string {
  if (field === 'emailEnabled' || field === 'pushEnabled') {
    return value === 'true' ? 'ON' : 'OFF';
  }
  if (field === 'frequency') {
    return FREQUENCY_LABELS[value as NotificationFrequency] || value;
  }
  return value;
}

/**
 * ISO 8601 文字列を YYYY/MM/DD HH:mm 形式に変換
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  history,
  loading,
  error,
}) => {
  return (
    <section className={styles.container}>
      <h2 className={styles.title}>変更履歴</h2>

      {loading && <div>読み込み中...</div>}

      {error && (
        <div className={styles.errorMessage}>履歴の取得に失敗しました</div>
      )}

      {!loading && !error && history.length === 0 && (
        <p className={styles.emptyMessage}>変更履歴はありません</p>
      )}

      {!loading && !error && history.length > 0 && (
        <ul className={styles.historyList}>
          {history.map((entry) => (
            <li key={entry.id} className={styles.historyItem}>
              <div className={styles.changedAt}>
                {formatDateTime(entry.changedAt)}
              </div>
              <div className={styles.changeDetail}>
                {SETTING_FIELD_LABELS[entry.field]}:{' '}
                <span className={styles.oldValue}>
                  {formatHistoryValue(entry.field, entry.oldValue)}
                </span>
                {' → '}
                <span className={styles.newValue}>
                  {formatHistoryValue(entry.field, entry.newValue)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
