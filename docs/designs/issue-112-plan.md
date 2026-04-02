# 実装計画: Issue #112 ユーザー検索機能の追加

## 1. 概要

設計書 `docs/designs/issue-112.md` に基づき、ユーザー一覧ページに検索機能を追加する。
名前またはメールアドレスの部分一致（大文字小文字区別なし）でリアルタイムフィルタリング（debounce 300ms）を行い、検索結果が0件の場合は適切なメッセージを表示する。

---

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義（依存なし）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 1 | `src/types/user.ts` | 変更 | `SearchParams`、`UserSearchResult` 型を追加 |

### Phase 2: Hook（Phase 1 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 2 | `src/hooks/useUserSearch.ts` | 新規 | `useDebounce` + `useUserSearch` — 検索ロジック・debounce・フィルタリングをカプセル化 |

### Phase 3: コンポーネント（Phase 1 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 3a | `src/components/UserSearchInput.tsx` | 新規 | 検索入力フィールド UI（プレースホルダー、クリアボタン、結果件数表示） |
| 3b | `src/components/UserSearchInput.module.css` | 新規 | 検索入力フィールドのスタイル — 既存 `ProfileEditForm.module.css` のパターンに準拠 |
| 3c | `src/components/UserSearchResults.tsx` | 新規 | 検索結果表示コンポーネント（0件メッセージ含む）— 既存 `UserCard` を利用 |

### Phase 4: ページ（Phase 2, 3 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 4 | `app/users/page.tsx` | 新規 | ユーザー一覧・検索ページ（`'use client'`） |

### Phase 5: テスト（Phase 1〜4 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 5a | `src/hooks/__tests__/useUserSearch.test.ts` | 新規 | `useUserSearch` のユニットテスト |
| 5b | `src/components/__tests__/UserSearchInput.test.tsx` | 新規 | `UserSearchInput` のユニットテスト |

### 変更なしファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/api/client.ts` | クライアントサイドフィルタリングのため API 追加不要 |
| `src/hooks/useUser.ts` | 単一ユーザー取得用。`useUserSearch` とは独立 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserCard.tsx` | 変更なし。検索結果の各行の表示に既存のまま利用 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `app/profile/page.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | スコープ外 |
| `app/layout.tsx` | スコープ外 |

---

## 3. 各ファイルの変更内容

### 3.1 `src/types/user.ts`（変更）

既存の `User` / `UserProfile` インターフェースは変更しない。以下の2つの型を末尾に追加する。

```typescript
// 既存の User / UserProfile はそのまま

/**
 * ユーザー検索パラメータ
 */
export interface SearchParams {
  query: string;
}

/**
 * ユーザー検索結果
 */
export interface UserSearchResult {
  users: User[];
  totalCount: number;
  query: string;
}
```

### 3.2 `src/hooks/useUserSearch.ts`（新規）

既存の `useUser.ts` の Hook パターン（`useState` + `useEffect`）に準拠。
`useDebounce` を同ファイル内のプライベート関数として定義する（設計書 5.2 の判断に従う）。

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../types/user';

/**
 * debounce用のカスタムhook（ファイル内プライベート）
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * ユーザー検索hook
 *
 * @param users フィルタリング対象のユーザー一覧
 * @returns query, filteredUsers, totalCount, isSearching, handleSearch
 */
export function useUserSearch(users: User[]) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return users;
    }

    const normalizedQuery = debouncedQuery.toLowerCase().trim();

    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery)
    );
  }, [users, debouncedQuery]);

  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
  }, []);

  return {
    query,
    filteredUsers,
    totalCount: filteredUsers.length,
    isSearching: query !== debouncedQuery,
    handleSearch,
  };
}
```

**設計ポイント**:
- `User[]` を引数として受け取り、データ取得の責務は呼び出し側に委ねる（単一責任の原則）
- `useMemo` でフィルタリング結果をメモ化
- `useCallback` で `handleSearch` の参照安定性を保つ
- `isSearching` は `query !== debouncedQuery` で debounce 待機中を判定

### 3.3 `src/components/UserSearchInput.tsx`（新規）

既存コンポーネント（`ProfileEditForm.tsx`）のパターンに準拠した Props 型定義 + 関数コンポーネント。

```typescript
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
```

**アクセシビリティ対応**:
- `aria-label="ユーザー検索"` を検索入力フィールドに設定
- `aria-label="検索をクリア"` をクリアボタンに設定
- `aria-live="polite"` を検索結果件数に設定

### 3.4 `src/components/UserSearchInput.module.css`（新規）

既存の `ProfileEditForm.module.css` のスタイルパターン（`max-width`、フォントサイズ、色、ボーダー、border-radius）に合わせる。

```css
.searchContainer {
  margin-bottom: 24px;
}

.inputWrapper {
  display: flex;
  align-items: center;
  max-width: 480px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 8px 12px;
  gap: 8px;
}

.searchIcon {
  font-size: 16px;
  flex-shrink: 0;
}

.searchInput {
  flex: 1;
  border: none;
  outline: none;
  font-size: 14px;
  padding: 0;
}

.clearButton {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: #888;
  padding: 0 4px;
  flex-shrink: 0;
}

.clearButton:hover {
  color: #333;
}

.resultCount {
  font-size: 12px;
  color: #888;
  margin: 8px 0 0;
}

.noResults {
  color: #888;
  font-size: 14px;
  padding: 24px 0;
  text-align: center;
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .inputWrapper {
    max-width: 100%;
  }
}
```

### 3.5 `src/components/UserSearchResults.tsx`（新規）

既存の `UserCard` を利用した検索結果表示コンポーネント。

```typescript
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
```

### 3.6 `app/users/page.tsx`（新規）

ユーザー一覧・検索ページ。既存の `app/users/[id]/page.tsx` と同じディレクトリ構成。

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { User } from '../../src/types/user';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchInput } from '../../src/components/UserSearchInput';
import { UserSearchResults } from '../../src/components/UserSearchResults';

// TODO: ユーザー一覧取得APIの実装後に差し替え
async function getUsers(): Promise<User[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/users`
  );
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const { query, filteredUsers, totalCount, isSearching, handleSearch } =
    useUserSearch(users);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchInput
        value={query}
        onChange={handleSearch}
        resultCount={totalCount}
        isSearching={isSearching}
      />
      <UserSearchResults users={filteredUsers} query={query} />
    </div>
  );
}
```

**設計ポイント**:
- データ取得はページコンポーネントの責務とし、`useUserSearch` にはフィルタリングのみを委ねる
- `getUsers()` はページ内ローカル関数として定義（将来的に `src/api/client.ts` に移動可能）
- 既存の `useUser` Hook のパターン（`useState` + `useEffect` + `finally`）に準拠

---

## 4. 依存関係図

```
Phase 1: src/types/user.ts（変更: SearchParams / UserSearchResult 型追加）
           │
     ┌─────┴──────────────────┐
     ▼                        ▼
Phase 2:                 Phase 3a + 3b + 3c:
src/hooks/useUserSearch.ts    UserSearchInput.tsx + .module.css
                              UserSearchResults.tsx
     │                        │
     └────────┬───────────────┘
              ▼
Phase 4: app/users/page.tsx
              │
              ▼
Phase 5: テスト（5a: Hook テスト, 5b: コンポーネントテスト）
```

**並列実装可能なグループ**:
- Phase 2 と Phase 3（3a, 3b, 3c）は互いに独立しているため並列実装可能
- Phase 5a と Phase 5b は互いに独立しているため並列実装可能

---

## 5. テスト方針

### 5.1 テストツール・パターン

既存テスト（`useUserProfile.test.ts` / `UserCard.test.tsx`）のパターンに準拠する。

- **テストフレームワーク**: Jest + ts-jest
- **テスト環境**: jsdom（`jest.config.js` で設定済み）
- **テストライブラリ**: `@testing-library/react`（`renderHook`, `waitFor`, `act`）/ `@testing-library/user-event`
- **CSS モジュール**: `identity-obj-proxy` で自動モック（`jest.config.js` で設定済み）
- **タイマーモック**: `jest.useFakeTimers()` で debounce テストを実現

### 5.2 `src/hooks/__tests__/useUserSearch.test.ts`

既存 `useUserProfile.test.ts` のパターンに準拠。`renderHook` + `act` + `waitFor` を使用。
debounce テストには `jest.useFakeTimers()` / `jest.advanceTimersByTime(300)` を使用。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期状態で全ユーザーが返される | クエリが空の場合、`filteredUsers` が全ユーザーと一致すること |
| 2 | 名前で検索 | 名前の部分一致でフィルタリングされること |
| 3 | メールアドレスで検索 | メールアドレスの部分一致でフィルタリングされること |
| 4 | 大文字小文字を区別しない | 大文字・小文字に関わらず検索結果が返されること |
| 5 | 検索結果0件 | 該当ユーザーがいない場合、空配列が返されること |
| 6 | debounce動作 | 入力後300ms経過前はフィルタリングされず、経過後に実行されること |
| 7 | totalCount | フィルタリング結果の件数が正しく返されること |
| 8 | クエリクリア | クエリを空にした場合、全ユーザーに戻ること |

**テストコード概要**:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import { User } from '../../types/user';

const mockUsers: User[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com', createdAt: '2024-01-01' },
  { id: '2', name: 'Bob Johnson', email: 'bob@example.com', createdAt: '2024-01-02' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@test.com', createdAt: '2024-01-03' },
];

describe('useUserSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('初期状態で全ユーザーが返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));
    expect(result.current.filteredUsers).toEqual(mockUsers);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.query).toBe('');
  });

  it('名前で検索できる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Alice Smith');
  });

  it('メールアドレスで検索できる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('test.com'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].email).toBe('charlie@test.com');
  });

  it('大文字小文字を区別しない', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('alice'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(1);
    expect(result.current.filteredUsers[0].name).toBe('Alice Smith');
  });

  it('検索結果が0件の場合は空配列が返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('zzz'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.filteredUsers).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('debounce待機中はisSearchingがtrueになる', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });

    expect(result.current.isSearching).toBe(true);

    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.isSearching).toBe(false);
  });

  it('totalCountが正しく返される', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('example.com'); });
    act(() => { jest.advanceTimersByTime(300); });

    expect(result.current.totalCount).toBe(2);
  });

  it('クエリをクリアすると全ユーザーに戻る', () => {
    const { result } = renderHook(() => useUserSearch(mockUsers));

    act(() => { result.current.handleSearch('Alice'); });
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.filteredUsers).toHaveLength(1);

    act(() => { result.current.handleSearch(''); });
    act(() => { jest.advanceTimersByTime(300); });
    expect(result.current.filteredUsers).toEqual(mockUsers);
  });
});
```

### 5.3 `src/components/__tests__/UserSearchInput.test.tsx`

既存 `UserCard.test.tsx` のパターンに準拠。`render` + `screen` + `fireEvent` を使用。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 検索入力フィールドが表示されること |
| 2 | プレースホルダー | 「名前またはメールアドレスで検索」が表示されること |
| 3 | 入力時のonChange | 文字入力時に `onChange` が正しい値で呼ばれること |
| 4 | クリアボタン表示 | 入力値がある場合にクリアボタンが表示されること |
| 5 | クリアボタン非表示 | 入力値が空の場合にクリアボタンが非表示であること |
| 6 | クリアボタンクリック | クリアボタン押下で `onChange('')` が呼ばれること |
| 7 | 検索結果件数表示 | 入力値がある場合に検索結果件数が表示されること |
| 8 | 検索中表示 | `isSearching` が `true` の場合に「検索中...」が表示されること |

**テストコード概要**:

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserSearchInput } from '../UserSearchInput';

describe('UserSearchInput', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('検索入力フィールドが表示される', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.getByRole('textbox', { name: 'ユーザー検索' })).toBeInTheDocument();
  });

  it('プレースホルダーが表示される', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('名前またはメールアドレスで検索')).toBeInTheDocument();
  });

  it('入力時にonChangeが呼ばれる', () => {
    render(<UserSearchInput {...defaultProps} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('test');
  });

  it('入力値がある場合にクリアボタンが表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" />);
    expect(screen.getByRole('button', { name: '検索をクリア' })).toBeInTheDocument();
  });

  it('入力値が空の場合にクリアボタンが非表示', () => {
    render(<UserSearchInput {...defaultProps} />);
    expect(screen.queryByRole('button', { name: '検索をクリア' })).not.toBeInTheDocument();
  });

  it('クリアボタン押下でonChange("")が呼ばれる', () => {
    render(<UserSearchInput {...defaultProps} value="test" />);
    fireEvent.click(screen.getByRole('button', { name: '検索をクリア' }));
    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('入力値がある場合に検索結果件数が表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" resultCount={3} />);
    expect(screen.getByText('検索結果: 3件')).toBeInTheDocument();
  });

  it('isSearchingがtrueの場合に「検索中...」が表示される', () => {
    render(<UserSearchInput {...defaultProps} value="test" isSearching={true} />);
    expect(screen.getByText('検索中...')).toBeInTheDocument();
  });
});
```

### 5.4 テスト実行コマンド

```bash
npm test
```

---

## 6. 実装時の注意事項

### 6.1 既存パターンとの一貫性

| 項目 | 既存パターン（参照元） | 新規ファイルでの適用 |
|------|----------------------|---------------------|
| Hook | `useUser.ts`: `useState` + `useEffect` + return object | `useUserSearch.ts` で同パターン |
| コンポーネント | `UserCard.tsx`: `React.FC<Props>` + Props interface | `UserSearchInput.tsx` / `UserSearchResults.tsx` で同パターン |
| CSS | `ProfileEditForm.module.css`: `border-radius: 6px`、色 `#ddd` / `#888`、フォント `14px` | `UserSearchInput.module.css` で同パターン |
| テスト（Hook） | `useUserProfile.test.ts`: `renderHook` + `act` + `waitFor` | `useUserSearch.test.ts` で同パターン |
| テスト（Component） | `UserCard.test.tsx`: `render` + `screen` + `fireEvent` | `UserSearchInput.test.tsx` で同パターン |

### 6.2 debounce の実装

- `useDebounce` を `useUserSearch.ts` 内にプライベート関数として定義（設計書 5.2）
- debounce 時間は 300ms
- `useEffect` のクリーンアップで `clearTimeout` を確実に実行しメモリリークを防止

### 6.3 アクセシビリティ

- 検索入力: `aria-label="ユーザー検索"`
- クリアボタン: `aria-label="検索をクリア"`
- 結果件数: `aria-live="polite"`

### 6.4 レスポンシブ対応

- モバイル（`max-width: 768px`）: 入力フィールドは幅 100%
- デスクトップ: `max-width: 480px`

### 6.5 データ取得について

- ページコンポーネント内で `getUsers()` を定義（`src/api/client.ts` には `getUsers` が未実装のため）
- 将来的に `src/api/client.ts` に `getUsers` を追加した際に差し替え可能な設計

---

## 7. テストエビデンス

テスト完了時に、以下のエビデンスを `docs/evidence/issue-112/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧の初期表示 | `user-list-initial.png` |
| 2 | 名前で検索した結果 | `user-search-by-name.png` |
| 3 | メールアドレスで検索した結果 | `user-search-by-email.png` |
| 4 | 検索結果0件 | `user-search-no-results.png` |
| 5 | 検索クリア後の表示 | `user-search-cleared.png` |
| 6 | モバイル表示 | `user-search-mobile.png` |

---

## 8. 見積もり

| Phase | 内容 | 見積もり |
|-------|------|----------|
| 1 | 型定義変更 | 小 |
| 2 | Hook 新規作成 | 中 |
| 3 | コンポーネント + CSS 新規作成 | 中 |
| 4 | ページ新規作成 | 小 |
| 5 | テスト | 中 |

合計変更ファイル数: **8ファイル**（新規7 + 変更1）— feature-m の基準（10ファイル以内）を満たす。
