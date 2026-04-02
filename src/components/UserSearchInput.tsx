import React from 'react';
import styles from './UserSearchInput.module.css';

interface UserSearchInputProps {
  value: string;
  onChange: (query: string) => void;
  resultCount?: number;
  isSearching?: boolean;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({
  value,
  onChange,
  resultCount,
  isSearching,
}) => {
  return (
    <div className={styles.searchContainer}>
      <div className={styles.inputWrapper}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="名前またはメールアドレスで検索"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="ユーザー検索"
        />
        {value && (
          <button
            className={styles.clearButton}
            onClick={() => onChange('')}
            aria-label="検索をクリア"
            type="button"
          >
            ✕
          </button>
        )}
      </div>
      {value && (
        <p className={styles.resultCount} aria-live="polite">
          {isSearching ? '検索中...' : `検索結果: ${resultCount}件`}
        </p>
      )}
    </div>
  );
};
