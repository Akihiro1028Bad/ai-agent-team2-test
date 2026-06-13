import React from 'react';
import { User } from '../types/user';

interface UserCardProps {
  user: User;
  onClick?: (user: User) => void;
}

function formatLastLoginAt(lastLoginAt: string | null | undefined): string {
  if (lastLoginAt == null) return 'ログイン履歴なし';
  const date = new Date(lastLoginAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  return (
    <div className="user-card" onClick={() => onClick?.(user)}>
      <img src={user.avatarUrl || '/default-avatar.png'} alt={user.name || '名前未設定'} />
      <h3>{user.name || '名前未設定'}</h3>
      <p>{user.email}</p>
      <p>最終ログイン: {formatLastLoginAt(user.lastLoginAt)}</p>
    </div>
  );
};
