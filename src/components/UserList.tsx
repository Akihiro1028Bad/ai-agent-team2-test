import React from 'react';
import { User } from '../types/user';
import { UserCard } from './UserCard';
import styles from './UserList.module.css';

interface UserListProps {
  users: User[];
  isFiltered: boolean;
  onUserClick?: (user: User) => void;
}

export const UserList: React.FC<UserListProps> = ({
  users,
  isFiltered,
  onUserClick,
}) => {
  return (
    <div className={styles.userList}>
      {users.length > 0 ? (
        users.map((user) => (
          <UserCard key={user.id} user={user} onClick={onUserClick} />
        ))
      ) : (
        <div className={styles.emptyMessage} role="status">
          {isFiltered
            ? '該当するユーザーが見つかりません'
            : 'ユーザーが登録されていません'}
        </div>
      )}
    </div>
  );
};
