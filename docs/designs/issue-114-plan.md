# 実装計画: Issue #114 ユーザー検索機能の追加

## 1. 実装概要

設計書 `docs/designs/issue-114.md` に基づき、ユーザー一覧ページに検索機能を追加する。
クライアントサイドでのリアルタイムフィルタリング（debounce: 300ms）により、名前・メールアドレスの部分一致検索を実現する。
既存コードの型定義・APIクライアント・Hookパターンを踏襲し、新規コンポーネント・Hook・ページを追加する。

## 2. 変更ファイル一覧と実装順序

依存関係に基づき、以下の順序で実装する。下流のファイルが上流のファイルに依存するため、番号順に実装すること。

| 順序 | ファイルパス | 種別 | 新規/変更 | 依存先 |
|------|-------------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/api/client.ts` | APIクライアント | 変更 | 順序1 |
| 3 | `app/api/users/route.ts` | API Route | 新規 | 順序1 |
| 4 | `src/hooks/useUserSearch.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/UserSearchInput.module.css` | スタイル | 新規 | なし |
| 6 | `src/components/UserSearchInput.tsx` | コンポーネント | 新規 | なし |
| 7 | `src/components/UserList.module.css` | スタイル | 新規 | なし |
| 8 | `src/components/UserList.tsx` | コンポーネント | 新規 | 順序1（`User`型）, `UserCard`（既存） |
| 9 | `app/users/page.tsx` | ページ | 新規 | 順序4, 6, 8 |
| 10 | `src/hooks/__tests__/useUserSearch.test.ts` | テスト | 新規 | 順序4 |
| 11 | `src/components/__tests__/UserSearchInput.test.tsx` | テスト | 新規 | 順序6 |
| 12 | `src/components/__tests__/UserList.test.tsx` | テスト | 新規 | 順序8 |

### 変更なしのファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/hooks/useUser.ts` | 単一ユーザー取得のhookであり、検索機能とは独立 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserCard.tsx` | 既存のUserCardをそのまま再利用。変更不要 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | ユーザー詳細ページは変更不要 |
| `app/profile/page.tsx` | スコープ外 |
| `app/layout.tsx` | スコープ外 |

## 3. 各ファイルの変更内容

### 3.1 `src/types/user.ts`（変更）

**変更内容**: 既存の `User` / `UserProfile` はそのまま維持し、末尾に `SearchParams` と `UserSearchResult` 型を追加する。

```typescript
// 既存の User / UserProfile の後に追加

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
  isFiltered: boolean;
}
```

**確認ポイント**:
- 既存の `User` / `UserProfile` インターフェースに一切変更を加えないこと
- `UserSearchResult.users` は `User[]` 型（`UserProfile[]` ではない）

---

### 3.2 `src/api/client.ts`（変更）

**変更内容**: 既存コードの末尾に `getUsers()` 関数を追加する。既存の関数（`getUser`, `getUserProfile`, `updateUser`, `updateUserProfile`）には一切変更を加えない。

```typescript
// 既存コードの末尾に追加
/**
 * ユーザー一覧を取得する
 */
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}
```

**確認ポイント**:
- 既存の `getUser(id)` とは別の関数（引数なし、一覧取得）
- エラーハンドリングは既存パターン（`res.ok` チェック → `throw new Error`）を踏襲
- `User` 型のインポートは既存のインポート文に含まれているため追加不要

---

### 3.3 `app/api/users/route.ts`（新規）

**目的**: ユーザー一覧取得用のRoute Handler（モックデータ）。

```typescript
import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ: 実際のバックエンド実装後に置き換える
const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'yamada@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: '鈴木花子',
    email: 'suzuki@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'John Smith',
    email: 'john.smith@example.com',
    avatarUrl: '/default-avatar.png',
    createdAt: '2024-03-01T00:00:00Z',
  },
];

export async function GET() {
  return NextResponse.json(mockUsers);
}
```

**確認ポイント**:
- 日本語名・英語名の両方を含むテストデータにする（部分一致検索の動作確認用）
- モックデータであることをコメントで明記
- `app/api/users/route.ts` のパスに配置（既存の `app/api/notifications/` と同階層）

---

### 3.4 `src/hooks/useUserSearch.ts`（新規）

**目的**: ユーザー一覧の取得、検索クエリによるフィルタリング、debounce処理をカプセル化するカスタムHook。

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { User, SearchParams, UserSearchResult } from '../types/user';
import { getUsers } from '../api/client';

/**
 * ユーザー検索Hook
 * - ユーザー一覧を取得
 * - 検索クエリによるクライアントサイドフィルタリング
 * - debounce付きリアルタイム検索
 */
export function useUserSearch() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({ query: '' });
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // ユーザー一覧取得
  useEffect(() => {
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  // debounce処理（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchParams.query);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchParams.query]);

  // フィルタリング処理
  const searchResult: UserSearchResult = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return {
        users,
        totalCount: users.length,
        isFiltered: false,
      };
    }

    const lowerQuery = debouncedQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
    );

    return {
      users: filtered,
      totalCount: users.length,
      isFiltered: true,
    };
  }, [users, debouncedQuery]);

  // 検索クエリ更新
  const setQuery = useCallback((query: string) => {
    setSearchParams({ query });
  }, []);

  return {
    searchResult,
    loading,
    error,
    query: searchParams.query,
    setQuery,
  };
}
```

**確認ポイント**:
- 既存 `useUser` のパターン（`useState` + `useEffect` + `loading` / `error`）を踏襲
- debounceは `useEffect` + `setTimeout` / `clearTimeout` で自前実装（外部ライブラリ不使用）
- フィルタリング結果は `useMemo` でメモ化
- `setQuery` は `useCallback` でメモ化
- 将来サーバーサイド検索に移行する場合も、hookのインターフェース（`query` / `setQuery` / `searchResult`）は変更不要

---

### 3.5 `src/components/UserSearchInput.module.css`（新規）

**目的**: 検索入力フィールドのスタイル。

```css
.searchContainer {
  margin-bottom: 16px;
}

.searchInput {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.searchInput:focus {
  outline: none;
  border-color: #0070f3;
  box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.2);
}
```

---

### 3.6 `src/components/UserSearchInput.tsx`（新規）

**目的**: 検索入力フィールドのUIコンポーネント。

```typescript
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
```

**確認ポイント**:
- `aria-label="ユーザー検索"` でアクセシビリティ対応
- `placeholder` はデフォルト値付きのオプショナルprop
- 既存の `UserCard` と同様に `React.FC` + Props インターフェースのパターンを踏襲

---

### 3.7 `src/components/UserList.module.css`（新規）

**目的**: ユーザー一覧のスタイル。

```css
.userList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.emptyMessage {
  text-align: center;
  color: #666;
  padding: 24px;
  font-size: 14px;
}
```

---

### 3.8 `src/components/UserList.tsx`（新規）

**目的**: ユーザー一覧の表示、0件メッセージの表示を担当するコンポーネント。

```typescript
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
```

**確認ポイント**:
- 既存の `UserCard` コンポーネントをそのまま再利用
- 0件メッセージは `isFiltered` で出し分け（フィルタ結果0件 vs ユーザー未登録）
- `role="status"` でスクリーンリーダーに通知（アクセシビリティ対応）

---

### 3.9 `app/users/page.tsx`（新規）

**目的**: ユーザー一覧 + 検索機能を統合したページコンポーネント。

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchInput } from '../../src/components/UserSearchInput';
import { UserList } from '../../src/components/UserList';
import { User } from '../../src/types/user';

export default function UsersPage() {
  const router = useRouter();
  const { searchResult, loading, error, query, setQuery } = useUserSearch();

  const handleUserClick = (user: User) => {
    router.push(`/users/${user.id}`);
  };

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchInput value={query} onChange={setQuery} />
      <UserList
        users={searchResult.users}
        isFiltered={searchResult.isFiltered}
        onUserClick={handleUserClick}
      />
    </div>
  );
}
```

**確認ポイント**:
- `'use client'` ディレクティブ（`useState` / `useRouter` 使用のため）
- 既存の `app/users/[id]/page.tsx`（ユーザー詳細）と共存する構成
- ユーザーカードクリックで `/users/[id]` に遷移
- Loading / Error の表示パターンは既存ページ（`app/profile/page.tsx` 等）を踏襲

## 4. 依存関係図

```
src/types/user.ts（変更: SearchParams, UserSearchResult 追加）
  ├─→ src/api/client.ts（変更: getUsers() 追加）
  │     ↓
  │   src/hooks/useUserSearch.ts（新規: 検索hook）
  │     ↓
  ├─→ src/components/UserSearchInput.tsx + CSS（新規: 検索入力UI）
  │     ↓
  ├─→ src/components/UserList.tsx + CSS（新規: 一覧表示UI）
  │     ↓
  │   app/users/page.tsx（新規: ユーザー一覧ページ）
  │
  └─→ app/api/users/route.ts（新規: Route Handler モック）

既存コンポーネントの再利用:
  src/components/UserCard.tsx ←── UserList.tsx が利用（変更なし）
```

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5〜6 と 順序7〜8 は互いに独立しているため並列実装可能

## 5. テスト方針

### 5.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserSearch` | `src/hooks/__tests__/useUserSearch.test.ts` | ユーザー一覧取得 / フィルタリング / debounce / 0件時の動作 / エラーハンドリング |
| `UserSearchInput` | `src/components/__tests__/UserSearchInput.test.tsx` | 入力フィールド表示 / テキスト入力 / onChange呼び出し |
| `UserList` | `src/components/__tests__/UserList.test.tsx` | ユーザーカード一覧表示 / 0件メッセージ表示 / クリックイベント |

### 5.2 テストケース詳細

#### `useUserSearch.test.ts`

テストパターンは既存の `useUserProfile.test.ts` を踏襲する（`renderHook` + `waitFor` + `act` + `jest.mock`）。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | `getUsers()` が呼ばれ、`loading: true` → `false` に遷移すること |
| 2 | 取得成功 | ユーザーデータが `searchResult.users` に正しくセットされ、`isFiltered: false` であること |
| 3 | 取得エラー | `error` にエラーオブジェクトがセットされること |
| 4 | 名前による検索 | 名前の部分一致でフィルタリングされること |
| 5 | メールアドレスによる検索 | メールアドレスの部分一致でフィルタリングされること |
| 6 | 大文字・小文字の区別なし | 大文字・小文字を区別せずに検索できること |
| 7 | 検索結果0件 | フィルタリング結果が空配列で、`isFiltered: true` であること |
| 8 | 空文字で全件表示 | クエリが空の場合、全ユーザーが返され `isFiltered: false` であること |
| 9 | debounce動作 | 入力直後はフィルタリングされず、300ms後にフィルタリングが実行されること |

```typescript
// テストの実装方針
import { renderHook, waitFor, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';
import { getUsers } from '../../api/client';

jest.mock('../../api/client');

const mockGetUsers = getUsers as jest.MockedFunction<typeof getUsers>;

const mockUsers = [
  { id: '1', name: '山田太郎', email: 'yamada@example.com', createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', name: '鈴木花子', email: 'suzuki@example.com', createdAt: '2024-02-01T00:00:00Z' },
  { id: '3', name: 'John Smith', email: 'john.smith@example.com', createdAt: '2024-03-01T00:00:00Z' },
];

// debounceテストでは jest.useFakeTimers() + jest.advanceTimersByTime(300) を使用
```

#### `UserSearchInput.test.tsx`

テストパターンは既存の `UserCard.test.tsx` を踏襲する（`render` + `screen` + `fireEvent`）。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 検索入力フィールドが表示されること |
| 2 | プレースホルダー表示 | 「名前またはメールアドレスで検索」が表示されること |
| 3 | テキスト入力 | 入力時に `onChange` が呼ばれること |
| 4 | 値の反映 | `value` propsが入力フィールドに反映されること |
| 5 | aria-label | `aria-label="ユーザー検索"` が付与されていること |

#### `UserList.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ユーザー一覧表示 | 渡されたユーザーがUserCardで表示されること |
| 2 | フィルタリング結果0件 | `isFiltered: true` かつユーザー0件時に「該当するユーザーが見つかりません」が表示されること |
| 3 | ユーザー未登録 | `isFiltered: false` かつユーザー0件時に「ユーザーが登録されていません」が表示されること |
| 4 | ユーザーカードクリック | クリック時に `onUserClick` が呼ばれること |

### 5.3 テスト実行コマンド

```bash
npm test
```

### 5.4 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-114/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧の初期表示 | `user-list-initial.png` |
| 2 | 名前で検索した結果 | `user-search-by-name.png` |
| 3 | メールアドレスで検索した結果 | `user-search-by-email.png` |
| 4 | 検索結果0件の表示 | `user-search-no-results.png` |
| 5 | 検索クリア後の全件表示 | `user-search-cleared.png` |

## 6. 実装上の注意事項

### 6.1 debounce処理
- `useEffect` + `setTimeout` で300msのdebounceを実装する
- 外部ライブラリ（lodash等）は使用せず、自前のdebounceとする
- コンポーネントのアンマウント時はクリーンアップ関数でタイマーをクリアする

### 6.2 既存コードへの影響
- `src/types/user.ts`: 末尾への追加のみ。既存の `User` / `UserProfile` は変更なし
- `src/api/client.ts`: 末尾への関数追加のみ。既存関数は変更なし
- `src/components/UserCard.tsx`: 変更なし。`UserList` から再利用するのみ
- `src/hooks/useUser.ts`: 変更なし。`useUserSearch` は独立したhookとして新規作成

### 6.3 アクセシビリティ
- 検索入力フィールドに `aria-label="ユーザー検索"` を付与する
- 検索結果0件時のメッセージに `role="status"` を付与し、スクリーンリーダーに通知する

## 7. 実装チェックリスト

- [ ] `src/types/user.ts` に `SearchParams`, `UserSearchResult` 型を追加
- [ ] `src/api/client.ts` に `getUsers()` 関数を追加
- [ ] `app/api/users/route.ts` を新規作成（モックデータ）
- [ ] `src/hooks/useUserSearch.ts` を新規作成
- [ ] `src/components/UserSearchInput.module.css` を新規作成
- [ ] `src/components/UserSearchInput.tsx` を新規作成
- [ ] `src/components/UserList.module.css` を新規作成
- [ ] `src/components/UserList.tsx` を新規作成
- [ ] `app/users/page.tsx` を新規作成
- [ ] `src/hooks/__tests__/useUserSearch.test.ts` を作成・実行
- [ ] `src/components/__tests__/UserSearchInput.test.tsx` を作成・実行
- [ ] `src/components/__tests__/UserList.test.tsx` を作成・実行
- [ ] 全テスト通過を確認（`npm test`）
- [ ] テストエビデンスを保存
