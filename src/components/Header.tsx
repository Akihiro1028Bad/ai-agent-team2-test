'use client';

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useUnreadCount } from '../hooks/useUnreadCount';
import { DarkModeToggle } from './DarkModeToggle';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isDark, toggle } = useDarkMode();
  const { unreadCount } = useUnreadCount();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>Sample App</div>
        <div className={styles.actions}>
          {/* バッジは unreadCount > 0 の場合のみ表示（0 の falsy 問題を明示的な比較で回避） */}
          {unreadCount > 0 && (
            <span className={styles.badge} data-testid="notification-badge">
              {unreadCount}
            </span>
          )}
          <DarkModeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
};
