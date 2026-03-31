import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserProfile } from '../useUserProfile';
import { getUserProfile, updateUserProfile } from '../../api/client';

jest.mock('../../api/client');

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

const mockProfile = {
  id: 'u_123',
  name: 'Test User',
  email: 'test@example.com',
  avatarUrl: 'https://example.com/avatar.png',
  createdAt: new Date('2024-01-15T09:00:00Z'),
  bio: 'Hello world',
  location: 'Tokyo, Japan',
  website: 'https://example.com',
};

describe('useUserProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初回取得時にloading=trueとなり、取得成功後にprofileがセットされる', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useUserProfile('u_123'));

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toEqual(mockProfile);
    expect(result.current.error).toBeNull();
  });

  it('APIエラー時にerrorがセットされる', async () => {
    const error = new Error('Failed to fetch profile: 404');
    mockGetUserProfile.mockRejectedValue(error);

    const { result } = renderHook(() => useUserProfile('u_999'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.profile).toBeNull();
  });

  it('updateProfile呼び出し時にupdating=trueとなり、成功後にprofileが更新される', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const updatedProfile = { ...mockProfile, bio: 'Updated bio' };
    mockUpdateUserProfile.mockResolvedValue(updatedProfile);

    const { result } = renderHook(() => useUserProfile('u_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateProfile({ bio: 'Updated bio' });
    });

    expect(result.current.profile).toEqual(updatedProfile);
    expect(result.current.updating).toBe(false);
  });

  it('updateProfile失敗時にerrorがセットされ、例外がthrowされる', async () => {
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const updateError = new Error('Failed to update profile: 500');
    mockUpdateUserProfile.mockRejectedValue(updateError);

    const { result } = renderHook(() => useUserProfile('u_123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let thrownError: Error | undefined;
    await act(async () => {
      try {
        await result.current.updateProfile({ bio: 'fail' });
      } catch (e) {
        thrownError = e as Error;
      }
    });

    expect(thrownError).toEqual(updateError);
    expect(result.current.error).toEqual(updateError);
    expect(result.current.updating).toBe(false);
  });
});
