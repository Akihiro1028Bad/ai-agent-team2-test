import React from 'react';
import { User } from '../types/user';
import { UserCard } from './UserCard';
import styles from './UserSearchInput.module.css';

interface UserSearchResultsProps {
  users: User[];
  query: string;
}

export const UserSearchResults: React.FC<UserSearchResultsProps> = ({
  users,
  query,
}) => {
  return (
    <div>
      {users.length > 0 ? (
        users.map((user) => <UserCard key={user.id} user={user} />)
      ) : query ? (
        <p className={styles.noResults}>該当するユーザーが見つかりませんでした</p>
      ) : null}
    </div>
  );
};
