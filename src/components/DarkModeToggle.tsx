'use client';

import React from 'react';
import styles from './DarkModeToggle.module.css';

interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ isDark, onToggle }) => {
  return (
    <button
      className={styles.toggleButton}
      onClick={onToggle}
      aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
      title={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
    >
      <span className={styles.icon}>{isDark ? '☀️' : '🌙'}</span>
      <span className={styles.label}>{isDark ? 'ライトモード' : 'ダークモード'}</span>
    </button>
  );
};
