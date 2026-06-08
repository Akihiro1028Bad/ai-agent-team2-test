'use client';

import React from 'react';
import Link from 'next/link';
import { useDarkMode } from '../hooks/useDarkMode';
import { DarkModeToggle } from './DarkModeToggle';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isDark, toggle } = useDarkMode();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>Sample App</div>
        <div className={styles.actions}>
          <Link href="/profile">プロフィール</Link>
          <DarkModeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
};
