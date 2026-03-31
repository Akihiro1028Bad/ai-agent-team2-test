# 設計書: Issue #36 ユーザープロフィール画面の追加

## 1. 概要

ユーザープロフィール画面を新規追加する。自分のプロフィールの閲覧・編集、および他ユーザーのプロフィール閲覧が可能な画面を実装する。

### 1.1 背景

現在のアプリケーションには `UserCard` コンポーネント（簡易表示）のみ存在し、ユーザーの詳細プロフィールを表示・編集する画面がない。既存の `UserProfile` 型や `getUserProfile` API は定義済みだが、それを活用する画面が未実装である。

### 1.2 ゴール

- ユーザープロフィールの詳細情報を表示する画面を提供する
- 自分のプロフィールを編集できる機能を提供する
- 他ユーザーのプロフィールを閲覧できる機能を提供する

## 2. 要件（ヒアリング結果）

| # | 項目 | 決定事項 | 理由 |
|---|------|----------|------|
| 1 | ルーティング方式 | **App Router（`app/`）** | Next.js 14 の推奨方式 |
| 2 | 機能スコープ | **閲覧＋編集** | 既存APIに `updateUser` があり対応可能。閲覧のみだと後で編集追加時に再改修が必要 |
| 3 | 対象ユーザー | **両方**（`/profile` + `/users/[id]`） | `/profile` は自分用、`/users/[id]` は他ユーザー閲覧用 |
| 4 | 表示項目 | `UserProfile` の全フィールド | `name`, `email`, `avatarUrl`, `bio`, `location`, `website`, `createdAt` |
| 5 | UI/スタイリング | **CSS Modules** | UIライブラリ未導入のため、シンプルなCSS Modulesで実装 |
| 6 | ナビゲーション連携 | **スコープ外** | 既存ナビゲーションが無いため、画面単体の追加のみ |

## 3. 既存コードの分析

### 3.1 現在の実装状況

| 区分 | 状況 | 詳細 |
|------|------|------|
| **型定義** | ✅ 存在 | `User` / `UserProfile`（`bio`, `location`, `website` 含む）が `src/types/user.ts` に定義済み |
| **API** | ⚠️ 部分的 | `getUserProfile(id)` / `updateUser(id, data)` は存在。`updateUserProfile` は未実装 |
| **Hook** | ⚠️ 部分的 | `useUser` のみ存在。`useUserProfile` は未実装 |
| **コンポーネント** | ⚠️ 部分的 | `UserCard`（簡易表示）のみ。プロフィール詳細画面は無し |
| **ルーティング** | ❌ 未整備 | `app/` も `pages/` ディレクトリも存在しない |
| **スタイリング** | ❌ 未整備 | CSSファイルもUIライブラリも未導入 |

### 3.2 既存の型定義

```typescript
// src/types/user.ts
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

### 3.3 既存のAPI関数

```typescript
// src/api/client.ts
getUser(id: string): Promise<User>
getUserProfile(id: string): Promise<UserProfile>
updateUser(id: string, data: Partial<User>): Promise<User>
// ※ updateUserProfile は未実装 → 今回追加が必要
```

## 4. URL設計

| パス | 用途 | 認証 |
|------|------|------|
| `/profile` | ログインユーザー自身のプロフィール（閲覧・編集） | 要ログイン |
| `/users/[id]` | 指定ユーザーのプロフィール（閲覧のみ） | 不要（公開） |

### 4.1 ルーティング動作

- `/profile` は内部的にログインユーザーのIDを取得し、`getUserProfile` を呼び出す
- `/users/[id]` はURLパラメータの `id` を使って `getUserProfile` を呼び出す
- `/profile` では編集ボタンを表示し、編集モードへの切り替えが可能
- `/users/[id]` では編集ボタンを非表示にする（閲覧専用）

## 5. コンポーネント設計

### 5.1 コンポーネント構成図

```
app/layout.tsx                    ← ルートレイアウト（新規）
app/profile/page.tsx              ← 自分のプロフィールページ（新規）
app/users/[id]/page.tsx           ← 他ユーザーのプロフィールページ（新規）

src/components/
  UserProfileView.tsx             ← プロフィール表示コンポーネント（新規）
  UserProfileView.module.css      ← スタイル（新規）
  ProfileEditForm.tsx             ← プロフィール編集フォーム（新規）
  ProfileEditForm.module.css      ← スタイル（新規）
  UserCard.tsx                    ← 既存（変更なし）
```

### 5.2 各コンポーネントの責務

#### `app/layout.tsx`（新規）
- App Router のルートレイアウト
- `<html>` / `<body>` タグ、共通メタデータを定義
- 将来的なナビゲーション追加に備えた構造

#### `app/profile/page.tsx`（新規）
- ログインユーザー自身のプロフィールページ
- `useUserProfile` hookでプロフィール取得
- `UserProfileView` を `editable={true}` で描画
- 編集ボタン押下で `ProfileEditForm` を表示

#### `app/users/[id]/page.tsx`（新規）
- URLパラメータ `id` から対象ユーザーのプロフィールを取得
- `useUserProfile` hookでプロフィール取得
- `UserProfileView` を `editable={false}` で描画

#### `UserProfileView`（新規）
- プロフィール情報の表示を担当する presentational コンポーネント
- Props:
  - `profile: UserProfile` — 表示するプロフィールデータ
  - `editable: boolean` — 編集ボタンの表示制御
  - `onEdit?: () => void` — 編集ボタン押下時のコールバック
- 表示項目: アバター画像、名前、メール、自己紹介、所在地、Webサイト、登録日

#### `ProfileEditForm`（新規）
- プロフィール編集フォームコンポーネント
- Props:
  - `profile: UserProfile` — 編集対象の現在のプロフィールデータ
  - `onSave: (data: Partial<UserProfile>) => void` — 保存時のコールバック
  - `onCancel: () => void` — キャンセル時のコールバック
- 編集可能フィールド: `name`, `bio`, `location`, `website`
- `email`, `createdAt` は読み取り専用として表示
- バリデーション: `name` は必須、`website` はURL形式チェック

## 6. API設計

### 6.1 追加するAPI関数

```typescript
// src/api/client.ts に追加
export async function updateUserProfile(
  id: string,
  data: Partial<UserProfile>
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

### 6.2 API呼び出しフロー

```
[プロフィール表示]
  app/profile/page.tsx → useUserProfile(currentUserId) → getUserProfile(id) → GET /api/users/:id/profile

[プロフィール編集]
  ProfileEditForm → onSave → updateUserProfile(id, data) → PATCH /api/users/:id/profile
```

## 7. カスタムHook設計

### 7.1 `useUserProfile`（新規）

```typescript
// src/hooks/useUserProfile.ts
export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // プロフィール取得
  useEffect(() => {
    setLoading(true);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  // プロフィール更新関数
  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await updateUserProfile(id, data);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile };
}
```

- `useUser` hookと同じパターンを踏襲し、一貫性を保つ
- `updateProfile` 関数を返すことで、編集フォームからの更新を簡潔に記述可能

## 8. 状態管理

### 8.1 画面の状態遷移

```
[/profile ページ]
  Loading → 表示（閲覧モード） ⇄ 表示（編集モード） → 保存中 → 表示（閲覧モード）
                                                      → エラー → 表示（編集モード）

[/users/[id] ページ]
  Loading → 表示（閲覧モード）
         → エラー（ユーザー未発見等）
```

### 8.2 状態一覧

| 状態 | 説明 |
|------|------|
| `loading` | プロフィールデータ取得中 |
| `error` | API呼び出しエラー |
| `isEditing` | 編集モードかどうか（`/profile` ページのみ） |
| `isSaving` | プロフィール更新API呼び出し中 |

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `app/layout.tsx` | ページ | ルートレイアウト |
| `app/profile/page.tsx` | ページ | 自分のプロフィール画面 |
| `app/users/[id]/page.tsx` | ページ | 他ユーザーのプロフィール画面 |
| `src/components/UserProfileView.tsx` | コンポーネント | プロフィール表示 |
| `src/components/UserProfileView.module.css` | スタイル | プロフィール表示のスタイル |
| `src/components/ProfileEditForm.tsx` | コンポーネント | プロフィール編集フォーム |
| `src/components/ProfileEditForm.module.css` | スタイル | 編集フォームのスタイル |
| `src/hooks/useUserProfile.ts` | Hook | プロフィール取得・更新 |

### 9.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/api/client.ts` | `updateUserProfile` 関数を追加 |

### 9.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | 既存の `UserProfile` 型で必要な項目を網羅しているため変更不要 |
| `src/components/UserCard.tsx` | 今回のスコープでは変更不要 |
| `src/hooks/useUser.ts` | 変更不要。新規 `useUserProfile` で対応 |

## 10. 実装上の注意事項

### 10.1 App Router の注意点

- `app/profile/page.tsx` と `app/users/[id]/page.tsx` は Client Component（`'use client'` ディレクティブ）として実装する
  - `useState` / `useEffect` を使用するため
- `app/layout.tsx` は Server Component として実装可能

### 10.2 認証について

- 現在のコードベースに認証基盤が存在しないため、`/profile` ページのログインユーザーID取得はプレースホルダー実装とする
- 将来的に認証基盤が導入された際に差し替え可能な構造にしておく
- 例: `const currentUserId = getCurrentUserId();` のようなヘルパー関数を用意し、内部は仮実装

### 10.3 エラーハンドリング

- API呼び出し失敗時はエラーメッセージを画面に表示する
- ユーザーが見つからない場合（404）は専用のメッセージを表示する
- 編集保存失敗時はフォームを維持し、エラーメッセージを表示してリトライ可能にする

### 10.4 バリデーション

- `name`: 必須、1文字以上
- `website`: 任意、入力時はURL形式（`https://` で始まる）であることを検証
- `bio`: 任意、最大500文字
- `location`: 任意、最大100文字

## 11. テスト方針

| テスト対象 | テスト内容 |
|-----------|-----------|
| `useUserProfile` | プロフィール取得・更新の正常系/異常系 |
| `UserProfileView` | 各フィールドの表示確認、編集ボタンの表示制御 |
| `ProfileEditForm` | フォーム入力・バリデーション・送信 |
| `app/profile/page.tsx` | 閲覧モード↔編集モードの切り替え |
| `app/users/[id]/page.tsx` | URLパラメータからのプロフィール取得・表示 |

## 12. 実装順序

1. **`src/api/client.ts`** — `updateUserProfile` 関数の追加
2. **`src/hooks/useUserProfile.ts`** — カスタムHookの新規作成
3. **`src/components/UserProfileView.tsx`** + CSS — プロフィール表示コンポーネント
4. **`src/components/ProfileEditForm.tsx`** + CSS — 編集フォームコンポーネント
5. **`app/layout.tsx`** — ルートレイアウト
6. **`app/profile/page.tsx`** — 自分のプロフィールページ
7. **`app/users/[id]/page.tsx`** — 他ユーザーのプロフィールページ
8. **テスト作成**
