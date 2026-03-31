# 設計書: Issue #34 - プロフィール画面の実装

## 1. 概要

ユーザーのプロフィール情報（ユーザー名・メールアドレス・アバター画像・自己紹介文・所在地・Webサイト・登録日）を閲覧・編集できる画面を実装する。Next.js 14 の App Router を使用し、動的ルーティング `/profile/[id]` で構築する。

---

## 2. 背景・動機

現在、アプリケーションにはユーザーの基本情報を表示する `UserCard` コンポーネントや、`UserProfile` 型定義、`getUserProfile` APIクライアントなどの基盤は整っているが、プロフィール画面自体は存在しない。ユーザーが自身のプロフィール情報を確認・編集したり、他ユーザーのプロフィールを閲覧したりするための画面が求められている。

---

## 3. 要件

ヒアリングで得られた回答に基づき、以下の要件で実装する。

| 項目 | 決定事項 | 根拠 |
|------|---------|------|
| **機能スコープ** | 閲覧＋編集（`bio` / `location` / `website` の更新を含む） | ヒアリング回答：「編集機能含む」 |
| **対象ユーザー** | 自分・他ユーザーとも同一の表示内容・操作 | ヒアリング回答：「ひとまず一緒で良い」 |
| **ルーター構成** | App Router（`app/` ディレクトリ） | Next.js 14 推奨方式 |
| **ルーティング** | `/profile/[id]`（動的パス） | ヒアリング回答：「お任せ」 |
| **表示項目** | `UserProfile` 型の全フィールドを表示（追加フィールドなし） | ヒアリング回答：「全て表示、追加はなし」 |
| **デザイン** | 既存の `UserCard` コンポーネントのスタイルに合わせたシンプルなレイアウト | ヒアリング回答：「それでいいよ」 |
| **認証** | 現時点では未実装（将来対応） | コードベースに認証基盤なし |
| **PATCH API** | フロントエンド側で先行実装（バックエンド側の実装状況は要調査） | ヒアリング回答：「自分で調査して」 |

---

## 4. 影響範囲

### 新規作成するファイル

| ファイル | 内容 |
|---------|------|
| `app/profile/[id]/page.tsx` | プロフィール画面のページコンポーネント（App Router） |
| `app/layout.tsx` | App Router のルートレイアウト |
| `src/components/ProfileView.tsx` | プロフィール情報の閲覧用コンポーネント |
| `src/components/ProfileEditForm.tsx` | プロフィール情報の編集フォームコンポーネント |
| `src/hooks/useUserProfile.ts` | `getUserProfile` / `updateUserProfile` を呼び出すカスタムフック |

### 変更するファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/api/client.ts` | `updateUserProfile` 関数を追加 |
| `src/types/user.ts` | `UserProfileUpdateInput` 型を追加 |

### 影響を受ける既存機能

- **ルーティング**: `app/` ディレクトリの新規作成により App Router が有効化される
- **API クライアント**: `client.ts` に更新用関数が追加されるが、既存関数への変更はなし
- **型定義**: 新規型の追加のみで、既存型への変更はなし

---

## 5. 実装方針

### アプローチ

#### 5.1. 型定義の拡張（`src/types/user.ts`）

プロフィール更新リクエスト用の入力型を追加する。

```typescript
// 追加
export interface UserProfileUpdateInput {
  bio?: string;
  location?: string;
  website?: string;
}
```

#### 5.2. APIクライアントの拡張（`src/api/client.ts`）

プロフィール更新用の関数を追加する。既存の `getUser` / `getUserProfile` / `updateUser` パターンに倣い、エラーハンドリングを統一する。

```typescript
import { UserProfileUpdateInput } from '../types/user';

// 追加
export async function updateUserProfile(
  id: string,
  data: UserProfileUpdateInput
): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/users/${id}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
  return res.json();
}
```

#### 5.3. カスタムフック（`src/hooks/useUserProfile.ts`）

既存の `useUser` フックのパターンに倣い、プロフィール取得・更新・ローディング・エラーの各ステートを管理するカスタムフックを実装する。

```typescript
import { useState, useEffect, useCallback } from 'react';
import { UserProfile, UserProfileUpdateInput } from '../types/user';
import { getUserProfile, updateUserProfile } from '../api/client';

export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setLoading(true);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const updateProfile = useCallback(async (data: UserProfileUpdateInput) => {
    setUpdating(true);
    try {
      const updated = await updateUserProfile(id, data);
      setProfile(updated);
      return updated;
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Update failed'));
      throw e;
    } finally {
      setUpdating(false);
    }
  }, [id]);

  return { profile, loading, error, updating, updateProfile };
}
```

#### 5.4. 閲覧用コンポーネント（`src/components/ProfileView.tsx`）

`UserProfile` を props として受け取り、全フィールドをカードレイアウトで表示する。`UserCard` のスタイルに合わせたシンプルなデザインとする。

**表示項目（全フィールド）:**

| フィールド | 表示形式 |
|-----------|---------|
| `avatarUrl` | 丸形のアバター画像（未設定時は `/default-avatar.png`） |
| `name` | 見出しとして表示 |
| `email` | テキスト表示 |
| `bio` | テキスト表示（未設定時は「未設定」プレースホルダ） |
| `location` | 📍 アイコン付きテキスト（未設定時は「未設定」プレースホルダ） |
| `website` | 🔗 リンクとして表示（未設定時は「未設定」プレースホルダ） |
| `createdAt` | 「登録日: YYYY/MM/DD」形式で表示 |

**Props:**

```typescript
interface ProfileViewProps {
  profile: UserProfile;
  onEdit: () => void;
}
```

- 「編集」ボタンを常に表示する（ヒアリングで「ひとまず一緒で良い」のため、自分/他人の区別なし）

#### 5.5. 編集フォームコンポーネント（`src/components/ProfileEditForm.tsx`）

`bio`・`location`・`website` の3フィールドを編集可能なフォームコンポーネント。

**Props:**

```typescript
interface ProfileEditFormProps {
  initialValues: {
    bio?: string;
    location?: string;
    website?: string;
  };
  onSave: (data: UserProfileUpdateInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}
```

**仕様:**
- `textarea`（bio）と `input`（location, website）で構成
- 「保存」ボタン押下で `onSave` コールバックを呼び出し
- 「キャンセル」ボタンで編集モードを終了
- バリデーション: `website` は URL 形式チェック、`bio` は最大500文字
- 保存中は「保存」ボタンを disabled にし、ローディング表示

#### 5.6. ページコンポーネント（`app/profile/[id]/page.tsx`）

App Router の動的ルートページとして実装する。クライアントコンポーネント（`'use client'`）として構築し、`useUserProfile` フックでデータを取得する。

**状態遷移:**

```
初期表示 → ローディング中 → 閲覧モード ↔ 編集モード
                           → エラー表示
```

- ローディング中: スピナーまたは「読み込み中...」テキストを表示
- エラー時: エラーメッセージを表示
- 正常時: `ProfileView` を表示
- 編集ボタン押下時: `ProfileEditForm` に切り替え
- 保存成功時: 閲覧モードに戻り、更新後のデータを表示

#### 5.7. ルートレイアウト（`app/layout.tsx`）

App Router に必要な最小限のルートレイアウトを作成する。

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

### 代替案

| 案 | 内容 | 不採用理由 |
|----|------|-----------|
| Pages Router での実装 | `pages/profile/[id].tsx` で構築 | Next.js 14 では App Router が推奨されているため不採用 |
| 閲覧のみで初期実装 | 編集機能を別 Issue に分離 | ヒアリングで「編集機能含む」と確定 |
| SSR / Server Components | サーバーサイドでデータ取得 | 既存コードベースがクライアントサイドフェッチで統一されているため、一貫性を優先 |
| モーダルでの編集 | 編集フォームをモーダルで表示 | シンプルさを優先し、同一ページ内での表示切替とする |
| 自分/他人で表示を分ける | 自分だけ編集ボタン表示 | ヒアリングで「ひとまず一緒で良い」と確定 |

---

## 6. データ構造の変更

### 既存型（変更なし）

```typescript
// src/types/user.ts（既存）
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}
```

### 新規追加型

```typescript
// src/types/user.ts（追加）
export interface UserProfileUpdateInput {
  bio?: string;
  location?: string;
  website?: string;
}
```

DBスキーマへの変更は今回のスコープに含まない。

---

## 7. API変更

### 利用するエンドポイント

| メソッド | パス | 説明 | 状況 |
|---------|------|------|------|
| `GET` | `/api/users/:id/profile` | 指定IDのプロフィール情報を取得 | 既存（APIクライアント実装済み） |
| `PATCH` | `/api/users/:id/profile` | 指定IDのプロフィール情報を更新 | **新規（バックエンド側の実装状況は要調査）** |

#### GET レスポンス例

```json
{
  "id": "u_123",
  "name": "Akihiro",
  "email": "akihiro@example.com",
  "avatarUrl": "https://example.com/avatars/u_123.png",
  "createdAt": "2024-01-15T09:00:00Z",
  "bio": "TypeScript好きのエンジニアです。",
  "location": "Tokyo, Japan",
  "website": "https://example.com"
}
```

#### PATCH リクエスト例

```json
{
  "bio": "更新された自己紹介文",
  "location": "Osaka, Japan",
  "website": "https://new-example.com"
}
```

#### PATCH レスポンス例

更新後の完全な `UserProfile` オブジェクトを返す（GET レスポンスと同形式）。

#### エラーレスポンス

| ステータス | 対応 |
|-----------|------|
| `400 Bad Request` | バリデーションエラーメッセージを表示 |
| `403 Forbidden` | 「このプロフィールを編集する権限がありません」メッセージを表示 |
| `404 Not Found` | 「ユーザーが見つかりません」メッセージを表示 |
| `500 Internal Server Error` | 汎用エラーメッセージを表示し、リトライを促す |

---

## 8. テスト方針

### ユニットテスト

| 対象 | テスト内容 |
|------|-----------|
| `useUserProfile` フック | 正常取得・ローディング状態・エラー状態のステート遷移。更新成功・更新失敗時の挙動 |
| `ProfileView` コンポーネント | 各フィールドが正しくレンダリングされるか。未設定フィールドのフォールバック表示（「未設定」プレースホルダ）。編集ボタンの表示と動作 |
| `ProfileEditForm` コンポーネント | 初期値の反映。フォーム入力の反映。バリデーション（URL形式、bio 500文字制限）。保存・キャンセルボタンの動作。保存中の disabled 状態 |

### 統合テスト（E2E）

| シナリオ | 期待結果 |
|---------|---------|
| `/profile/u_123` にアクセス | プロフィール情報（全フィールド）が表示される |
| 編集ボタンを押す | 編集フォームに切り替わる |
| 編集フォームで情報を更新して保存 | 更新後の情報が即座に反映され、閲覧モードに戻る |
| 編集フォームでキャンセル | 変更が破棄され、閲覧モードに戻る |
| 存在しないIDにアクセス | エラーメッセージが表示される |
| APIが 5xx を返す | エラー状態のUIが表示される |
| website に不正な値を入力して保存 | バリデーションエラーが表示される |

### レスポンシブ確認

- モバイル（375px〜）
- タブレット（768px〜）
- デスクトップ（1280px〜）

---

## 9. リスク・懸念事項

| リスク | 影響度 | 対応策 |
|-------|--------|--------|
| `PATCH /users/:id/profile` がバックエンドに未実装の可能性 | 高 | フロントエンドは先行実装し、モックデータで動作確認する。バックエンド側の実装状況を別途調査 |
| 認証基盤が未実装 | 中 | 現時点では認証なしで実装。将来の認証実装時に、編集権限の制御を追加する |
| 自分/他人の区別なく編集ボタンを表示 | 中 | ヒアリングで「ひとまず一緒で良い」のため暫定対応。将来的にはバックエンド側の `403 Forbidden` で権限制御し、フロントエンドでも認証ユーザーIDとの比較で編集ボタン表示を制御する |
| `app/` ディレクトリの新規作成による既存構成への影響 | 中 | `app/` と `src/` の共存を前提とし、コンポーネント・フック・型定義は `src/` に配置する既存規約を維持 |
| アバター画像の読み込み失敗 | 低 | `<img>` の `onError` ハンドラでデフォルト画像にフォールバック |

---

## 10. 見積もり

| タスク | 工数 |
|-------|------|
| 型定義の追加 (`UserProfileUpdateInput`) | 0.5h |
| APIクライアント拡張 (`updateUserProfile`) | 0.5h |
| `useUserProfile` カスタムフック実装 | 1.5h |
| `ProfileView` コンポーネント実装（レスポンシブ含む） | 2h |
| `ProfileEditForm` コンポーネント実装（バリデーション含む） | 2.5h |
| `app/profile/[id]/page.tsx` ページコンポーネント実装 | 1.5h |
| `app/layout.tsx` ルートレイアウト作成 | 0.5h |
| ユニットテスト作成 | 3h |
| レビュー・修正対応 | 1h |
| **合計** | **13h** |

---

## 11. 実装順序

1. **型定義の追加** - `UserProfileUpdateInput` を `src/types/user.ts` に追加
2. **APIクライアントの拡張** - `updateUserProfile` を `src/api/client.ts` に追加
3. **カスタムフック** - `src/hooks/useUserProfile.ts` を新規作成
4. **閲覧コンポーネント** - `src/components/ProfileView.tsx` を新規作成
5. **編集フォームコンポーネント** - `src/components/ProfileEditForm.tsx` を新規作成
6. **ルートレイアウト** - `app/layout.tsx` を新規作成
7. **ページコンポーネント** - `app/profile/[id]/page.tsx` を新規作成
8. **テスト** - 各コンポーネント・フックのユニットテストを作成
