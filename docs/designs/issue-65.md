# 設計書: Issue #65 ユーザー検索機能の追加

## 1. 概要

ユーザー一覧ページを新規作成し、名前・メールアドレスによるユーザー検索機能を追加する。

- ユーザー一覧ページ (`app/users/page.tsx`) の新規作成
- 検索入力フィールドによる名前・メールアドレスの部分一致検索
- リアルタイムフィルタリング（debounce 300ms 付き）
- 検索結果が0件の場合の適切なメッセージ表示
- カスタムhook (`useUserSearch`) での検索ロジック分離

### 1.1 背景

現在のアプリケーションにはユーザー詳細ページ (`app/users/[id]/page.tsx`) は存在するが、ユーザー一覧ページが存在しない。ユーザーを検索して一覧から選択できる機能を追加することで、ユーザー間のナビゲーションを改善する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— ユーザー一覧ページ、検索UI、API Route Handler（モックデータ）、型定義、Hook
- **対象外**: サーバーサイド検索（フィルタリングはクライアントサイドで実施）
- **API方式**: Route Handler（GET）、モックデータで実装
- **検索方式**: クライアントサイドフィルタリング

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | ユーザー一覧ページ | 本Issueのスコープに含める（`app/users/page.tsx` を新規作成） |
| 2 | API方式 | `getUsers()` APIを新規作成、クライアントサイドでフィルタリング |
| 3 | debounce待機時間 | 300ms（クライアントサイドフィルタリングのため） |
| 4 | モックデータ件数 | 10件 |
| 5 | 検索結果0件メッセージ | 「該当するユーザーが見つかりませんでした」 |
| 6 | `useUser` hookとの整合性 | (A) 返却値の形式を揃える（`{ data, loading, error }` パターンの踏襲） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（`SearchParams` 型追加） |
| **APIクライアント** | `src/api/client.ts` | `getUser(id)` のみ | ⚠️ 変更（`getUsers()` 追加） |
| **Hook** | `src/hooks/useUser.ts` | 単一ユーザー取得のみ | ✅ 変更なし |
| **ユーザー詳細ページ** | `app/users/[id]/page.tsx` | 閲覧のみ | ✅ 変更なし |

### 2.2 既存のAPIクライアントパターン

```typescript
// src/api/client.ts（現在のパターン）
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getUser(id: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch user: ${res.status}`);
  return res.json();
}
```

### 2.3 既存のHookパターン

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

## 3. 機能設計

### 3.1 ユーザー一覧 + 検索画面

#### UI構成

```
┌──────────────────────────────────────────┐
│  ユーザー一覧                             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 名前またはメールアドレスで検索    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 👤 山田太郎                        │  │
│  │    taro@example.com               │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 👤 佐藤花子                        │  │
│  │    hanako@example.com             │  │
│  └────────────────────────────────────┘  │
│  ...                                     │
│                                          │
│  ※ 検索結果0件の場合:                    │
│  「該当するユーザーが見つかりませんでした」 │
└──────────────────────────────────────────┘
```

#### ユーザー操作フロー

```
[/users ページにアクセス]
  ↓
[API: GET /api/users でユーザー一覧を取得]
  ↓
[ユーザー一覧を表示]
  ↓
[検索フィールドにテキストを入力]
  ↓
[300ms debounce後にクライアントサイドでフィルタリング]
  ↓
[フィルタリング結果を表示]
  ↓ （結果0件の場合）
[「該当するユーザーが見つかりませんでした」を表示]
  ↓ （ユーザーをクリック）
[/users/[id] ページへ遷移]
```

### 3.2 検索仕様

| 項目 | 仕様 |
|------|------|
| 検索対象フィールド | `name`（名前）、`email`（メールアドレス） |
| 検索方式 | 部分一致（大文字小文字を区別しない） |
| debounce | 300ms |
| 検索結果0件メッセージ | 「該当するユーザーが見つかりませんでした」 |
| 検索フィールドクリア | 入力を空にすると全件表示に戻る |

## 4. 型定義

### 4.1 変更ファイル: `src/types/user.ts`

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

## 5. API設計

### 5.1 Route Handler（モックデータ）

#### GET `/api/users`

ユーザー一覧を取得する。

**レスポンス**:
```json
[
  {
    "id": "1",
    "name": "山田太郎",
    "email": "taro@example.com",
    "avatarUrl": null,
    "createdAt": "2024-01-15T09:00:00.000Z"
  },
  {
    "id": "2",
    "name": "佐藤花子",
    "email": "hanako@example.com",
    "avatarUrl": null,
    "createdAt": "2024-02-20T10:30:00.000Z"
  }
]
```

| ステータス | 説明 |
|-----------|------|
| 200 | 一覧取得成功 |
| 500 | サーバーエラー |

### 5.2 Route Handler 実装ファイル

```
app/api/users/route.ts ← 新規
```

```typescript
import { NextResponse } from 'next/server';
import { User } from '../../../src/types/user';

// モックデータ（10件）
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

### 5.3 APIクライアント

`src/api/client.ts` に以下の関数を追加する。

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

## 6. Hook設計

### 6.1 新規Hook: `useUserSearch`

```
src/hooks/useUserSearch.ts ← 新規
```

**責務**: ユーザー一覧の取得、検索クエリによるクライアントサイドフィルタリング、debounce処理をカプセル化

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

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `users` | `User[]` | フィルタリング済みユーザー一覧 |
| `allUsers` | `User[]` | 全ユーザー一覧（フィルタリング前） |
| `loading` | `boolean` | 読み込み中フラグ |
| `error` | `Error \| null` | エラー情報 |
| `query` | `string` | 現在の検索クエリ |
| `setQuery` | `(query: string) => void` | 検索クエリ更新関数 |

### 6.2 既存Hookとの整合性

`useUserSearch` は既存の `useUser` / `useUserProfile` / `useNotificationSettings` hookと同様のパターンを踏襲する。

| パターン | useUser | useUserSearch |
|---------|---------|--------------|
| データ返却 | `user` | `users` (filteredUsers) |
| ローディング | `loading` | `loading` |
| エラー | `error` | `error` |
| データ取得 | `useEffect` + API呼び出し | `useEffect` + API呼び出し |

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `UserSearchForm`

```
src/components/UserSearchForm.tsx        ← 新規
src/components/UserSearchForm.module.css ← 新規
```

**責務**: 検索入力フィールドのUI

**Props**:
```typescript
interface UserSearchFormProps {
  query: string;
  onQueryChange: (query: string) => void;
}
```

**UIコンポーネント構成**:

```
<div class="searchContainer">
  <input
    type="text"
    placeholder="名前またはメールアドレスで検索"
    value={query}
    onChange={(e) => onQueryChange(e.target.value)}
    class="searchInput"
  />
</div>
```

### 7.2 新規コンポーネント: `UserList`

```
src/components/UserList.tsx        ← 新規
src/components/UserList.module.css ← 新規
```

**責務**: ユーザー一覧の表示、検索結果0件時のメッセージ表示

**Props**:
```typescript
interface UserListProps {
  users: User[];
  isSearching: boolean;  // 検索クエリが入力されているか
}
```

**UIコンポーネント構成**:

```
<div class="listContainer">
  {users.length === 0 && isSearching ? (
    <p class="emptyMessage">該当するユーザーが見つかりませんでした</p>
  ) : (
    <ul class="userList">
      {users.map((user) => (
        <li key={user.id} class="userItem">
          <Link href={`/users/${user.id}`}>
            <div class="userName">{user.name}</div>
            <div class="userEmail">{user.email}</div>
          </Link>
        </li>
      ))}
    </ul>
  )}
</div>
```

### 7.3 CSSモジュール

#### `UserSearchForm.module.css`

| クラス名 | 説明 |
|---------|------|
| `.searchContainer` | 検索フォーム全体のコンテナ |
| `.searchInput` | 検索入力フィールド |

#### `UserList.module.css`

| クラス名 | 説明 |
|---------|------|
| `.listContainer` | 一覧全体のコンテナ |
| `.userList` | ユーザーリスト（ul要素） |
| `.userItem` | 各ユーザー項目（li要素） |
| `.userName` | ユーザー名 |
| `.userEmail` | メールアドレス |
| `.emptyMessage` | 検索結果0件メッセージ |

## 8. ページコンポーネント設計

### 8.1 新規ページ: `app/users/page.tsx`

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

## 9. 状態管理

### 9.1 画面の状態遷移

```
[/users ページにアクセス]
  Loading（読み込み中）
    → エラー → エラーメッセージ表示
    → 成功 → ユーザー一覧表示
      → 検索フィールドに入力
        → 300ms debounce
          → フィルタリング結果表示
            → 結果あり → フィルタリングされた一覧表示
            → 結果0件 → 「該当するユーザーが見つかりませんでした」表示
      → ユーザーをクリック → /users/[id] へ遷移
```

### 9.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `users` | `useUserSearch()` | 全ユーザーデータ |
| `loading` | `useUserSearch()` | 一覧取得中フラグ |
| `error` | `useUserSearch()` | 一覧取得エラー |
| `query` | `useUserSearch()` | 検索入力値 |
| `debouncedQuery` | `useUserSearch()` 内部 | debounce後の検索クエリ |
| `filteredUsers` | `useUserSearch()` 内部（useMemo） | フィルタリング後のユーザー一覧 |

## 10. ファイル変更一覧

### 10.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/user.ts` への追加 | 型定義 | `SearchParams` 型の追加 |
| `app/api/users/route.ts` | API Route | ユーザー一覧取得のRoute Handler（モック） |
| `src/hooks/useUserSearch.ts` | Hook | ユーザー検索ロジック（取得・フィルタリング・debounce） |
| `src/components/UserSearchForm.tsx` | コンポーネント | 検索入力フィールドUI |
| `src/components/UserSearchForm.module.css` | スタイル | 検索フォームのスタイル |
| `src/components/UserList.tsx` | コンポーネント | ユーザー一覧表示UI |
| `src/components/UserList.module.css` | スタイル | ユーザー一覧のスタイル |
| `app/users/page.tsx` | ページ | ユーザー一覧・検索ページ |
| `src/hooks/__tests__/useUserSearch.test.ts` | テスト | useUserSearchのユニットテスト |
| `src/components/__tests__/UserSearchForm.test.tsx` | テスト | UserSearchFormのユニットテスト |
| `src/components/__tests__/UserList.test.tsx` | テスト | UserListのユニットテスト |
| `app/users/__tests__/page.test.tsx` | テスト | ユーザー一覧ページの結合テスト |

### 10.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `SearchParams` 型の追加 |
| `src/api/client.ts` | `getUsers()` 関数の追加 |

### 10.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/hooks/useUser.ts` | 単一ユーザー取得の責務は変更なし |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | ユーザー詳細ページは変更不要 |
| `app/layout.tsx` | ナビゲーション変更はスコープ外 |

## 11. 実装上の注意事項

### 11.1 debounce実装

- `useDebounce` カスタムhookを `useUserSearch` 内に実装する
- debounce待機時間は300msとする
- 検索入力が空の場合は全件表示に戻る（debounce不要）

### 11.2 モックデータの取り扱い

- Route Handler ではインメモリ配列にデータを保持する
- 実際のDB連携は後続Issueで対応
- モックデータを使用していることをコード内コメントで明記する

### 11.3 クライアントサイドフィルタリング

- `useMemo` を使用してフィルタリング結果をメモ化する
- 大文字小文字を区別しない検索（`toLowerCase()` を使用）
- `name` と `email` の両方を検索対象とする（OR条件）

### 11.4 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| 一覧取得失敗 | `エラーが発生しました: {error.message}` |
| 検索結果0件 | `該当するユーザーが見つかりませんでした` |

### 11.5 アクセシビリティ

- 検索入力フィールドに適切な `placeholder` を設定
- ユーザー一覧項目はリンク（`<a>` タグ）で実装し、キーボードナビゲーションに対応

## 12. テスト方針

### 12.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserSearch` | `src/hooks/__tests__/useUserSearch.test.ts` | 一覧取得 / フィルタリング / debounce / エラーハンドリング |
| `UserSearchForm` | `src/components/__tests__/UserSearchForm.test.tsx` | 入力フィールド表示 / 入力値変更コールバック |
| `UserList` | `src/components/__tests__/UserList.test.tsx` | ユーザー一覧表示 / 0件メッセージ表示 / リンク遷移先 |
| ユーザー一覧ページ | `app/users/__tests__/page.test.tsx` | ページ全体の結合テスト |

### 12.2 テストケース詳細

#### `useUserSearch.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | API呼び出しが行われ、ユーザー一覧が取得されること |
| 2 | ローディング状態 | 取得中は `loading: true` であること |
| 3 | 取得成功 | ユーザーデータが正しくセットされること |
| 4 | 取得エラー | エラーが `error` にセットされること |
| 5 | 名前で検索 | 名前の部分一致でフィルタリングされること |
| 6 | メールアドレスで検索 | メールアドレスの部分一致でフィルタリングされること |
| 7 | 大文字小文字の区別なし | 大文字小文字を区別せずに検索できること |
| 8 | 検索クエリクリア | クエリを空にすると全件表示に戻ること |
| 9 | debounce動作 | 入力後300ms経過するまでフィルタリングが実行されないこと |

#### `UserSearchForm.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 検索入力フィールドが表示されること |
| 2 | プレースホルダー | 「名前またはメールアドレスで検索」が表示されること |
| 3 | 入力変更 | テキスト入力時に `onQueryChange` が呼ばれること |

#### `UserList.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ユーザー一覧表示 | 渡されたユーザーが一覧表示されること |
| 2 | ユーザー名とメールの表示 | 名前とメールアドレスが表示されること |
| 3 | ユーザー詳細へのリンク | 各ユーザーが `/users/[id]` へのリンクを持つこと |
| 4 | 検索結果0件（検索中） | `isSearching=true` で0件の場合にメッセージが表示されること |
| 5 | 初期状態0件 | `isSearching=false` で0件の場合にメッセージが表示されないこと |

#### `app/users/__tests__/page.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ページ表示 | ユーザー一覧ページが正しく表示されること |
| 2 | ローディング表示 | 読み込み中に「読み込み中...」が表示されること |
| 3 | エラー表示 | エラー時にエラーメッセージが表示されること |
| 4 | 検索機能 | 検索フィールドに入力するとフィルタリングされること |

### 12.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-65/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧の初期表示 | `user-list-initial.png` |
| 2 | 名前で検索した結果 | `user-search-by-name.png` |
| 3 | メールアドレスで検索した結果 | `user-search-by-email.png` |
| 4 | 検索結果0件 | `user-search-no-results.png` |
| 5 | ユーザー詳細への遷移 | `user-list-to-detail.png` |

## 13. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/api/client.ts` | APIクライアント | 変更 | 順序1 |
| 3 | `app/api/users/route.ts` | API Route | 新規 | 順序1 |
| 4 | `src/hooks/useUserSearch.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/UserSearchForm.tsx` + CSS | コンポーネント | 新規 | なし |
| 6 | `src/components/UserList.tsx` + CSS | コンポーネント | 新規 | 順序1 |
| 7 | `app/users/page.tsx` | ページ | 新規 | 順序4, 5, 6 |
| 8 | テスト追加 | テスト | 新規 | 順序1-7 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5 と 順序6 は互いに独立しているため並列実装可能

## 14. 依存関係図

```
src/types/user.ts（変更: SearchParams型追加）
  ├─→ src/api/client.ts（変更: getUsers()追加）
  │     ↓
  │   src/hooks/useUserSearch.ts（新規: 検索Hook）
  │     ↓
  ├─→ src/components/UserSearchForm.tsx + CSS（新規: 検索フォーム）
  │     ↓
  ├─→ src/components/UserList.tsx + CSS（新規: ユーザー一覧）
  │     ↓
  │   app/users/page.tsx（新規: 一覧ページ）
  │
  └─→ app/api/users/route.ts（新規: Route Handler）
```
