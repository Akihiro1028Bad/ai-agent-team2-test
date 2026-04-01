import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../page';
import { getUserStats } from '../../../src/api/client';

jest.mock('../../../src/api/client');

// rechartsのモック
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;

const mockStats = {
  monthlyActiveDays: 18,
  totalPosts: 142,
  dailyActivity: [
    { date: '2026-03-30', count: 3 },
    { date: '2026-03-31', count: 5 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockGetUserStats.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('統計データが正常に表示される', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    });

    expect(screen.getByText('月間アクティブ日数')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('累計投稿数')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('直近30日間の活動')).toBeInTheDocument();
  });

  it('APIエラー時にエラーメッセージが表示される', async () => {
    mockGetUserStats.mockRejectedValue(new Error('Fetch failed'));
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });
});
