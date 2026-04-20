import React from 'react';
import styles from './UserSearchInput.module.css';

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  value,
  onChange,
  placeholder = '名前またはメールアドレスで検索',
}) => {
  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        className={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="ユーザー検索"
      />
    </div>
  );
};
