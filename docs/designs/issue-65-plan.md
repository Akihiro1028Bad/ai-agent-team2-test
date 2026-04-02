# 実装計画: Issue #65 ユーザー検索機能の追加

## 1. 概要

設計書 `docs/designs/issue-65.md` に基づき、ユーザー一覧ページを新規作成し、名前・メールアドレスによるユーザー検索機能を追加する。
クライアントサイドフィルタリング（debounce 300ms）で検索を実現し、Route Handler（モックデータ10件）でAPI層を提供する。

---

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義（依存なし）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 1 | `src/types/user.ts` | 変更 | `SearchParams` インターフェースの追加 |

### Phase 2: API層（Phase 1 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 2a | `src/api/client.ts` | 変更 | `getUsers()` 関数の追加 — 既存パターンに準拠 |
| 2b | `app/api/users/route.ts` | 新規 | GET の Route Handler（モックデータ10件、インメモリ配列） |

### Phase 3: Hook（Phase 2a に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 3 | `src/hooks/useUserSearch.ts` | 新規 | ユーザー一覧取得 + クライアントサイドフィルタリング + debounce — 既存 `useUser.ts` のパターンに準拠 |

### Phase 4: コンポーネント（互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 4a | `src/components/UserSearchForm.tsx` | 新規 | 検索入力フィールド UI |
| 4b | `src/components/UserSearchForm.module.css` | 新規 | 検索フォームのスタイル |
| 4c | `src/components/UserList.tsx` | 新規 | ユーザー一覧表示 + 0件メッセージ UI |
| 4d | `src/components/UserList.module.css` | 新規 | ユーザー一覧のスタイル |

### Phase 5: ページ（Phase 3, 4 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 5 | `app/users/page.tsx` | 新規 | ユーザー一覧・検索ページ（`'use client'`） |

### Phase 6: テスト（Phase 1〜5 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 6a | `src/hooks/__tests__/useUserSearch.test.ts` | 新規 | Hook のユニットテスト |
| 6b | `src/components/__tests__/UserSearchForm.test.tsx` | 新規 | UserSearchForm のユニットテスト |
| 6c | `src/components/__tests__/UserList.test.tsx` | 新規 | UserList のユニットテスト |
| 6d | `app/users/__tests__/page.test.tsx` | 新規 | ユーザー一覧ページの結合テスト |

### 変更なしファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/hooks/useUser.ts` | 単一ユーザー取得の責務は変更なし |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | ユーザー詳細ページは変更不要 |
| `app/layout.tsx` | ナビゲーション変更はスコープ外 |

---

## 3. 各ファイルの変更内容

### 3.1 `src/types/user.ts`（変更）

既存の `User` / `UserProfile` はそのまま。末尾に `SearchParams` インターフェースを追加する。

```typescript
// 既存の User / UserProfile は変更なし

// 新規追加
/**
 * ユーザー検索パラメータ
 */
export interface SearchParams {
  query: string;
}
```

### 3.2 `src/api/client.ts`（変更）

既存の `getUser()` / `getUserProfile()` / `updateUser()` / `updateUserProfile()` はそのまま。末尾に `getUsers()` 関数を追加する。

**追加コード**:
```typescript
/**
 * ユーザー一覧を取得する
 */
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  return res.json();
}
```

### 3.3 `app/api/users/route.ts`（新規）

モックデータ10件を返す GET Route Handler。既存の `app/api/notifications/settings/route.ts` のパターンに準拠。

```typescript
import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ（10件）— 実際のDB連携は後続Issueで対応
const mockUsers: User[] = [
  {
    id: '1',
    name: '山田太郎',
    email: 'taro.yamada@example.com',
    createdAt: new Date('2024-01-15T09:00:00.000Z'),
  },
  {
    id: '2',
    name: '佐藤花子',
    email: 'hanako.sato@example.com',
    createdAt: new Date('2024-02-20T10:30:00.000Z'),
  },
  {
    id: '3',
    name: '鈴木一郎',
    email: 'ichiro.suzuki@example.com',
    createdAt: new Date('2024-03-10T14:00:00.000Z'),
  },
  {
    id: '4',
    name: '田中美咲',
    email: 'misaki.tanaka@example.com',
    createdAt: new Date('2024-04-05T08:15:00.000Z'),
  },
  {
    id: '5',
    name: '高橋健太',
    email: 'kenta.takahashi@example.com',
    createdAt: new Date('2024-05-12T11:45:00.000Z'),
  },
  {
    id: '6',
    name: '伊藤あゆみ',
    email: 'ayumi.ito@example.com',
    createdAt: new Date('2024-06-18T16:20:00.000Z'),
  },
  {
    id: '7',
    name: '渡辺大輔',
    email: 'daisuke.watanabe@example.com',
    createdAt: new Date('2024-07-22T13:00:00.000Z'),
  },
  {
    id: '8',
    name: '小林さくら',
    email: 'sakura.kobayashi@example.com',
    createdAt: new Date('2024-08-30T09:30:00.000Z'),
  },
  {
    id: '9',
    name: '加藤裕太',
    email: 'yuta.kato@example.com',
    createdAt: new Date('2024-09-14T15:00:00.000Z'),
  },
  {
    id: '10',
    name: '松本真理',
    email: 'mari.matsumoto@example.com',
    createdAt: new Date('2024-10-01T10:00:00.000Z'),
  },
];

export async function GET() {
  return NextResponse.json(mockUsers);
}
```

### 3.4 `src/hooks/useUserSearch.ts`（新規）

既存 `useUser.ts` のパターン（`useState` + `useEffect` + `{ data, loading, error }` 返却）に準拠。内部に `useDebounce` ヘルパーhookを定義し、`useMemo` でフィルタリング結果をメモ化する。

```typescript
import { useState, useEffect, useMemo } from 'react';
import { User } from '../types/user';
import { getUsers } from '../api/client';

/**
 * debounce用のカスタムhook
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function useUserSearch() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState('');

  const debouncedQuery = useDebounce(query, 300);

  // ユーザー一覧の取得
  useEffect(() => {
    setLoading(true);
    setError(null);
    getUsers()
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  // クライアントサイドフィルタリング
  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) return users;
    const lowerQuery = debouncedQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(lowerQuery) ||
        user.email.toLowerCase().includes(lowerQuery)
    );
  }, [users, debouncedQuery]);

  return {
    users: filteredUsers,
    allUsers: users,
    loading,
    error,
    query,
    setQuery,
  };
}
```

### 3.5 `src/components/UserSearchForm.tsx`（新規）

検索入力フィールドのプレゼンテーションコンポーネント。CSS Modules でスタイリング。

```typescript
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
```

### 3.6 `src/components/UserSearchForm.module.css`（新規）

既存 CSS Modules（`ProfileEditForm.module.css` 等）のスタイルパターンに合わせる。

```css
.searchContainer {
  max-width: 600px;
  margin: 0 auto 24px;
}

.searchInput {
  width: 100%;
  padding: 12px 16px;
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

### 3.7 `src/components/UserList.tsx`（新規）

ユーザー一覧表示コンポーネント。0件メッセージの表示制御に `isSearching` prop を使用。

```typescript
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
```

### 3.8 `src/components/UserList.module.css`（新規）

```css
.listContainer {
  max-width: 600px;
  margin: 0 auto;
}

.userList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.userItem {
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 8px;
  transition: background-color 0.2s;
}

.userItem:hover {
  background-color: #f9f9f9;
}

.userItem a {
  display: block;
  padding: 16px;
  text-decoration: none;
  color: inherit;
}

.userName {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 4px;
}

.userEmail {
  font-size: 14px;
  color: #666;
}

.emptyMessage {
  text-align: center;
  color: #888;
  padding: 32px 0;
  font-size: 14px;
}
```

### 3.9 `app/users/page.tsx`（新規）

既存 `app/users/[id]/page.tsx` のパターン（`'use client'`、Hook呼び出し、loading/error分岐）に準拠。

```typescript
'use client';

import React from 'react';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchForm } from '../../src/components/UserSearchForm';
import { UserList } from '../../src/components/UserList';

export default function UsersPage() {
  const { users, loading, error, query, setQuery } = useUserSearch();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchForm query={query} onQueryChange={setQuery} />
      <UserList users={users} isSearching={query.trim().length > 0} />
    </div>
  );
}
```

---

## 4. 依存関係図

```
Phase 1: src/types/user.ts（変更: SearchParams型追加）
           │
     ┌─────┴─────┐
     ▼           ▼
Phase 2a:      Phase 2b:
client.ts      app/api/users/route.ts
(getUsers追加)  (新規: Route Handler)
     │
     ▼
Phase 3: src/hooks/useUserSearch.ts（新規）
     │
     ├──────────────────┐
     ▼                  ▼
Phase 4a+4b:         Phase 4c+4d:
UserSearchForm.tsx   UserList.tsx
+ .module.css        + .module.css
     │                  │
     └────────┬─────────┘
              ▼
Phase 5: app/users/page.tsx（新規）
              │
              ▼
Phase 6: テスト
  6a: useUserSearch.test.ts
  6b: UserSearchForm.test.tsx
  6c: UserList.test.tsx
  6d: app/users/__tests__/page.test.tsx
```

---

## 5. テスト方針

### 5.1 テストツール・パターン

既存テスト（`useUserProfile.test.ts` / `UserCard.test.tsx` / `app/users/[id]/__tests__/page.test.tsx`）のパターンに準拠する。

- **テストフレームワーク**: Jest + ts-jest
- **テスト環境**: jsdom（`jest.config.js` で設定済み）
- **テストライブラリ**: `@testing-library/react`（`renderHook` / `render` / `screen` / `fireEvent` / `waitFor` / `act`）
- **モック**: `jest.mock()` で API クライアントをモック
- **CSS モジュール**: `identity-obj-proxy` で自動モック（`jest.config.js` で設定済み）
- **Next.js モック**: `next/link` は `jest.setup.ts` で設定済み、`next/navigation` は個別テストで `jest.mock()` する

### 5.2 `src/hooks/__tests__/useUserSearch.test.ts`

既存 `useUserProfile.test.ts` のパターンに準拠。`jest.mock('../../api/client')` で `getUsers` をモック。debounce テストでは `jest.useFakeTimers()` + `act(() => jest.advanceTimersByTime(300))` を使用。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | `getUsers` が呼ばれ、ユーザー一覧が取得されること |
| 2 | ローディング状態 | 取得中は `loading: true`、完了後 `loading: false` であること |
| 3 | 取得成功 | ユーザーデータが `users` に正しくセットされること |
| 4 | 取得エラー | `error` にエラーがセットされること |
| 5 | 名前で検索 | 名前の部分一致でフィルタリングされること |
| 6 | メールアドレスで検索 | メールアドレスの部分一致でフィルタリングされること |
| 7 | 大文字小文字の区別なし | 大文字小文字を区別せずに検索できること |
| 8 | 検索クエリクリア | クエリを空にすると全件表示に戻ること |
| 9 | debounce動作 | 入力後300ms経過するまでフィルタリングが実行されないこと |

### 5.3 `src/components/__tests__/UserSearchForm.test.tsx`

既存 `UserCard.test.tsx` のパターンに準拠。`render` + `screen` + `fireEvent` で検証。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 検索入力フィールドが表示されること |
| 2 | プレースホルダー | 「名前またはメールアドレスで検索」が表示されること |
| 3 | 入力変更 | テキスト入力時に `onQueryChange` が呼ばれること |

### 5.4 `src/components/__tests__/UserList.test.tsx`

既存 `UserCard.test.tsx` のパターンに準拠。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ユーザー一覧表示 | 渡されたユーザーが一覧表示されること |
| 2 | ユーザー名とメールの表示 | 名前とメールアドレスが表示されること |
| 3 | ユーザー詳細へのリンク | 各ユーザーが `/users/[id]` へのリンクを持つこと |
| 4 | 検索結果0件（検索中） | `isSearching=true` で0件の場合にメッセージが表示されること |
| 5 | 初期状態0件 | `isSearching=false` で0件の場合にメッセージが表示されないこと |

### 5.5 `app/users/__tests__/page.test.tsx`

既存 `app/users/[id]/__tests__/page.test.tsx` のパターンに準拠。`jest.mock()` で `useUserSearch` Hook をモック。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ページ表示 | ユーザー一覧ページが正しく表示されること（タイトル「ユーザー一覧」） |
| 2 | ローディング表示 | 読み込み中に「読み込み中...」が表示されること |
| 3 | エラー表示 | エラー時にエラーメッセージが表示されること |
| 4 | 検索機能 | 検索フィールドに入力するとフィルタリングされること |

### 5.6 テスト実行コマンド

```bash
npm test
```

---

## 6. 実装時の注意事項

### 6.1 debounce 実装

- `useDebounce` カスタムhookを `useUserSearch.ts` 内にプライベート関数として定義する（外部エクスポートしない）
- debounce 待機時間は 300ms
- テスト時は `jest.useFakeTimers()` でタイマーを制御する

### 6.2 モックデータの取り扱い

- Route Handler (`app/api/users/route.ts`) ではインメモリ配列にデータを保持する
- 実際の DB 連携は後続 Issue で対応
- コード内コメントで「モックデータ」であることを明記する

### 6.3 クライアントサイドフィルタリング

- `useMemo` を使用してフィルタリング結果をメモ化する
- 大文字小文字を区別しない検索（`toLowerCase()` を使用）
- `name` と `email` の両方を検索対象とする（OR条件）
- 空文字列の場合は全件返却する

### 6.4 既存パターンとの一貫性

| 項目 | 既存パターン（参照元） | 新規ファイルでの適用 |
|------|----------------------|---------------------|
| API クライアント | `src/api/client.ts`: `API_BASE` 定数、`fetch` + `!res.ok` エラーハンドリング | `getUsers()` で同パターン |
| Hook | `useUser.ts`: `useState` + `useEffect` + `{ data, loading, error }` 返却 | `useUserSearch.ts` で同パターン |
| ページ | `app/users/[id]/page.tsx`: `'use client'`、loading/error 分岐 | `app/users/page.tsx` で同パターン |
| テスト（Hook） | `useUserProfile.test.ts`: `jest.mock` + `renderHook` + `waitFor` | `useUserSearch.test.ts` で同パターン |
| テスト（Component） | `UserCard.test.tsx`: `render` + `screen` + `fireEvent` | `UserSearchForm.test.tsx` / `UserList.test.tsx` で同パターン |
| テスト（Page） | `app/users/[id]/__tests__/page.test.tsx`: `jest.mock` + API モック | `app/users/__tests__/page.test.tsx` で同パターン |

### 6.5 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| 一覧取得失敗 | `エラーが発生しました: {error.message}` |
| 検索結果0件 | `該当するユーザーが見つかりませんでした` |

### 6.6 アクセシビリティ

- 検索入力フィールドに `placeholder="名前またはメールアドレスで検索"` を設定
- ユーザー一覧項目は `next/link` の `<Link>` コンポーネントで実装し、キーボードナビゲーションに対応

---

## 7. 見積もり

| Phase | 内容 | 見積もり |
|-------|------|----------|
| 1 | 型定義（SearchParams追加） | 小 |
| 2 | API クライアント + Route Handler | 小 |
| 3 | Hook（useUserSearch） | 中 |
| 4 | コンポーネント（UserSearchForm + UserList + CSS） | 中 |
| 5 | ページ（app/users/page.tsx） | 小 |
| 6 | テスト（4ファイル） | 中 |
