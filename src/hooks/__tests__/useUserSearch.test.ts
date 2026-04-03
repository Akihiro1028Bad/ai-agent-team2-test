import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import { getUsers } from '../../api/client';

jest.mock('../../api/client');

const mockGetUsers = getUsers as jest.MockedFunction<typeof getUsers>;

const mockUsers = [
  { id: '1', name: '山田太郎', email: 'yamada@example.com', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: '鈴木花子', email: 'suzuki@example.com', createdAt: '2024-02-01T00:00:00Z' },
  { id: '3', name: 'John Smith', email: 'john.smith@example.com', createdAt: '2024-03-01T00:00:00Z' },
];

describe('useUserSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('初期ロード時にgetUsersが呼ばれ、loading状態が遷移する', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetUsers).toHaveBeenCalledTimes(1);
  });

  it('取得成功時にユーザーデータがsearchResultにセットされる', async () => {
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.searchResult.users).toEqual(mockUsers);
    expect(result.current.searchResult.totalCount).toBe(3);
    expect(result.current.searchResult.isFiltered).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('取得エラー時にerrorがセットされる', async () => {
    const error = new Error('Failed to fetch users: 500');
    mockGetUsers.mockRejectedValue(error);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
  });

  it('名前による部分一致検索ができる', async () => {
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
      expect(result.current.searchResult.users).toHaveLength(1);
    });

    expect(result.current.searchResult.users[0].name).toBe('山田太郎');
    expect(result.current.searchResult.isFiltered).toBe(true);
  });

  it('メールアドレスによる部分一致検索ができる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('suzuki');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.searchResult.users).toHaveLength(1);
    });

    expect(result.current.searchResult.users[0].email).toBe('suzuki@example.com');
    expect(result.current.searchResult.isFiltered).toBe(true);
  });

  it('大文字・小文字を区別せずに検索できる', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('JOHN');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.searchResult.users).toHaveLength(1);
    });

    expect(result.current.searchResult.users[0].name).toBe('John Smith');
  });

  it('検索結果が0件の場合、空配列でisFiltered: trueが返される', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('存在しないユーザー');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.searchResult.isFiltered).toBe(true);
    });

    expect(result.current.searchResult.users).toHaveLength(0);
  });

  it('空文字で全件表示に戻る', async () => {
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
      expect(result.current.searchResult.users).toHaveLength(1);
    });

    act(() => {
      result.current.setQuery('');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.searchResult.users).toHaveLength(3);
    });

    expect(result.current.searchResult.isFiltered).toBe(false);
  });

  it('debounce動作: 入力直後はフィルタリングされず、300ms後に実行される', async () => {
    jest.useFakeTimers();
    mockGetUsers.mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUserSearch());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.setQuery('山田');
    });

    // 300ms前はまだフィルタリングされていない
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.searchResult.users).toHaveLength(3);
    expect(result.current.searchResult.isFiltered).toBe(false);

    // 300ms後にフィルタリングが実行される
    act(() => {
      jest.advanceTimersByTime(200);
    });

    await waitFor(() => {
      expect(result.current.searchResult.users).toHaveLength(1);
    });

    expect(result.current.searchResult.isFiltered).toBe(true);
  });
});
