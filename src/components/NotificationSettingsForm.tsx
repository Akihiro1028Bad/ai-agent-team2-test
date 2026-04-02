'use client';

import React, { useState, useEffect } from 'react';
import { NotificationSettings, NotificationFrequency, FREQUENCY_LABELS } from '../types/notification';
import styles from './NotificationSettingsForm.module.css';

interface NotificationSettingsFormProps {
  settings: NotificationSettings;
  onSave: (data: Partial<NotificationSettings>) => Promise<void>;
}

export const NotificationSettingsForm: React.FC<NotificationSettingsFormProps> = ({
  settings,
  onSave,
}) => {
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [frequency, setFrequency] = useState<NotificationFrequency>(settings.frequency);

  useEffect(() => {
    setEmailEnabled(settings.emailEnabled);
    setPushEnabled(settings.pushEnabled);
    setFrequency(settings.frequency);
  }, [settings.emailEnabled, settings.pushEnabled, settings.frequency]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave({ emailEnabled, pushEnabled, frequency });
      setSaveSuccess(true);
    } catch (err) {
      setSaveError('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>通知設定</h2>

      <div className={styles.settingItem}>
        <div className={styles.settingContent}>
          <label className={styles.settingLabel} htmlFor="emailEnabled">
            メール通知
          </label>
          <p className={styles.settingDescription}>メールで通知を受け取ります</p>
        </div>
        <input
          id="emailEnabled"
          type="checkbox"
          role="switch"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingContent}>
          <label className={styles.settingLabel} htmlFor="pushEnabled">
            プッシュ通知
          </label>
          <p className={styles.settingDescription}>ブラウザのプッシュ通知を受け取ります</p>
        </div>
        <input
          id="pushEnabled"
          type="checkbox"
          role="switch"
          checked={pushEnabled}
          onChange={(e) => setPushEnabled(e.target.checked)}
        />
      </div>

      <div className={styles.settingItem}>
        <label className={styles.settingLabel} htmlFor="frequency">
          通知頻度
        </label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as NotificationFrequency)}
        >
          {(Object.entries(FREQUENCY_LABELS) as [NotificationFrequency, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}
      {saveSuccess && <div className={styles.successMessage}>設定を保存しました</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
};
