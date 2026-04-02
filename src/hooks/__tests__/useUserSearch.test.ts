import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import { getUsers } from '../../api/client';
import { User } from '../../types/user';

jest.mock('../../api/client');

const mockGetUsers = getUsers as jest.MockedFunction<typeof getUsers>;

const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'taro.yamada@example.com',
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'hanako.sato@example.com',
    createdAt: new Date('2024-02-20T10:30:00.000Z'),
  },
  {
    id: '3',
    name: '鈴木一郎',
    email: 'ichiro.suzuki@example.com',
    createdAt: new Date('2024-03-10T14:00:00.000Z'),
  },
];

describe('useUserSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('初期ロードでユーザー一覧が取得される', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    expect(mockGetUsers).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toEqual(mockUsers);
  });

  it('取得中は loading が true である', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUserSearch());

    expect(result.current.loading).toBe(true);
  });

  it('取得成功後にユーザーデータが正しくセットされる', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(3);
    expect(result.current.allUsers).toHaveLength(3);
    expect(result.current.error).toBeNull();
  });

  it('取得エラー時に error がセットされる', async () => {
    const error = new Error('Failed to fetch users: 500');
    mockGetUsers.mockRejectedValue(error);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
  });

  it('名前で検索できる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('山田');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });

    expect(result.current.users[0].name).toBe('山田太郎');
  });

  it('メールアドレスで検索できる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('hanako');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });

    expect(result.current.users[0].email).toBe('hanako.sato@example.com');
  });

  it('大文字小文字を区別せずに検索できる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('TARO');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });

    expect(result.current.users[0].name).toBe('山田太郎');
  });

  it('検索クエリをクリアすると全件表示に戻る', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('山田');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });

    act(() => {
      result.current.setQuery('');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(3);
    });
  });

  it('debounce により 300ms 経過するまでフィルタリングが実行されない', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('山田');
    });

    // 300ms 経過前はまだフィルタリングされていない
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.users).toHaveLength(3);

    // 300ms 経過後にフィルタリングされる
    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.users).toHaveLength(1);
    });
  });
});
