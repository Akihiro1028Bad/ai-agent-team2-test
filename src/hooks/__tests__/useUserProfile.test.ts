import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserProfile } from '../useUserProfile';
import { getUserProfile, updateUserProfile } from '../../api/client';
import { UserProfile } from '../../types/user';

jest.mock('../../api/client');

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

const mockProfile: UserProfile = {
  id: 'user-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  bio: '自己紹介文です',
  location: '東京',
  website: 'https://example.com',
  createdAt: new Date('2024-01-01'),
};

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('プロフィールを正常に取得できる', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserProfile('user-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
    expect(mockGetUserProfile).toHaveBeenCalledWith('user-1');
  });

  it('API エラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch profile: 500');
    mockGetUserProfile.mockRejectedValue(error);

    const { result } = renderHook(() => useUserProfile('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.profile).toBeNull();
  });

  it('updateProfile でプロフィールを更新できる', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);
    const updatedProfile = { ...mockProfile, name: '更新後の名前' };
    mockUpdateUserProfile.mockResolvedValue(updatedProfile);

    const { result } = renderHook(() => useUserProfile('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateProfile({ name: '更新後の名前' });
    });

    expect(result.current.profile).toEqual(updatedProfile);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith('user-1', { name: '更新後の名前' });
  });

  it('updateProfile 失敗時にエラーがスローされる', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);
    const error = new Error('Failed to update profile: 500');
    mockUpdateUserProfile.mockRejectedValue(error);

    const { result } = renderHook(() => useUserProfile('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await expect(
      act(async () => {
        await result.current.updateProfile({ name: '更新後の名前' });
      })
    ).rejects.toThrow('Failed to update profile: 500');
  });

  it('ID が変更された場合に再取得する', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useUserProfile(id),
      { initialProps: { id: 'user-1' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const anotherProfile = { ...mockProfile, id: 'user-2', name: '別のユーザー' };
    mockGetUserProfile.mockResolvedValue(anotherProfile);

    rerender({ id: 'user-2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetUserProfile).toHaveBeenCalledWith('user-2');
    expect(result.current.profile).toEqual(anotherProfile);
  });
});
