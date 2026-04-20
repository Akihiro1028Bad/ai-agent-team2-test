import { useState, useEffect, useMemo, useCallback } from 'react';
import { User, SearchParams, UserSearchResult } from '../types/user';
import { getUsers } from '../api/client';

/**
 * ユーザー検索Hook
 * - ユーザー一覧を取得
 * - 検索クエリによるクライアントサイドフィルタリング
 * - debounce付きリアルタイム検索
 */
export function useUserSearch() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({ query: '' });
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // ユーザー一覧取得
  useEffect(() => {
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  // debounce処理（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchParams.query);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchParams.query]);

  // フィルタリング処理
  const searchResult: UserSearchResult = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return {
        users,
        totalCount: users.length,
        isFiltered: false,
      };
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
    );

    return {
      users: filtered,
      totalCount: users.length,
      isFiltered: true,
    };
  }, [users, debouncedQuery]);

  // 検索クエリ更新
  const setQuery = useCallback((query: string) => {
    setSearchParams({ query });
  }, []);

  return {
    searchResult,
    loading,
    error,
    query: searchParams.query,
    setQuery,
  };
}
