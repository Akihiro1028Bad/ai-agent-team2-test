'use client';

import React from 'react';
import { useUsers } from '../../src/hooks/useUsers';
import { UserCard } from '../../src/components/UserCard';

export default function UsersPage() {
  const { users, loading, error } = useUsers();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (users.length === 0) return <div>ユーザーが見つかりません</div>;

  return (
    <div>
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
