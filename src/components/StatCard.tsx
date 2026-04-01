import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;   // カードのタイトル（例: "月間アクティブ日数"）
  value: number;   // 統計値（例: 18）
  unit: string;    // 単位（例: "日", "件"）
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, unit }) => {
  return (
    <div className={styles.card} role="region" aria-label={`${title}: ${value}${unit}`}>
      <p className={styles.title}>{title}</p>
      <div className={styles.valueContainer}>
        <span className={styles.value}>{value}</span>
        <span className={styles.unit}>{unit}</span>
      </div>
    </div>
  );
};
