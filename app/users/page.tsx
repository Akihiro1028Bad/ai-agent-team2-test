'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../../src/types/user';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchInput } from '../../src/components/UserSearchInput';
import { UserSearchResults } from '../../src/components/UserSearchResults';

// TODO: ユーザー一覧取得APIの実装後に差し替え
async function getUsers(): Promise<User[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/users`
  );
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const { query, filteredUsers, totalCount, isSearching, handleSearch } =
    useUserSearch(users);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchInput
        value={query}
        onChange={handleSearch}
        resultCount={totalCount}
        isSearching={isSearching}
      />
      <UserSearchResults users={filteredUsers} query={query} />
    </div>
  );
}
