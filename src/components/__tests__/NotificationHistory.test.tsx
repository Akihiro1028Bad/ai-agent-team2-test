import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationHistory } from '../NotificationHistory';
import { NotificationHistoryEntry } from '../../types/notification';

const mockHistory: NotificationHistoryEntry[] = [
  {
    id: '1',
    changedAt: '2026-04-02T10:30:00Z',
    field: 'emailEnabled',
    oldValue: 'true',
    newValue: 'false',
  },
  {
    id: '2',
    changedAt: '2026-04-01T15:00:00Z',
    field: 'frequency',
    oldValue: 'immediate',
    newValue: 'daily',
  },
];

const fiveItemHistory: NotificationHistoryEntry[] = [
  {
    id: '1',
    changedAt: '2026-04-02T10:30:00Z',
    field: 'emailEnabled',
    oldValue: 'true',
    newValue: 'false',
  },
  {
    id: '2',
    changedAt: '2026-04-01T15:00:00Z',
    field: 'frequency',
    oldValue: 'immediate',
    newValue: 'daily',
  },
  {
    id: '3',
    changedAt: '2026-03-28T09:00:00Z',
    field: 'pushEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
  {
    id: '4',
    changedAt: '2026-03-25T14:20:00Z',
    field: 'frequency',
    oldValue: 'weekly',
    newValue: 'immediate',
  },
  {
    id: '5',
    changedAt: '2026-03-20T11:00:00Z',
    field: 'emailEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
];

describe('NotificationHistory', () => {
  it('履歴データが正しく表示される', () => {
    render(
      <NotificationHistory history={mockHistory} loading={false} error={null} />
    );

    expect(screen.getByText('変更履歴')).toBeInTheDocument();
    expect(screen.getByText('メール通知:')).toBeTruthy();
  });

  it('boolean値がON/OFFで表示される', () => {
    render(
      <NotificationHistory history={mockHistory} loading={false} error={null} />
    );

    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('frequency値が日本語ラベルで表示される', () => {
    render(
      <NotificationHistory history={mockHistory} loading={false} error={null} />
    );

    expect(screen.getByText('即時')).toBeInTheDocument();
    expect(screen.getByText('日次ダイジェスト')).toBeInTheDocument();
  });

  it('ローディング中に「読み込み中...」が表示される', () => {
    render(
      <NotificationHistory history={[]} loading={true} error={null} />
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('エラー時に「履歴の取得に失敗しました」が表示される', () => {
    render(
      <NotificationHistory
        history={[]}
        loading={false}
        error={new Error('API Error')}
      />
    );

    expect(screen.getByText('履歴の取得に失敗しました')).toBeInTheDocument();
  });

  it('履歴が空の場合に「変更履歴はありません」が表示される', () => {
    render(
      <NotificationHistory history={[]} loading={false} error={null} />
    );

    expect(screen.getByText('変更履歴はありません')).toBeInTheDocument();
  });

  it('複数件の履歴が時系列順に表示される', () => {
    render(
      <NotificationHistory history={fiveItemHistory} loading={false} error={null} />
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(5);

    // 最初のアイテムが最新の日付であることを確認
    expect(listItems[0]).toHaveTextContent('2026/04/02');
    expect(listItems[1]).toHaveTextContent('2026/04/01');
  });
});
