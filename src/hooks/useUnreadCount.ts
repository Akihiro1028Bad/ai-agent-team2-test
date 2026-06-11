import { useState, useEffect } from 'react';
import { getUnreadNotificationCount } from '../api/notificationClient';

/**
 * 未読通知件数を取得・管理するカスタムフック
 */
export function useUnreadCount(): { unreadCount: number } {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    getUnreadNotificationCount()
      .then(({ count }) => {
        if (isMounted) setUnreadCount(count);
      })
      .catch(() => {
        // 取得失敗時はバッジを非表示のまま維持
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return { unreadCount };
}
