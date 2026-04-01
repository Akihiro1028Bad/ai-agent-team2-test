import { renderHook, waitFor, act } from '@testing-library/react';
import { useNotificationSettings } from '../useNotificationSettings';
import { getNotificationSettings, updateNotificationSettings } from '../../api/notificationClient';
import { NotificationSettings } from '../../types/notification';

jest.mock('../../api/notificationClient');

const mockGetNotificationSettings = getNotificationSettings as jest.MockedFunction<typeof getNotificationSettings>;
const mockUpdateNotificationSettings = updateNotificationSettings as jest.MockedFunction<typeof updateNotificationSettings>;

const mockSettings: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: false,
  frequency: 'daily',
};

describe('useNotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('通知設定を正常に取得できる', async () => {
    mockGetNotificationSettings.mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(result.current.error).toBeNull();
    expect(mockGetNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('ローディング状態が正しく管理される', async () => {
    mockGetNotificationSettings.mockResolvedValue(mockSettings);

    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('API エラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch notification settings: 500');
    mockGetNotificationSettings.mockRejectedValue(error);

    const { result } = renderHook(() => useNotificationSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
  });

  it('saveSettings で設定を更新できる', async () => {
    mockGetNotificationSettings.mockResolvedValue(mockSettings);
    const updatedSettings: NotificationSettings = {
      emailEnabled: false,
      pushEnabled: true,
      frequency: 'weekly',
    };
    mockUpdateNotificationSettings.mockResolvedValue(updatedSettings);

    const { result } = renderHook(() => useNotificationSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.saveSettings({ emailEnabled: false, frequency: 'weekly' });
    });

    expect(result.current.settings).toEqual(updatedSettings);
    expect(mockUpdateNotificationSettings).toHaveBeenCalledWith({ emailEnabled: false, frequency: 'weekly' });
  });

  it('saveSettings 失敗時にエラーがスローされる', async () => {
    mockGetNotificationSettings.mockResolvedValue(mockSettings);
    const error = new Error('Failed to update notification settings: 500');
    mockUpdateNotificationSettings.mockRejectedValue(error);

    const { result } = renderHook(() => useNotificationSettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.saveSettings({ emailEnabled: false });
      })
    ).rejects.toThrow('Failed to update notification settings: 500');
  });
});
