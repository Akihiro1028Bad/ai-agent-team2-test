import { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../types/user';

/**
 * debounce用のカスタムhook（ファイル内プライベート）
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * ユーザー検索hook
 *
 * @param users フィルタリング対象のユーザー一覧
 * @returns query, filteredUsers, totalCount, isSearching, handleSearch
 */
export function useUserSearch(users: User[]) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return users;
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim();

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery)
    );
  }, [users, debouncedQuery]);

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
  }, []);

  return {
    query,
    filteredUsers,
    totalCount: filteredUsers.length,
    isSearching: query !== debouncedQuery,
    handleSearch,
  };
}
