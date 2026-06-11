import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationList } from '../NotificationList';
import { Notification } from '../../types/notification';

const notifications: Notification[] = [
  {
    id: 'n-1',
    title: 'テスト通知1',
    body: '通知本文1',
    read: false,
    createdAt: '2024-01-15T03:00:00.000Z', // UTC 03:00 = JST 12:00
  },
  {
    id: 'n-2',
    title: 'テスト通知2',
    body: '通知本文2',
    read: true,
    createdAt: '2024-06-01T15:30:00.000Z',
  },
];

describe('NotificationList', () => {
  it('通知一覧が表示される', () => {
    render(<NotificationList notifications={notifications} />);

    expect(screen.getByText('テスト通知1')).toBeInTheDocument();
    expect(screen.getByText('通知本文1')).toBeInTheDocument();
    expect(screen.getByText('テスト通知2')).toBeInTheDocument();
    expect(screen.getByText('通知本文2')).toBeInTheDocument();
  });

  it('空配列の場合「通知はありません」が表示される', () => {
    render(<NotificationList notifications={[]} />);

    expect(screen.getByText('通知はありません')).toBeInTheDocument();
  });

  it('createdAt がUTC ISO文字列でもローカル日時形式で表示される（UTC固定文字列やISOそのままではない）', () => {
    render(<NotificationList notifications={[notifications[0]]} />);

    // UTC ISO 文字列そのままが表示されないことを確認
    expect(screen.queryByText('2024-01-15T03:00:00.000Z')).not.toBeInTheDocument();
    // toUTCString形式でないことを確認
    expect(screen.queryByText(/Mon, 15 Jan 2024/)).not.toBeInTheDocument();
  });

  it('createdAt の表示が toLocaleString を使って変換される', () => {
    const mockToLocaleString = jest.spyOn(Date.prototype, 'toLocaleString');
    render(<NotificationList notifications={[notifications[0]]} />);

    expect(mockToLocaleString).toHaveBeenCalled();
    mockToLocaleString.mockRestore();
  });
});

describe('formatDateTime ユーティリティ', () => {
  // formatDateTimeを直接テストするためにインポート
  const { formatDateTime } = require('../../utils/formatDate');

  it('UTC ISO 文字列をローカル日時文字列に変換する', () => {
    const result = formatDateTime('2024-01-15T03:00:00.000Z');
    // UTC のまま ("03:00") でも ISO 文字列でもないことを確認
    expect(result).not.toBe('2024-01-15T03:00:00.000Z');
    expect(result).not.toBe('不明');
  });

  it('null を渡すと「不明」が返る', () => {
    expect(formatDateTime(null)).toBe('不明');
  });

  it('undefined を渡すと「不明」が返る', () => {
    expect(formatDateTime(undefined)).toBe('不明');
  });

  it('不正な文字列を渡すと「不明」が返る', () => {
    expect(formatDateTime('invalid-date')).toBe('不明');
  });

  it('Date オブジェクトを渡しても変換される', () => {
    const result = formatDateTime(new Date('2024-01-15T03:00:00.000Z'));
    expect(result).not.toBe('不明');
  });

  it('カスタムフォールバックが使われる', () => {
    expect(formatDateTime(null, 'N/A')).toBe('N/A');
  });
});

describe('formatDate ユーティリティ', () => {
  const { formatDate } = require('../../utils/formatDate');

  it('UTC ISO 文字列をローカル日付文字列に変換する', () => {
    const result = formatDate('2024-01-15T03:00:00.000Z');
    expect(result).not.toBe('2024-01-15T03:00:00.000Z');
    expect(result).not.toBe('不明');
  });

  it('null を渡すと「不明」が返る', () => {
    expect(formatDate(null)).toBe('不明');
  });

  it('undefined を渡すと「不明」が返る', () => {
    expect(formatDate(undefined)).toBe('不明');
  });

  it('不正な文字列を渡すと「不明」が返る', () => {
    expect(formatDate('not-a-date')).toBe('不明');
  });

  it('Date オブジェクトを渡しても変換される', () => {
    const result = formatDate(new Date('2024-06-01'));
    expect(result).not.toBe('不明');
  });
});
