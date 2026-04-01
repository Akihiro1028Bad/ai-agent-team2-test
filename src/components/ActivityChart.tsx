'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyActivity } from '../types/user';
import styles from './ActivityChart.module.css';

interface ActivityChartProps {
  data: DailyActivity[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>直近30日間の活動</h2>
        <p className={styles.emptyMessage}>活動データがありません</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  const totalActivity = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      className={styles.container}
      role="img"
      aria-label={`直近30日間の活動グラフ。合計活動数: ${totalActivity}`}
    >
      <h2 className={styles.title}>直近30日間の活動</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#4F46E5" name="活動数" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
