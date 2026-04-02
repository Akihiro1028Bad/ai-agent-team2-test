import React from 'react';
import { User } from '../types/user';

interface UserCardProps {
  user: User;
  onClick?: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  return (
    <div className="user-card" onClick={() => onClick?.(user)}>
      <img src={user.avatarUrl || '/default-avatar.png'} alt={user.name || '名前未設定'} />
      <h3>{user.name || '名前未設定'}</h3>
      <p>{user.email}</p>
    </div>
  );
};
