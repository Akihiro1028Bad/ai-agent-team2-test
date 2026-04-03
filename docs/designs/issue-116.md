# 設計書: Issue #116 ユーザー検索機能の追加

## 1. 概要

ユーザー一覧ページを新規作成し、ユーザー名・メールアドレスによるリアルタイム検索機能を実装する。

- ユーザー名・メールアドレスのOR検索（デバウンス 300ms）
- 空文字で全件表示
- 検索結果0件時の「該当するユーザーが見つかりません」メッセージ表示
- 検索中のローディング表示
- サーバーサイド検索 API (`GET /api/users?q=検索語`)

### 1.1 背景

現在のアプリケーションには個別ユーザー詳細ページ (`app/users/[id]/page.tsx`) は存在するが、ユーザー一覧・検索機能が存在しない。ユーザーを一覧表示し、ユーザー名またはメールアドレスでリアルタイムに絞り込めるページを追加する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— ユーザー一覧ページ、Route Handler（モックデータ）、型定義、Hook、コンポーネント
- **対象外**: 実際のデータベース連携（後続Issueで対応）
- **API方式**: Route Handler（GET）、モックデータで実装
- **認証**: スコープ外（後続Issueで対応）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | ユーザー一覧ページ | `app/users/page.tsx` として新規作成 |
| 2 | API方式 | Route Handler `GET /api/users?q=検索語`（サーバーサイド検索） |
| 3 | デバウンス | 300ms |
| 4 | 最低入力文字数 | なし（空文字で全件表示） |
| 5 | 検索対象 | ユーザー名・メールアドレスのOR検索（大文字小文字無視） |
| 6 | 0件表示 | 「該当するユーザーが見つかりません」 |
| 7 | ローディング表示 | 必要 |
| 8 | CSSモジュール | 既存の慣例（`.module.css`）に合わせる |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（`SearchParams` 追加） |
| **APIクライアント** | `src/api/client.ts` | ユーザー個別取得・更新の関数のみ | ⚠️ 変更（`searchUsers` 関数追加） |
| **Hook** | `src/hooks/useUserProfile.ts` | プロフィール取得・更新済み | ✅ 変更なし |
| **コンポーネント** | `src/components/UserCard.tsx` | ユーザーカード表示コンポーネント済み | ✅ 変更なし（一覧表示に流用） |

### 2.2 既存のAPIクライアントパターン

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

### 2.3 既存のHookパターン

```typescript
// src/hooks/useUserProfile.ts（現在のパターン）
export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { profile, loading, error, updateProfile };
}
```

### 2.4 既存の `UserCard` コンポーネント

`src/components/UserCard.tsx` はアバター・ユーザー名・メールアドレスを表示するカードコンポーネントとして既に実装されており、ユーザー一覧の各行として流用する。

## 3. 機能設計

### 3.1 ユーザー一覧・検索画面

#### UI構成

```
┌──────────────────────────────────────────┐
│  ユーザー一覧                             │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 ユーザー名またはメールアドレスで検索│  │
│  └────────────────────────────────────┘  │
│                                          │
│  ─── ローディング中: 「検索中...」 ──────  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ [Avatar] ユーザー名A               │  │
│  │          email-a@example.com       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ [Avatar] ユーザー名B               │  │
│  │          email-b@example.com       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ─── 0件時: 「該当するユーザーが        │  │
│              見つかりません」 ──────────  │
└──────────────────────────────────────────┘
```

#### ユーザー操作フロー

```
[app/users/page.tsx へアクセス]
  ↓
[API: GET /api/users?q= で全件取得]
  ↓
[ユーザー一覧を表示]
  ↓
[UserSearchBar に文字を入力]
  ↓
[300ms デバウンス後]
  ↓
[API: GET /api/users?q=入力文字 で検索]
  ↓
[ローディング表示 → 検索結果を表示]
  ↓（0件の場合）
[「該当するユーザーが見つかりません」を表示]
```

## 4. 型定義

### 4.1 変更ファイル: `src/types/user.ts`

既存の `User`・`UserProfile` インターフェースはそのまま維持し、`SearchParams` インターフェースを追加する。

```typescript
// 既存の定義はそのまま維持
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

// 追加: 検索パラメータ
export interface SearchParams {
  q: string; // 検索クエリ（ユーザー名またはメールアドレス）
}
```

**追加内容**:

| 型名 | 種別 | 説明 |
|------|------|------|
| `SearchParams` | `interface` | ユーザー検索クエリを保持する型。`q` フィールドに検索文字列を格納する |

## 5. API設計

### 5.1 Route Handler（モックデータ）

#### GET `/api/users?q=検索語`

ユーザー一覧を取得する。クエリパラメータ `q` が指定された場合、ユーザー名またはメールアドレスをOR検索（大文字小文字無視）してフィルタリングした結果を返す。`q` が空文字または未指定の場合は全件を返す。

**リクエスト**:

| パラメータ | 種別 | 必須 | 説明 |
|-----------|------|------|------|
| `q` | クエリパラメータ | いいえ | 検索文字列（空または未指定で全件返却） |

**レスポンス（200 OK）**:
```json
[
  {
    "id": "1",
    "name": "Alice",
    "email": "alice@example.com",
    "avatarUrl": null,
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "2",
    "name": "Bob",
    "email": "bob@example.com",
    "avatarUrl": null,
    "createdAt": "2024-01-02T00:00:00.000Z"
  }
]
```

**エラーレスポンス（500 Internal Server Error）**:
```json
{
  "error": "Internal Server Error"
}
```

| ステータス | 説明 |
|-----------|------|
| 200 | 取得成功（0件の場合も `[]` で200を返す） |
| 500 | サーバーエラー |

### 5.2 Route Handler 実装ファイル

```
app/api/users/route.ts ← 新規
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { User } from '../../../../src/types/user';

// モックデータ（インメモリ）
const mockUsers: User[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: '2', name: 'Bob', email: 'bob@example.com', createdAt: '2024-01-02T00:00:00.000Z' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', createdAt: '2024-01-03T00:00:00.000Z' },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  const filtered = q.trim() === ''
    ? mockUsers
    : mockUsers.filter(user =>
        user.name.toLowerCase().includes(q.toLowerCase()) ||
        user.email.toLowerCase().includes(q.toLowerCase())
      );

  return NextResponse.json(filtered);
}
```

### 5.3 APIクライアント関数の追加

変更ファイル: `src/api/client.ts`

既存の関数に続けて `searchUsers` 関数を追加する。

```typescript
import { User, UserProfile, SearchParams } from '../types/user';

// ... 既存の関数はそのまま維持 ...

/**
 * ユーザーを検索して一覧を取得する
 * @param params 検索パラメータ（q: 検索クエリ）
 */
export async function searchUsers(params: SearchParams): Promise<User[]> {
  const query = new URLSearchParams({ q: params.q });
  const res = await fetch(`${API_BASE}/users?${query}`);
  if (!res.ok) throw new Error(`Failed to search users: ${res.status}`);
  return res.json();
}
```

## 6. Hook設計

### 6.1 新規Hook: `useUserSearch`

```
src/hooks/useUserSearch.ts ← 新規
```

**責務**: 検索クエリの管理、デバウンス処理、APIの呼び出し、検索結果・ローディング・エラー状態のカプセル化

```typescript
import { useState, useEffect } from 'react';
import { User, SearchParams } from '../types/user';
import { searchUsers } from '../api/client';

export function useUserSearch() {
  const [query, setQuery] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      const params: SearchParams = { q: query };
      searchUsers(params)
        .then(setUsers)
        .catch(setError)
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return { query, setQuery, users, loading, error };
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `query` | `string` | 現在の検索クエリ |
| `setQuery` | `(q: string) => void` | 検索クエリ更新関数 |
| `users` | `User[]` | 検索結果のユーザー一覧 |
| `loading` | `boolean` | 検索中フラグ |
| `error` | `Error \| null` | エラー情報 |

**デバウンス動作**:
- `query` が変更されるたびに300msのタイマーをセット
- タイマーが発火するまでに再度変更があればタイマーをリセット（`clearTimeout`）
- 300ms経過後にAPIを呼び出す

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `UserSearchBar`

```
src/components/UserSearchBar.tsx        ← 新規
src/components/UserSearchBar.module.css ← 新規
```

**責務**: 検索入力フィールドのUI、入力値の変更を親（またはHook）へ通知

**Props**:

```typescript
interface UserSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
```

| プロパティ | 型 | 必須 | デフォルト値 | 説明 |
|-----------|-----|------|------------|------|
| `value` | `string` | ✅ | — | 現在の検索クエリ文字列 |
| `onChange` | `(value: string) => void` | ✅ | — | 入力値変更時のコールバック |
| `placeholder` | `string` | いいえ | `"ユーザー名またはメールアドレスで検索"` | プレースホルダーテキスト |

**UIコンポーネント構成**:

```
<div class="container">
  <input
    type="text"
    class="input"
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
  />
</div>
```

### 7.2 CSSモジュール: `UserSearchBar.module.css`

既存の `ProfileEditForm.module.css` のスタイルパターンに合わせ、以下のクラスを定義する。

| クラス名 | 説明 |
|---------|------|
| `.container` | 検索バー全体のラッパー |
| `.input` | テキスト入力フィールド（`width: 100%`、ボーダー・パディング設定） |

## 8. ページコンポーネント設計

### 8.1 新規ページ: `app/users/page.tsx`

```
app/users/page.tsx ← 新規
```

```typescript
'use client';

import React from 'react';
import { useUserSearch } from '../../src/hooks/useUserSearch';
import { UserSearchBar } from '../../src/components/UserSearchBar';
import { UserCard } from '../../src/components/UserCard';

export default function UsersPage() {
  const { query, setQuery, users, loading, error } = useUserSearch();

  return (
    <div>
      <h1>ユーザー一覧</h1>
      <UserSearchBar value={query} onChange={setQuery} />
      {loading && <div>検索中...</div>}
      {error && <div>エラーが発生しました: {error.message}</div>}
      {!loading && !error && users.length === 0 && (
        <div>該当するユーザーが見つかりません</div>
      )}
      {!loading && !error && users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}
```

**状態の描画ルール**:

| 状態 | 表示内容 |
|------|----------|
| `loading === true` | `検索中...` |
| `error !== null` | `エラーが発生しました: {error.message}` |
| `users.length === 0` かつ `loading === false` | `該当するユーザーが見つかりません` |
| `users.length > 0` | `UserCard` の一覧 |

## 9. 状態管理

### 9.1 画面の状態遷移

```
[app/users/page.tsx アクセス]
  ↓
  初期ロード（query = ""）
  → loading: true → API: GET /api/users?q=
    → 成功: loading: false → ユーザー一覧を表示
    → 失敗: loading: false → エラーメッセージ表示
  ↓
  [UserSearchBar に文字入力]
  → query が更新される
  → 300ms デバウンス
  → loading: true → API: GET /api/users?q={query}
    → 成功: loading: false → フィルタ済みユーザー一覧を表示（0件の場合はメッセージ表示）
    → 失敗: loading: false → エラーメッセージ表示
```

### 9.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `query` | `useUserSearch()` | 現在の検索クエリ文字列 |
| `users` | `useUserSearch()` | 検索結果のユーザー一覧 |
| `loading` | `useUserSearch()` | API呼び出し中フラグ |
| `error` | `useUserSearch()` | API呼び出しエラー |

## 10. ファイル変更一覧

### 10.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `app/api/users/route.ts` | API Route | ユーザー一覧・検索のRoute Handler（モックデータ） |
| `src/hooks/useUserSearch.ts` | Hook | 検索クエリ管理・デバウンス・API呼び出しロジック |
| `src/components/UserSearchBar.tsx` | コンポーネント | 検索入力バーUI |
| `src/components/UserSearchBar.module.css` | スタイル | 検索バーのCSSモジュール |
| `app/users/page.tsx` | ページ | ユーザー一覧・検索ページ |
| `src/hooks/__tests__/useUserSearch.test.ts` | テスト | useUserSearchのユニットテスト |
| `src/components/__tests__/UserSearchBar.test.tsx` | テスト | UserSearchBarのユニットテスト |
| `app/users/__tests__/page.test.tsx` | テスト | ユーザー一覧ページの統合テスト |

### 10.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `SearchParams` インターフェースを追加 |
| `src/api/client.ts` | `searchUsers(params: SearchParams): Promise<User[]>` 関数を追加 |

### 10.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/components/UserCard.tsx` | 既存コンポーネントをそのまま流用するため変更不要 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | スコープ外 |
| `app/layout.tsx` | ナビゲーション変更はスコープ外 |

## 11. 実装上の注意事項

### 11.1 モックデータの取り扱い

- Route Handler ではインメモリ配列にデータを保持する
- 実際のDB連携は後続Issueで対応
- モックデータを使用していることをコード内コメントで明記する

### 11.2 デバウンスの実装

- `useEffect` 内で `setTimeout` / `clearTimeout` を使用して300msデバウンスを実装する
- コンポーネントアンマウント時に `clearTimeout` が呼ばれることでメモリリークを防ぐ

### 11.3 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| ユーザー一覧取得失敗 | `エラーが発生しました: {error.message}` |
| 検索結果0件 | `該当するユーザーが見つかりません` |
| 検索中 | `検索中...` |

### 11.4 検索の仕様

- ユーザー名（`name`）とメールアドレス（`email`）のOR検索
- 大文字小文字を無視（`toLowerCase()` で正規化）
- 空文字列 / 未入力の場合は全件返却

## 12. テスト方針

### 12.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserSearch` | `src/hooks/__tests__/useUserSearch.test.ts` | 初期ロード / デバウンス動作 / 検索成功 / 検索エラー / ローディング状態 / クリーンアップ |
| `UserSearchBar` | `src/components/__tests__/UserSearchBar.test.tsx` | 初期表示 / 入力変更時のコールバック / プレースホルダー表示 |
| ユーザー一覧ページ | `app/users/__tests__/page.test.tsx` | 全件表示 / 検索入力時のフィルタリング / ローディング表示 / 0件メッセージ / エラー表示 |

### 12.2 テストケース詳細

#### `useUserSearch.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | マウント時にAPIが呼ばれ、ユーザー一覧が取得されること |
| 2 | ローディング状態 | API呼び出し中は `loading: true` であること |
| 3 | 検索成功 | ユーザー一覧が正しくセットされること |
| 4 | 検索エラー | エラーが `error` にセットされること |
| 5 | デバウンス | `query` 変更後300ms以内は再度APIが呼ばれないこと |
| 6 | デバウンス後のAPI呼び出し | 300ms経過後に `searchUsers` が呼ばれること |
| 7 | クリーンアップ | アンマウント時にタイマーがクリアされること |

#### `UserSearchBar.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | `value` がinputに表示されること |
| 2 | プレースホルダー | `placeholder` が表示されること |
| 3 | 入力変更 | 文字を入力すると `onChange` が呼ばれること |
| 4 | デフォルトプレースホルダー | `placeholder` 未指定時に「ユーザー名またはメールアドレスで検索」が表示されること |

#### `app/users/__tests__/page.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示（全件） | ページタイトルとユーザー一覧が表示されること |
| 2 | ローディング表示 | API呼び出し中に「検索中...」が表示されること |
| 3 | 検索バー表示 | `UserSearchBar` がレンダリングされること |
| 4 | 0件メッセージ | 検索結果が0件の場合に「該当するユーザーが見つかりません」が表示されること |
| 5 | エラー表示 | API呼び出し失敗時にエラーメッセージが表示されること |

### 12.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-116/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ユーザー一覧ページの初期表示（全件） | `users-list-initial.png` |
| 2 | 検索中のローディング表示 | `users-list-loading.png` |
| 3 | 検索結果の表示 | `users-list-search-result.png` |
| 4 | 検索結果0件の表示 | `users-list-empty.png` |
| 5 | エラー表示 | `users-list-error.png` |

## 13. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更（`SearchParams` 追加） | なし |
| 2 | `src/api/client.ts` | APIクライアント | 変更（`searchUsers` 追加） | 順序1 |
| 3 | `app/api/users/route.ts` | API Route | 新規 | 順序1 |
| 4 | `src/hooks/useUserSearch.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/UserSearchBar.tsx` + CSS | コンポーネント | 新規 | なし |
| 6 | `app/users/page.tsx` | ページ | 新規 | 順序4, 5 |
| 7 | テスト追加 | テスト | 新規 | 順序1-6 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序4 と 順序5 は互いに独立しているため並列実装可能

## 14. 依存関係図

```
src/types/user.ts（変更: SearchParams 追加）
  ├─→ src/api/client.ts（変更: searchUsers 追加）
  │     ↓
  │   src/hooks/useUserSearch.ts（新規: Hook）
  │     ↓
  │   app/users/page.tsx（新規: ページ）
  │     ↑
  ├─→ src/components/UserSearchBar.tsx + CSS（新規: 検索バーUI）
  │     ↑
  │   app/users/page.tsx（UserSearchBar を使用）
  │
  └─→ app/api/users/route.ts（新規: Route Handler）
```
