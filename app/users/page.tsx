'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchInput } from '../../src/components/UserSearchInput';
import { UserList } from '../../src/components/UserList';
import { User } from '../../src/types/user';

export default function UsersPage() {
  const router = useRouter();
  const { searchResult, loading, error, query, setQuery } = useUserSearch();

  const handleUserClick = (user: User) => {
    router.push(`/users/${user.id}`);
  };

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchInput value={query} onChange={setQuery} />
      <UserList
        users={searchResult.users}
        isFiltered={searchResult.isFiltered}
        onUserClick={handleUserClick}
      />
    </div>
  );
}
