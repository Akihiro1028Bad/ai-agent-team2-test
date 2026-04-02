'use client';

import React from 'react';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchForm } from '../../src/components/UserSearchForm';
import { UserList } from '../../src/components/UserList';

export default function UsersPage() {
  const { users, loading, error, query, setQuery } = useUserSearch();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchForm query={query} onQueryChange={setQuery} />
      <UserList users={users} isSearching={query.trim().length > 0} />
    </div>
  );
}
