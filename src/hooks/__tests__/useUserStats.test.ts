import { renderHook, waitFor } from '@testing-library/react';
import { useUserStats } from '../useUserStats';
import { getUserStats } from '../../api/client';
import { UserStats } from '../../types/user';

jest.mock('../../api/client');

const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;

const mockStats: UserStats = {
  monthlyActiveDays: 18,
  totalPosts: 142,
  dailyActivity: [
    { date: '2026-03-30', count: 3 },
    { date: '2026-03-31', count: 5 },
    { date: '2026-04-01', count: 2 },
  ],
};

describe('useUserStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('統計データを正常に取得できる', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    const { result } = renderHook(() => useUserStats('user-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBeNull();
    expect(mockGetUserStats).toHaveBeenCalledWith('user-1');
  });

  it('APIエラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch user stats: 500');
    mockGetUserStats.mockRejectedValue(error);
    const { result } = renderHook(() => useUserStats('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.stats).toBeNull();
  });

  it('IDが変更された場合に再取得する', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useUserStats(id),
      { initialProps: { id: 'user-1' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const anotherStats = { ...mockStats, totalPosts: 200 };
    mockGetUserStats.mockResolvedValue(anotherStats);
    rerender({ id: 'user-2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetUserStats).toHaveBeenCalledWith('user-2');
    expect(result.current.stats).toEqual(anotherStats);
  });
});
