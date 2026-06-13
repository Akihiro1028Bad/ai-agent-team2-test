import { renderHook, waitFor } from '@testing-library/react';
import { useUsers } from '../useUsers';
import { getUsers } from '../../api/client';
import { User } from '../../types/user';

jest.mock('../../api/client');

const mockGetUsers = getUsers as jest.MockedFunction<typeof getUsers>;

const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'テストユーザー1',
    email: 'user1@example.com',
    avatarUrl: 'https://example.com/avatar1.png',
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: '2026-06-12T10:30:00.000Z',
  },
  {
    id: 'user-2',
    name: 'テストユーザー2',
    email: 'user2@example.com',
    createdAt: '2024-02-01T00:00:00.000Z',
    lastLoginAt: null,
  },
];

describe('useUsers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態では loading: true, users: [], error: null', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUsers());

    expect(result.current.loading).toBe(true);
    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('ユーザー一覧を正常に取得できる', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUsers());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toEqual(mockUsers);
    expect(result.current.error).toBeNull();
    expect(mockGetUsers).toHaveBeenCalledTimes(1);
  });

  it('API エラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch users: 500');
    mockGetUsers.mockRejectedValue(error);

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.users).toEqual([]);
  });

  it('空のユーザー一覧を正常に処理できる', async () => {
    mockGetUsers.mockResolvedValue([]);

    const { result } = renderHook(() => useUsers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
