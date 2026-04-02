import { renderHook, waitFor } from '@testing-library/react';
import { useNotificationHistory } from '../useNotificationHistory';
import { getNotificationHistory } from '../../api/notificationClient';
import { NotificationHistoryEntry } from '../../types/notification';

jest.mock('../../api/notificationClient');

const mockGetNotificationHistory = getNotificationHistory as jest.MockedFunction<typeof getNotificationHistory>;

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

describe('useNotificationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('履歴データを正常に取得できる', async () => {
    mockGetNotificationHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useNotificationHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.error).toBeNull();
    expect(mockGetNotificationHistory).toHaveBeenCalledTimes(1);
  });

  it('ローディング状態が正しく管理される', async () => {
    mockGetNotificationHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('APIエラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch notification history: 500');
    mockGetNotificationHistory.mockRejectedValue(error);

    const { result } = renderHook(() => useNotificationHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
  });

  it('取得データが空配列の場合も正しく処理される', async () => {
    mockGetNotificationHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useNotificationHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
