import { useState, useEffect } from 'react';
import { NotificationHistoryEntry } from '../types/notification';
import { getNotificationHistory } from '../api/notificationClient';

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNotificationHistory()
      .then(setHistory)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { history, loading, error };
}
