import React from 'react';
import styles from './UserSearchForm.module.css';

interface UserSearchFormProps {
  query: string;
  onQueryChange: (query: string) => void;
}

export const UserSearchForm: React.FC<UserSearchFormProps> = ({
  query,
  onQueryChange,
}) => {
  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        placeholder="名前またはメールアドレスで検索"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className={styles.searchInput}
      />
    </div>
  );
};
