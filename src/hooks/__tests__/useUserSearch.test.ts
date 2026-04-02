import { renderHook, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import { User } from '../../types/user';

const mockUsers: User[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', createdAt: '2024-01-01' },
  { id: '2', name: 'Bob Johnson', email: 'bob@example.com', createdAt: '2024-01-02' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@test.com', createdAt: '2024-01-03' },
];

describe('useUserSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('初期状態で全ユーザーが返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));
    expect(result.current.filteredUsers).toEqual(mockUsers);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.query).toBe('');
  });

  it('名前で検索できる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Alice Smith');
  });

  it('メールアドレスで検索できる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('test.com'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].email).toBe('charlie@test.com');
  });

  it('大文字小文字を区別しない', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('alice'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Alice Smith');
  });

  it('検索結果が0件の場合は空配列が返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('zzz'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('debounce待機中はisSearchingがtrueになる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });

    expect(result.current.isSearching).toBe(true);

    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.isSearching).toBe(false);
  });

  it('totalCountが正しく返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('example.com'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.totalCount).toBe(2);
  });

  it('クエリをクリアすると全ユーザーに戻る', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.filteredUsers).toHaveLength(1);

    act(() => { result.current.handleSearch(''); });
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.filteredUsers).toEqual(mockUsers);
  });
});
