import { useState, useEffect, useMemo } from 'react';
import { User } from '../types/user';
import { getUsers } from '../api/client';

/**
 * debounce用のカスタムhook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useUserSearch() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState('');

  const debouncedQuery = useDebounce(query, 300);

  // ユーザー一覧の取得
  useEffect(() => {
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  // クライアントサイドフィルタリング
  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) return users;
    const lowerQuery = debouncedQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
    );
  }, [users, debouncedQuery]);

  return {
    users: filteredUsers,
    allUsers: users,
    loading,
    error,
    query,
    setQuery,
  };
}
