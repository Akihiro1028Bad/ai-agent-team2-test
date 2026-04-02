import React from 'react';
import Link from 'next/link';
import { User } from '../types/user';
import styles from './UserList.module.css';

interface UserListProps {
  users: User[];
  isSearching: boolean;
}

export const UserList: React.FC<UserListProps> = ({ users, isSearching }) => {
  return (
    <div className={styles.listContainer}>
      {users.length === 0 && isSearching ? (
        <p className={styles.emptyMessage}>該当するユーザーが見つかりませんでした</p>
      ) : (
        <ul className={styles.userList}>
          {users.map((user) => (
            <li key={user.id} className={styles.userItem}>
              <Link href={`/users/${user.id}`}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
