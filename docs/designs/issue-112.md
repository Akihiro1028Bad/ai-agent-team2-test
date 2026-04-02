# 設計書: Issue #112 ユーザー検索機能の追加

## 1. 概要

ユーザー一覧ページに検索機能を追加し、名前またはメールアドレスの部分一致でユーザーをリアルタイムにフィルタリングできるようにする。

- 検索入力フィールドをユーザー一覧ページに追加
- 名前またはメールアドレスの部分一致で検索
- debounce付きリアルタイムフィルタリング
- 検索結果が0件の場合は適切なメッセージを表示
- カスタムhook（`useUserSearch`）で検索ロジックを分離

### 1.1 背景

現在のアプリケーションにはユーザー一覧の表示機能（`UserCard` コンポーネント）が存在するが、ユーザーを検索・絞り込みする手段がない。ユーザー数が増加した際にも目的のユーザーを素早く見つけられるよう、検索機能を追加する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— 検索UIコンポーネント、カスタムhook、型定義
- **対象外**: バックエンド側の検索API（フロントエンドでのクライアントサイドフィルタリングで実装）
- **フィルタリング方式**: クライアントサイドでの部分一致検索（既存の `getUser` / ユーザー一覧取得APIから取得済みのデータに対してフィルタリング）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | Issue種別 | feature-m（変更ファイル数10ファイル以内） |
| 2 | 検索対象 | 名前（name）、メールアドレス（email） |
| 3 | 検索方式 | 部分一致（大文字小文字を区別しない） |
| 4 | フィルタリング | クライアントサイド、debounce付きリアルタイム |
| 5 | 検索ロジック | カスタムhook（useUserSearch）に分離 |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（`SearchParams` 型追加） |
| **APIクライアント** | `src/api/client.ts` | `getUser` / `getUserProfile` 等あり | ✅ 変更なし |
| **Hook** | `src/hooks/useUser.ts` | 単一ユーザー取得のみ | ✅ 変更なし（新規hookで対応） |
| **コンポーネント** | `src/components/UserCard.tsx` | ユーザーカード表示済み | ✅ 変更なし |

### 2.2 既存のHookパターン

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

### 2.3 既存の型定義

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

## 3. 機能設計

### 3.1 ユーザー検索画面

#### UI構成

```
┌──────────────────────────────────────────┐
│  ユーザー検索                             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 名前またはメールアドレスで検索   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  検索結果: 3件                            │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [UserCard] ユーザー1               │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ [UserCard] ユーザー2               │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ [UserCard] ユーザー3               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ※ 検索結果0件の場合:                     │
│  「該当するユーザーが見つかりませんでした」 │
└──────────────────────────────────────────┘
```

#### ユーザー操作フロー

```
[ユーザー一覧ページにアクセス]
  ↓
[ユーザー一覧を取得・表示]
  ↓
[検索フィールドに文字を入力]
  ↓
[debounce（300ms）後にフィルタリング実行]
  ↓
[名前 or メールアドレスの部分一致でフィルタリング]
  ↓
[検索結果を表示]
  → 1件以上: フィルタリングされたユーザーカードを表示
  → 0件: 「該当するユーザーが見つかりませんでした」を表示
```

### 3.2 検索仕様

| 項目 | 仕様 |
|------|------|
| 検索対象フィールド | `name`（名前）、`email`（メールアドレス） |
| 検索方式 | 部分一致（`includes`） |
| 大文字小文字 | 区別しない（`toLowerCase()` で正規化） |
| debounce時間 | 300ms |
| 空文字の場合 | 全ユーザーを表示（フィルタリングなし） |
| 結果件数表示 | 検索クエリが入力されている場合に表示 |

## 4. 型定義

### 4.1 `src/types/user.ts` への追加

```typescript
// 既存の User / UserProfile は変更なし

// 新規追加

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

## 5. Hook設計

### 5.1 新規Hook: `useUserSearch`

```
src/hooks/useUserSearch.ts ← 新規
```

**責務**: ユーザー一覧の取得、検索クエリのdebounce処理、フィルタリングロジックをカプセル化

```typescript
import { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../types/user';
import { getUsers } from '../api/client';

/**
 * debounce用のカスタムhook
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

**引数**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `users` | `User[]` | フィルタリング対象のユーザー一覧 |

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `query` | `string` | 現在の検索クエリ（入力値） |
| `filteredUsers` | `User[]` | フィルタリングされたユーザー一覧 |
| `totalCount` | `number` | フィルタリング結果の件数 |
| `isSearching` | `boolean` | debounce待機中フラグ |
| `handleSearch` | `(query: string) => void` | 検索クエリ更新関数 |

### 5.2 設計判断: `useDebounce` の内部実装

debounceロジックは `useUserSearch` と密結合であり、現時点では他のhookから再利用する必要がないため、`useUserSearch.ts` 内にプライベート関数として定義する。将来的に再利用ニーズが発生した場合は `src/hooks/useDebounce.ts` として切り出す。

### 5.3 既存hookとの整合性

| Hook | 責務 | 関係 |
|------|------|------|
| `useUser` | 単一ユーザーの取得 | 変更なし。`useUserSearch` とは独立 |
| `useUserProfile` | プロフィールの取得・更新 | 変更なし。`useUserSearch` とは独立 |
| `useUserSearch` | ユーザー一覧のフィルタリング | 新規。`User[]` を受け取りフィルタリングする |

`useUserSearch` は `User[]` を引数として受け取る設計とし、データ取得の責務は呼び出し側に委ねる。これにより、既存の `useUser` hookとの結合を避け、単一責任の原則を維持する。

## 6. コンポーネント設計

### 6.1 新規コンポーネント: `UserSearchInput`

```
src/components/UserSearchInput.tsx        ← 新規
src/components/UserSearchInput.module.css ← 新規
```

**責務**: 検索入力フィールドのUIを管理

**Props**:
```typescript
interface UserSearchInputProps {
  value: string;
  onChange: (query: string) => void;
  resultCount?: number;
  isSearching?: boolean;
}
```

**UIコンポーネント構成**:

```
<div class="searchContainer">
  <div class="inputWrapper">
    <span class="searchIcon">🔍</span>
    <input
      type="text"
      class="searchInput"
      placeholder="名前またはメールアドレスで検索"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="ユーザー検索"
    />
    {value && (
      <button class="clearButton" onClick={() => onChange('')}>
        ✕
      </button>
    )}
  </div>
  {value && (
    <p class="resultCount">
      {isSearching ? '検索中...' : `検索結果: ${resultCount}件`}
    </p>
  )}
</div>
```

### 6.2 CSSモジュール: `UserSearchInput.module.css`

既存の `ProfileEditForm.module.css` のスタイルパターンに合わせ、以下のクラスを定義する。

| クラス名 | 説明 |
|---------|------|
| `.searchContainer` | 検索エリア全体のコンテナ |
| `.inputWrapper` | 入力フィールドとアイコンのラッパー |
| `.searchIcon` | 検索アイコン |
| `.searchInput` | 検索入力フィールド |
| `.clearButton` | クリアボタン |
| `.resultCount` | 検索結果件数の表示 |
| `.noResults` | 検索結果0件のメッセージ |

レスポンシブ対応:
- モバイル（`max-width: 768px`）: 入力フィールドは幅100%
- デスクトップ: `max-width: 480px`

### 6.3 新規コンポーネント: `UserSearchResults`

```
src/components/UserSearchResults.tsx ← 新規
```

**責務**: 検索結果（ユーザーカード一覧）の表示と0件時メッセージの管理

**Props**:
```typescript
interface UserSearchResultsProps {
  users: User[];
  query: string;
}
```

**UIコンポーネント構成**:

```
<div class="resultsContainer">
  {users.length > 0 ? (
    users.map((user) => (
      <UserCard key={user.id} user={user} />
    ))
  ) : query ? (
    <p class="noResults">該当するユーザーが見つかりませんでした</p>
  ) : null}
</div>
```

## 7. ページコンポーネント設計

### 7.1 新規ページ: `app/users/page.tsx`

ユーザー一覧ページを新規作成し、検索機能を統合する。

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

## 8. 状態管理

### 8.1 画面の状態遷移

```
[ユーザー一覧ページにアクセス]
  ↓
[Loading（読み込み中）]
  → エラー → エラーメッセージ表示
  → 成功 → ユーザー一覧表示
    → 検索フィールドに入力
      → debounce待機中（isSearching: true）
        → debounce完了 → フィルタリング実行
          → 1件以上: フィルタリング結果表示
          → 0件: 「該当するユーザーが見つかりませんでした」表示
    → 検索フィールドをクリア
      → 全ユーザー表示に戻る
```

### 8.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `users` | `UsersPage` | 全ユーザー一覧（API取得データ） |
| `loading` | `UsersPage` | ユーザー一覧取得中フラグ |
| `error` | `UsersPage` | ユーザー一覧取得エラー |
| `query` | `useUserSearch` | 検索入力値（即時反映） |
| `debouncedQuery` | `useUserSearch`（内部） | debounce後の検索クエリ |
| `filteredUsers` | `useUserSearch` | フィルタリング結果 |
| `totalCount` | `useUserSearch` | フィルタリング結果件数 |
| `isSearching` | `useUserSearch` | debounce待機中フラグ |

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/hooks/useUserSearch.ts` | Hook | ユーザー検索ロジック（debounce + フィルタリング） |
| `src/components/UserSearchInput.tsx` | コンポーネント | 検索入力フィールドUI |
| `src/components/UserSearchInput.module.css` | スタイル | 検索入力フィールドのスタイル |
| `src/components/UserSearchResults.tsx` | コンポーネント | 検索結果表示（0件メッセージ含む） |
| `app/users/page.tsx` | ページ | ユーザー一覧・検索ページ |
| `src/hooks/__tests__/useUserSearch.test.ts` | テスト | useUserSearchのユニットテスト |
| `src/components/__tests__/UserSearchInput.test.tsx` | テスト | UserSearchInputのユニットテスト |

### 9.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `SearchParams`、`UserSearchResult` 型の追加 |

### 9.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/api/client.ts` | クライアントサイドフィルタリングのためAPI追加不要 |
| `src/hooks/useUser.ts` | 単一ユーザー取得用。検索hookとは独立 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserCard.tsx` | 変更なし。検索結果の各行の表示に既存のまま利用 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `app/profile/page.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | スコープ外 |
| `app/layout.tsx` | スコープ外 |

## 10. 実装上の注意事項

### 10.1 debounceの実装

- `useDebounce` hookを `useUserSearch.ts` 内に実装する
- debounce時間は300msとし、ユーザーの入力体験と不要な再計算のバランスを取る
- `useEffect` のクリーンアップで `clearTimeout` を確実に実行し、メモリリークを防止する

### 10.2 検索パフォーマンス

- `useMemo` を使用してフィルタリング結果をメモ化し、不要な再計算を防ぐ
- `useCallback` を使用して `handleSearch` 関数の参照安定性を保つ
- ユーザー数が大規模（1000件以上）になった場合は、サーバーサイド検索APIへの移行を検討（本Issueのスコープ外）

### 10.3 アクセシビリティ

- 検索入力フィールドに `aria-label="ユーザー検索"` を設定
- 検索結果件数を `aria-live="polite"` で通知
- クリアボタンに `aria-label="検索をクリア"` を設定

### 10.4 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| ユーザー一覧取得失敗 | `エラーが発生しました: {error.message}` |
| 検索結果0件 | `該当するユーザーが見つかりませんでした` |

### 10.5 レスポンシブ対応

- CSSモジュールの `@media (max-width: 768px)` でモバイル対応
- 検索入力フィールドは幅100%（モバイル）/ `max-width: 480px`（デスクトップ）
- ユーザーカード一覧は1カラムレイアウト

## 11. テスト方針

### 11.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserSearch` | `src/hooks/__tests__/useUserSearch.test.ts` | フィルタリング / debounce / 空クエリ / 大文字小文字 |
| `UserSearchInput` | `src/components/__tests__/UserSearchInput.test.tsx` | 入力フィールド表示 / onChange呼び出し / クリアボタン / 結果件数表示 |

### 11.2 テストケース詳細

#### `useUserSearch.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期状態 | クエリが空の場合、全ユーザーが返されること |
| 2 | 名前で検索 | 名前の部分一致でフィルタリングされること |
| 3 | メールアドレスで検索 | メールアドレスの部分一致でフィルタリングされること |
| 4 | 大文字小文字を区別しない | 大文字・小文字に関わらず検索結果が返されること |
| 5 | 検索結果0件 | 該当ユーザーがいない場合、空配列が返されること |
| 6 | debounce動作 | 入力後300ms経過後にフィルタリングが実行されること |
| 7 | totalCount | フィルタリング結果の件数が正しく返されること |
| 8 | クエリクリア | クエリを空にした場合、全ユーザーに戻ること |

#### `UserSearchInput.test.tsx`

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

### 11.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-112/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧の初期表示 | `user-list-initial.png` |
| 2 | 名前で検索した結果 | `user-search-by-name.png` |
| 3 | メールアドレスで検索した結果 | `user-search-by-email.png` |
| 4 | 検索結果0件 | `user-search-no-results.png` |
| 5 | 検索クリア後の表示 | `user-search-cleared.png` |
| 6 | モバイル表示 | `user-search-mobile.png` |

## 12. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/hooks/useUserSearch.ts` | Hook | 新規 | 順序1 |
| 3 | `src/components/UserSearchInput.tsx` + CSS | コンポーネント | 新規 | なし |
| 4 | `src/components/UserSearchResults.tsx` | コンポーネント | 新規 | なし |
| 5 | `app/users/page.tsx` | ページ | 新規 | 順序2, 3, 4 |
| 6 | テスト追加 | テスト | 新規 | 順序1-5 |

**並列実装可能なグループ**:
- 順序2、順序3、順序4 は互いに独立しているため並列実装可能

## 13. 依存関係図

```
src/types/user.ts（変更: SearchParams / UserSearchResult 型追加）
  │
  └─→ src/hooks/useUserSearch.ts（新規: 検索ロジック + debounce）
        ↓
      app/users/page.tsx（新規: ユーザー一覧・検索ページ）
        ├─ src/components/UserSearchInput.tsx + CSS（新規: 検索入力UI）
        └─ src/components/UserSearchResults.tsx（新規: 検索結果表示）
              └─ src/components/UserCard.tsx（既存: 変更なし）
```
