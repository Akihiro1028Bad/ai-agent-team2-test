# 設計書: Issue #114 ユーザー検索機能の追加

## 1. 概要

ユーザー一覧ページに検索機能を追加し、名前・メールアドレスで検索できるようにする。

- 検索入力フィールドをユーザー一覧ページに追加
- 名前またはメールアドレスの部分一致で検索
- 検索結果をリアルタイムでフィルタリング（debounce付き）
- 検索結果が0件の場合は適切なメッセージを表示
- カスタムhook（`useUserSearch`）で検索ロジックを分離

### 1.1 背景

現在のアプリケーションにはユーザー一覧表示（`UserCard`）やユーザー詳細表示（`UserProfileView`）が実装されているが、ユーザー数が増加した場合に特定のユーザーを素早く見つける手段がない。ユーザー一覧ページに検索機能を追加することで、名前やメールアドレスから目的のユーザーを効率的に探せるようにする。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— 検索UIコンポーネント、カスタムhook、型定義、テスト
- **対象外**: バックエンド側の検索API実装（クライアントサイドフィルタリングで実装）
- **フィルタリング方式**: クライアントサイドでのリアルタイムフィルタリング（debounce: 300ms）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | 検索対象フィールド | 名前（`name`）およびメールアドレス（`email`） |
| 2 | 検索方式 | 部分一致（大文字・小文字を区別しない） |
| 3 | フィルタリング方式 | クライアントサイドリアルタイムフィルタリング |
| 4 | debounce | 300ms |
| 5 | 検索結果0件時 | 「該当するユーザーが見つかりません」メッセージ表示 |
| 6 | Issue種別 | feature-m（5〜8ファイル程度の変更） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（`SearchParams` 型追加） |
| **APIクライアント** | `src/api/client.ts` | `getUser` / `getUserProfile` 等実装済み | ⚠️ 変更（ユーザー一覧取得関数追加） |
| **Hook** | `src/hooks/useUser.ts` | 単一ユーザー取得のみ | ✅ 変更なし（新規hookで対応） |
| **コンポーネント** | `src/components/UserCard.tsx` | ユーザーカード表示済み | ✅ 変更なし |

### 2.2 既存の型定義

```typescript
// src/types/user.ts（現在）
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}
```

### 2.3 既存のAPIクライアントパターン

```typescript
// src/api/client.ts（現在のパターン）
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getUser(id: string): Promise<User> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}
```

### 2.4 既存のHookパターン

```typescript
// src/hooks/useUser.ts（現在のパターン）
export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getUser(id)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { user, loading, error };
}
```

### 2.5 既存のUserCardコンポーネント

```typescript
// src/components/UserCard.tsx（現在）
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
```

## 3. 機能設計

### 3.1 ユーザー検索画面

#### UI構成

```
┌──────────────────────────────────────────┐
│  ユーザー一覧                             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 名前またはメールアドレスで検索   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [UserCard] ユーザーA               │  │
│  │  user-a@example.com               │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ [UserCard] ユーザーB               │  │
│  │  user-b@example.com               │  │
│  └────────────────────────────────────┘  │
│  ...                                     │
│                                          │
│  ※ 検索結果0件時:                        │
│  「該当するユーザーが見つかりません」      │
└──────────────────────────────────────────┘
```

#### ユーザー操作フロー

```
[ユーザー一覧ページにアクセス]
  ↓
[API: GET /api/users でユーザー一覧を取得]
  ↓
[全ユーザーをUserCardで一覧表示]
  ↓
[検索フィールドにテキストを入力]
  ↓ （300ms debounce）
[入力テキストで名前・メールアドレスを部分一致フィルタリング]
  ↓
[フィルタリング結果を表示]
  → 該当ユーザーあり → UserCardリストを更新表示
  → 該当ユーザーなし → 「該当するユーザーが見つかりません」表示
  ↓
[検索フィールドをクリア]
  ↓
[全ユーザーの一覧に戻る]
```

### 3.2 検索仕様

| 項目 | 仕様 |
|------|------|
| 検索対象 | `User.name` および `User.email` |
| 検索方式 | 部分一致（`includes`） |
| 大文字・小文字 | 区別しない（`toLowerCase()` で比較） |
| debounce | 300ms |
| 空文字の場合 | 全件表示 |
| 検索結果0件 | 「該当するユーザーが見つかりません」を表示 |

## 4. 型定義

### 4.1 `src/types/user.ts` への追加

```typescript
// 既存の User / UserProfile は変更なし

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

## 5. API設計

### 5.1 ユーザー一覧取得関数の追加

```
src/api/client.ts ← 変更（関数追加）
```

既存の `src/api/client.ts` に、ユーザー一覧取得用の関数を追加する。

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

### 5.2 Route Handler（モックデータ）

```
app/api/users/route.ts ← 新規
```

ユーザー一覧取得用のRoute Handlerをモックデータで実装する。

```typescript
import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ
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

## 6. Hook設計

### 6.1 新規Hook: `useUserSearch`

```
src/hooks/useUserSearch.ts ← 新規
```

**責務**: ユーザー一覧の取得、検索クエリによるフィルタリング、debounce処理をカプセル化

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

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `searchResult` | `UserSearchResult` | フィルタリング後のユーザー一覧 |
| `loading` | `boolean` | ユーザー一覧読み込み中フラグ |
| `error` | `Error \| null` | エラー情報 |
| `query` | `string` | 現在の検索クエリ文字列 |
| `setQuery` | `(query: string) => void` | 検索クエリ更新関数 |

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `UserSearchInput`

```
src/components/UserSearchInput.tsx        ← 新規
src/components/UserSearchInput.module.css ← 新規
```

**責務**: 検索入力フィールドのUI

**Props**:
```typescript
interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

**UI構成**:
```
<div class="searchContainer">
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder="名前またはメールアドレスで検索"
    class="searchInput"
  />
</div>
```

### 7.2 CSSモジュール: `UserSearchInput.module.css`

既存の CSS モジュールパターンに合わせ、以下のクラスを定義する。

| クラス名 | 説明 |
|---------|------|
| `.searchContainer` | 検索フィールドのコンテナ |
| `.searchInput` | 検索入力フィールド |

### 7.3 新規コンポーネント: `UserList`

```
src/components/UserList.tsx        ← 新規
src/components/UserList.module.css ← 新規
```

**責務**: ユーザー一覧の表示、検索機能の統合、0件メッセージの表示

**Props**:
```typescript
interface UserListProps {
  users: User[];
  isFiltered: boolean;
  onUserClick?: (user: User) => void;
}
```

**UI構成**:
```
<div class="userList">
  {users.length > 0 ? (
    users.map((user) => (
      <UserCard key={user.id} user={user} onClick={onUserClick} />
    ))
  ) : (
    <div class="emptyMessage">
      {isFiltered
        ? '該当するユーザーが見つかりません'
        : 'ユーザーが登録されていません'}
    </div>
  )}
</div>
```

### 7.4 CSSモジュール: `UserList.module.css`

| クラス名 | 説明 |
|---------|------|
| `.userList` | ユーザーカード一覧のコンテナ |
| `.emptyMessage` | 結果0件時のメッセージ |

## 8. ページコンポーネント設計

### 8.1 新規ページ: `app/users/page.tsx`

ユーザー一覧 + 検索機能を統合したページコンポーネント。

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

## 9. 状態管理

### 9.1 画面の状態遷移

```
[/users ページにアクセス]
  ↓
  Loading（読み込み中）
    → エラー → エラーメッセージ表示
    → 成功 → ユーザー一覧表示
      → 検索フィールドにテキスト入力
        → 300ms debounce
          → フィルタリング実行
            → 結果あり → フィルタリング結果表示
            → 結果なし → 「該当するユーザーが見つかりません」表示
      → 検索フィールドをクリア
        → 全件表示に戻る
      → ユーザーカードをクリック
        → /users/[id] ページへ遷移
```

### 9.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `users` | `useUserSearch()` | 全ユーザーデータ（API取得結果） |
| `loading` | `useUserSearch()` | ユーザー一覧読み込み中フラグ |
| `error` | `useUserSearch()` | ユーザー一覧取得エラー |
| `searchParams.query` | `useUserSearch()` | 現在の検索入力値 |
| `debouncedQuery` | `useUserSearch()` | debounce後の検索クエリ |
| `searchResult` | `useUserSearch()`（`useMemo`） | フィルタリング結果（派生状態） |

### 9.3 データフロー図

```
[UserSearchInput]
  ↓ onChange(query)
[useUserSearch: setQuery()]
  ↓ 300ms debounce
[useUserSearch: debouncedQuery更新]
  ↓ useMemo
[useUserSearch: searchResult更新]
  ↓ props
[UserList]
  ↓ user.map
[UserCard] × N
```

## 10. ファイル変更一覧

### 10.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/hooks/useUserSearch.ts` | Hook | ユーザー検索ロジック（一覧取得・debounce・フィルタリング） |
| `src/components/UserSearchInput.tsx` | コンポーネント | 検索入力フィールドUI |
| `src/components/UserSearchInput.module.css` | スタイル | 検索入力フィールドのスタイル |
| `src/components/UserList.tsx` | コンポーネント | ユーザー一覧表示（0件メッセージ含む） |
| `src/components/UserList.module.css` | スタイル | ユーザー一覧のスタイル |
| `app/users/page.tsx` | ページ | ユーザー一覧 + 検索ページ |
| `app/api/users/route.ts` | API Route | ユーザー一覧取得のRoute Handler（モック） |
| `src/hooks/__tests__/useUserSearch.test.ts` | テスト | useUserSearchのユニットテスト |
| `src/components/__tests__/UserSearchInput.test.tsx` | テスト | UserSearchInputのユニットテスト |
| `src/components/__tests__/UserList.test.tsx` | テスト | UserListのユニットテスト |

### 10.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `SearchParams`、`UserSearchResult` 型の追加 |
| `src/api/client.ts` | `getUsers()` 関数の追加 |

### 10.3 変更なし

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

## 11. 実装上の注意事項

### 11.1 debounce処理

- `useEffect` + `setTimeout` で300msのdebounceを実装する
- 外部ライブラリ（lodash等）は使用せず、自前のdebounceとする
- コンポーネントのアンマウント時はクリーンアップ関数でタイマーをクリアする

### 11.2 既存hookとの整合性

- `useUserSearch` は `useUser` と同じパターン（`useState` + `useEffect` + `loading` / `error`）で実装する
- ユーザー一覧取得には新規追加の `getUsers()` API関数を使用し、既存の `getUser()` には影響しない
- 将来的にサーバーサイド検索に移行する場合も、hookのインターフェース（`query` / `setQuery` / `searchResult`）は変更不要となるよう設計する

### 11.3 モックデータの取り扱い

- Route Handler（`app/api/users/route.ts`）ではインメモリのモックデータを返す
- 日本語名・英語名を含むテストデータを用意し、部分一致検索の動作確認を容易にする
- モックデータを使用していることをコード内コメントで明記する

### 11.4 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| ユーザー一覧取得失敗 | `エラーが発生しました: {error.message}` |
| 検索結果0件 | `該当するユーザーが見つかりません` |
| ユーザー未登録（フィルタなし0件） | `ユーザーが登録されていません` |

### 11.5 パフォーマンス考慮

- フィルタリング結果は `useMemo` で計算し、不要な再計算を防ぐ
- `setQuery` は `useCallback` でメモ化する
- 大量のユーザーデータ（1000件以上）を想定する場合は、将来的にサーバーサイド検索への移行を検討する（本Issueのスコープ外）

### 11.6 アクセシビリティ

- 検索入力フィールドに `aria-label="ユーザー検索"` を付与する
- 検索結果0件時のメッセージに `role="status"` を付与し、スクリーンリーダーに通知する

## 12. テスト方針

### 12.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserSearch` | `src/hooks/__tests__/useUserSearch.test.ts` | ユーザー一覧取得 / フィルタリング / debounce / 0件時の動作 / エラーハンドリング |
| `UserSearchInput` | `src/components/__tests__/UserSearchInput.test.tsx` | 入力フィールド表示 / テキスト入力 / onChange呼び出し |
| `UserList` | `src/components/__tests__/UserList.test.tsx` | ユーザーカード一覧表示 / 0件メッセージ表示 / クリックイベント |

### 12.2 テストケース詳細

#### `useUserSearch.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | API呼び出しが行われ、ユーザー一覧が取得されること |
| 2 | ローディング状態 | 取得中は `loading: true` であること |
| 3 | 取得成功 | ユーザーデータが `searchResult.users` に正しくセットされること |
| 4 | 取得エラー | エラーが `error` にセットされること |
| 5 | 名前による検索 | 名前の部分一致でフィルタリングされること |
| 6 | メールアドレスによる検索 | メールアドレスの部分一致でフィルタリングされること |
| 7 | 大文字・小文字の区別なし | 大文字・小文字を区別せずに検索できること |
| 8 | 検索結果0件 | フィルタリング結果が空配列で、`isFiltered: true` であること |
| 9 | 空文字で全件表示 | クエリが空の場合、全ユーザーが返され `isFiltered: false` であること |
| 10 | debounce動作 | 入力から300ms後にフィルタリングが実行されること |

#### `UserSearchInput.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 検索入力フィールドが表示されること |
| 2 | プレースホルダー表示 | 「名前またはメールアドレスで検索」が表示されること |
| 3 | テキスト入力 | 入力時に `onChange` が呼ばれること |
| 4 | 値の反映 | `value` propsが入力フィールドに反映されること |

#### `UserList.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ユーザー一覧表示 | 渡されたユーザーがUserCardで表示されること |
| 2 | フィルタリング結果0件 | `isFiltered: true` かつユーザー0件時に「該当するユーザーが見つかりません」が表示されること |
| 3 | ユーザー未登録 | `isFiltered: false` かつユーザー0件時に「ユーザーが登録されていません」が表示されること |
| 4 | ユーザーカードクリック | クリック時に `onUserClick` が呼ばれること |

### 12.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-114/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧の初期表示 | `user-list-initial.png` |
| 2 | 名前で検索した結果 | `user-search-by-name.png` |
| 3 | メールアドレスで検索した結果 | `user-search-by-email.png` |
| 4 | 検索結果0件の表示 | `user-search-no-results.png` |
| 5 | 検索クリア後の全件表示 | `user-search-cleared.png` |

## 13. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/api/client.ts` | APIクライアント | 変更 | 順序1 |
| 3 | `app/api/users/route.ts` | API Route | 新規 | 順序1 |
| 4 | `src/hooks/useUserSearch.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/UserSearchInput.tsx` + CSS | コンポーネント | 新規 | なし |
| 6 | `src/components/UserList.tsx` + CSS | コンポーネント | 新規 | なし |
| 7 | `app/users/page.tsx` | ページ | 新規 | 順序4, 5, 6 |
| 8 | テスト追加 | テスト | 新規 | 順序1-7 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5 と 順序6 は互いに独立しているため並列実装可能

## 14. 依存関係図

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
