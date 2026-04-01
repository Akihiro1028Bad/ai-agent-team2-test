'use client';

import React from 'react';
import { useUserStats } from '../../src/hooks/useUserStats';
import { StatCard } from '../../src/components/StatCard';
import { ActivityChart } from '../../src/components/ActivityChart';

// TODO: 認証基盤導入後に差し替え
function getCurrentUserId(): string {
  return 'current-user-id';
}

const pageStyles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  } as React.CSSProperties,
  heading: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '24px',
  } as React.CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,
};

export default function DashboardPage() {
  const userId = getCurrentUserId();
  const { stats, loading, error } = useUserStats(userId);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!stats) return <div>統計データが見つかりません</div>;

  return (
    <div style={pageStyles.container}>
      <h1 style={pageStyles.heading}>ダッシュボード</h1>
      <div style={pageStyles.statsGrid}>
        <StatCard
          title="月間アクティブ日数"
          value={stats.monthlyActiveDays}
          unit="日"
        />
        <StatCard
          title="累計投稿数"
          value={stats.totalPosts}
          unit="件"
        />
      </div>
      <ActivityChart data={stats.dailyActivity} />
    </div>
  );
}
