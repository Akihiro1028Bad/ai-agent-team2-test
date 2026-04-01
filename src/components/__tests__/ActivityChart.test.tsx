import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivityChart } from '../ActivityChart';

// rechartsのモック
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

describe('ActivityChart', () => {
  it('データが空の場合に「活動データがありません」と表示される', () => {
    render(<ActivityChart data={[]} />);
    expect(screen.getByText('活動データがありません')).toBeInTheDocument();
  });

  it('データがある場合にグラフタイトルとチャートが表示される', () => {
    const data = [
      { date: '2026-03-30', count: 3 },
      { date: '2026-03-31', count: 5 },
    ];
    render(<ActivityChart data={data} />);

    expect(screen.getByText('直近30日間の活動')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('aria-labelに合計活動数が含まれる', () => {
    const data = [
      { date: '2026-03-30', count: 3 },
      { date: '2026-03-31', count: 5 },
    ];
    render(<ActivityChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '直近30日間の活動グラフ。合計活動数: 8'
    );
  });
});
