import { useState, useEffect } from 'react';
import { NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../types/notification';
import { getNotificationSettings, updateNotificationSettings } from '../api/notificationClient';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNotificationSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (data: Partial<NotificationSettings>) => {
    const updated = await updateNotificationSettings(data);
    setSettings(updated);
    return updated;
  };

  return { settings, loading, error, saveSettings };
}
