# 設計書: Issue #127 ユーザープロフィール画面の追加

## 1. 概要

ログインユーザー自身のプロフィール情報を閲覧・編集できる画面を追加する。

- `/profile` にアクセスするとプロフィール閲覧画面が表示される
- 「プロフィールを編集」ボタンを押すと編集フォームに切り替わる
- 編集フォームでは名前・自己紹介・所在地・Webサイトを変更し、保存できる
- 保存完了後は閲覧モードに戻り、更新後の情報が反映される

### 1.1 背景

現在のアプリケーションにはユーザープロフィール画面が存在しない。ユーザーが自身の情報を確認・更新できる基本機能として、プロフィール閲覧・編集画面を実装する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）
  - ページ: `app/profile/page.tsx`
  - コンポーネント: `UserProfileView`, `ProfileEditForm`
  - フック: `useUserProfile`
  - APIクライアント: `src/api/client.ts`（`getUserProfile`, `updateUserProfile`）
  - 型定義: `src/types/user.ts`（`User`, `UserProfile`）
  - スタイル: 各 `*.module.css`
  - テスト: 各テストファイル
- **対象外**:
  - 認証基盤（ユーザーIDは暫定的にハードコード）
  - バックエンドAPIの実装
  - E2Eテスト
  - アバター画像アップロード機能

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | スタイリング方法 | CSS Modules（`*.module.css`）で実装、Tailwind CSS は不要 |
| 2 | 認証 | 暫定的にハードコードした `current-user-id` を使用（TODO コメントで認証基盤導入後に差し替え） |
| 3 | メールアドレス | 読み取り専用フィールドとして表示（編集不可） |
| 4 | バリデーション | 名前: 必須、bio: 200文字以内、location: 100文字以内、website: `https://` 始まり |
| 5 | 状態管理 | React ローカル状態（useState/useEffect）で管理 |

---

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **ページ** | `app/profile/page.tsx` | 実装済み（認証IDハードコード） | ✅ 変更なし（設計通り） |
| **コンポーネント** | `src/components/UserProfileView.tsx` | 実装済み | ✅ 変更なし |
| **コンポーネント** | `src/components/ProfileEditForm.tsx` | 実装済み | ✅ 変更なし |
| **コンポーネント CSS** | `src/components/UserProfileView.module.css` | 実装済み | ✅ 変更なし |
| **コンポーネント CSS** | `src/components/ProfileEditForm.module.css` | 実装済み | ✅ 変更なし |
| **フック** | `src/hooks/useUserProfile.ts` | 実装済み | ✅ 変更なし |
| **APIクライアント** | `src/api/client.ts` | `getUserProfile`, `updateUserProfile` 実装済み | ✅ 変更なし |
| **型定義** | `src/types/user.ts` | `User`, `UserProfile` 定義済み | ✅ 変更なし |
| **テスト** | `app/profile/__tests__/page.test.tsx` | 実装済み | ✅ 変更なし |
| **テスト** | `src/components/__tests__/UserProfileView.test.tsx` | 実装済み | ✅ 変更なし |
| **テスト** | `src/components/__tests__/ProfileEditForm.test.tsx` | 実装済み | ✅ 変更なし |
| **テスト** | `src/hooks/__tests__/useUserProfile.test.ts` | 実装済み | ✅ 変更なし |

### 2.2 既存のコンポーネントパターン

```typescript
// 既存パターン（src/components/ProfileEditForm.tsx）
'use client';

import React, { useState } from 'react';
import styles from './ProfileEditForm.module.css';

export const ProfileEditForm: React.FC<Props> = ({ profile, onSave, onCancel }) => {
  const [name, setName] = useState(profile.name);
  // ...
  return <form className={styles.form} onSubmit={handleSubmit}>...</form>;
};
```

### 2.3 既存のHookパターン

```typescript
// 既存パターン（src/hooks/useUserProfile.ts）
import { useState, useEffect } from 'react';

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

  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await updateUserProfile(id, data);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile };
}
```

### 2.4 既存のAPIクライアントパターン

```typescript
// 既存パターン（src/api/client.ts）
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getUserProfile(id: string): Promise<UserProfile> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}/profile`);
  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  return res.json();
}

export async function updateUserProfile(
  id: string,
  data: Partial<UserProfile>
): Promise<UserProfile> {
  validateUserId(id);
  const res = await fetch(`${API_BASE}/users/${id}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update profile: ${res.status}`);
  return res.json();
}
```

---

## 3. 型定義設計

### 3.1 `src/types/user.ts`

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
}

export interface UserProfile extends User {
  bio?: string;       // 自己紹介（最大200文字）
  location?: string;  // 所在地（最大100文字）
  website?: string;   // WebサイトURL（https:// 始まり）
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | `string` | ✅ | ユーザーID |
| `name` | `string` | ✅ | 表示名 |
| `email` | `string` | ✅ | メールアドレス（読み取り専用） |
| `avatarUrl` | `string?` | - | アバター画像URL |
| `createdAt` | `Date \| string` | ✅ | アカウント作成日時 |
| `bio` | `string?` | - | 自己紹介文（最大200文字） |
| `location` | `string?` | - | 所在地（最大100文字） |
| `website` | `string?` | - | WebサイトURL（`https://` 始まり） |

---

## 4. APIクライアント設計

### 4.1 エンドポイント一覧

| 関数名 | メソッド | エンドポイント | 説明 |
|-------|---------|--------------|------|
| `getUserProfile(id)` | GET | `/api/users/{id}/profile` | プロフィール取得 |
| `updateUserProfile(id, data)` | PATCH | `/api/users/{id}/profile` | プロフィール更新 |

### 4.2 リクエスト/レスポンス仕様

**getUserProfile**

```
GET /api/users/{id}/profile
Response: UserProfile (JSON)
Error: Error("Failed to fetch profile: {status}")
```

**updateUserProfile**

```
PATCH /api/users/{id}/profile
Request Body: Partial<UserProfile> (JSON)
Response: UserProfile (JSON)
Error: Error("Failed to update profile: {status}")
```

### 4.3 バリデーション

- `id` が空文字列の場合: `Error('User ID is required')` をスロー
- APIレスポンスが `!res.ok` の場合: `Error('Failed to fetch/update profile: {status}')` をスロー

---

## 5. フック設計

### 5.1 `useUserProfile`

**ファイル**: `src/hooks/useUserProfile.ts`

**責務**: 指定ユーザーのプロフィール情報の取得・更新状態管理

**シグネチャ**:

```typescript
export function useUserProfile(id: string): {
  profile: UserProfile | null;
  loading: boolean;
  error: Error | null;
  updateProfile: (data: Partial<UserProfile>) => Promise<UserProfile>;
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `profile` | `UserProfile \| null` | 取得済みプロフィール（取得前は `null`） |
| `loading` | `boolean` | データ取得中フラグ |
| `error` | `Error \| null` | エラーオブジェクト（正常時は `null`） |
| `updateProfile` | `(data) => Promise<UserProfile>` | プロフィール更新関数 |

**状態遷移**:

```
初期状態: { profile: null, loading: true, error: null }
        ↓ useEffect 発火（id が変わるたびに再実行）
        ↓ getUserProfile(id) 呼び出し
  ┌─────┴──────┐
成功            失敗
  ↓              ↓
{ profile: data, { profile: null,
  loading: false,  loading: false,
  error: null }    error: Error }
```

---

## 6. コンポーネント設計

### 6.1 `UserProfileView`

**ファイル**: `src/components/UserProfileView.tsx`

**責務**: プロフィール情報の表示（閲覧モード）

**Props**:

```typescript
interface UserProfileViewProps {
  profile: UserProfile | null | undefined;
  editable: boolean;
  onEdit?: () => void;
}
```

**表示仕様**:

| 条件 | 表示内容 |
|------|---------|
| `profile` が `null` または `undefined` | 「ユーザーが見つかりません」メッセージ |
| `profile.avatarUrl` が未設定 | `/default-avatar.png` を表示 |
| `profile.bio` が未設定 | 自己紹介セクションを非表示 |
| `profile.location` が未設定 | 所在地セクションを非表示 |
| `profile.website` が未設定 | Webサイトセクションを非表示 |
| `profile.website` がプロトコルなし | `https://` を自動付与してリンク生成 |
| `profile.createdAt` が不正値 | 「不明」と表示 |
| `editable` が `true` | 「プロフィールを編集」ボタンを表示 |
| `editable` が `false` | 「プロフィールを編集」ボタンを非表示 |

**UIレイアウト**:

```
┌─────────────────────────────────────────────────────┐
│  [アバター画像]  テストユーザー                        │
│                 test@example.com                    │
├─────────────────────────────────────────────────────┤
│  自己紹介                                            │
│  自己紹介テキスト...                                  │
├─────────────────────────────────────────────────────┤
│  所在地                                              │
│  東京                                                │
├─────────────────────────────────────────────────────┤
│  Webサイト                                           │
│  https://example.com                                │
├─────────────────────────────────────────────────────┤
│  登録日: 2024/01/01                                  │
│                                                     │
│             [プロフィールを編集]                      │
└─────────────────────────────────────────────────────┘
```

**CSSクラス一覧** (`UserProfileView.module.css`):

| クラス名 | 説明 |
|---------|------|
| `.container` | 外側コンテナ |
| `.header` | アバターと名前・メールの横並びエリア |
| `.avatar` | アバター画像 |
| `.name` | 表示名 |
| `.email` | メールアドレス |
| `.section` | 各フィールドセクション（bio / location / website） |
| `.label` | フィールドラベル |
| `.value` | フィールド値 |
| `.meta` | 登録日エリア |
| `.editButton` | 編集ボタン |

### 6.2 `ProfileEditForm`

**ファイル**: `src/components/ProfileEditForm.tsx`

**責務**: プロフィール編集フォーム（編集モード）

**Props**:

```typescript
interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}
```

**フォームフィールド**:

| フィールド | 入力種別 | バリデーション | 説明 |
|-----------|---------|--------------|------|
| 名前 | `<input type="text">` | 必須 | 表示名 |
| メールアドレス | 読み取り専用表示 | - | 変更不可 |
| 自己紹介 | `<textarea>` | 200文字以内 | 残り文字数カウンター表示 |
| 所在地 | `<input type="text">` | 100文字以内 | |
| Webサイト | `<input type="url">` | `https://` 始まり | |
| 登録日 | 読み取り専用表示 | - | 変更不可 |

**バリデーションエラーメッセージ**:

| フィールド | 条件 | エラーメッセージ |
|-----------|------|----------------|
| 名前 | 空文字または空白のみ | `名前は必須です` |
| 自己紹介 | 200文字超過 | `自己紹介は200文字以内で入力してください` |
| 所在地 | 100文字超過 | `所在地は100文字以内で入力してください` |
| Webサイト | `https://` 始まりでない | `URLは https:// で始めてください` |

**状態一覧**:

| 状態 | 型 | 初期値 | 説明 |
|------|-----|--------|------|
| `name` | `string` | `profile.name` | 名前入力値 |
| `bio` | `string` | `profile.bio \|\| ''` | 自己紹介入力値 |
| `location` | `string` | `profile.location \|\| ''` | 所在地入力値 |
| `website` | `string` | `profile.website \|\| ''` | WebサイトURL入力値 |
| `errors` | `FormErrors` | `{}` | バリデーションエラー |
| `isSaving` | `boolean` | `false` | 保存処理中フラグ |
| `saveError` | `string \| null` | `null` | APIエラーメッセージ |

**送信フロー**:

```
フォーム送信（handleSubmit）
  ↓
バリデーション実行
  ├─ エラーあり → errors を setErrors して終了
  └─ エラーなし ↓
       isSaving = true
       onSave(data) を呼び出し
         ├─ 成功 → isSaving = false（呼び出し元が isEditing = false に）
         └─ 失敗 → saveError に error.message をセット、isSaving = false
```

**CSSクラス一覧** (`ProfileEditForm.module.css`):

| クラス名 | 説明 |
|---------|------|
| `.form` | フォーム全体 |
| `.title` | フォームタイトル「プロフィール編集」 |
| `.field` | 各フォームフィールドのラッパー |
| `.readOnly` | 読み取り専用フィールド |
| `.charCount` | 文字数カウンター |
| `.charCountWarning` | 文字数が上限付近（180文字以上）の警告スタイル |
| `.fieldError` | フィールドレベルエラーメッセージ |
| `.errorMessage` | 保存APIエラーメッセージ |
| `.actions` | 保存・キャンセルボタンのラッパー |
| `.saveButton` | 保存ボタン |
| `.cancelButton` | キャンセルボタン |

---

## 7. ページ設計

### 7.1 `app/profile/page.tsx`

**責務**: `/profile` ルートのページコンポーネント。`useUserProfile` フックを利用し、閲覧モードと編集モードを切り替える。

**状態一覧**:

| 状態 | 型 | 初期値 | 説明 |
|------|-----|--------|------|
| `isEditing` | `boolean` | `false` | 編集モードフラグ |

**ユーザー操作フロー**:

```
[/profile にアクセス]
  ↓
[useUserProfile フックが API からプロフィールを取得]
  ↓
  ├─ loading 中 → 「読み込み中...」を表示
  ├─ error     → 「エラーが発生しました: {message}」を表示
  └─ 取得成功  → UserProfileView を表示
                   ↓ 「プロフィールを編集」をクリック
                 isEditing = true
                   ↓
                 ProfileEditForm を表示
                   ├─ 保存成功 → updateProfile → isEditing = false → UserProfileView に戻る
                   └─ キャンセル → isEditing = false → UserProfileView に戻る
```

**実装詳細**:

```typescript
'use client';

// TODO: 認証基盤導入後に差し替え
function getCurrentUserId(): string {
  return 'current-user-id';
}

export default function ProfilePage() {
  const userId = getCurrentUserId();
  const { profile, loading, error, updateProfile } = useUserProfile(userId);
  const [isEditing, setIsEditing] = useState(false);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!profile) return <div>プロフィールが見つかりません</div>;

  const handleSave = async (data: Partial<UserProfile>) => {
    await updateProfile(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <ProfileEditForm
        profile={profile}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div>
      <UserProfileView
        profile={profile}
        editable={true}
        onEdit={() => setIsEditing(true)}
      />
      <Link href="/settings/notifications">通知設定</Link>
    </div>
  );
}
```

---

## 8. 状態管理

### 8.1 コンポーネント間のデータフロー

```
useUserProfile（フック）
  ├─ profile, loading, error, updateProfile を返す
  └─ ProfilePage（ページ）
       ├─ loading → 「読み込み中...」
       ├─ error   → 「エラーが発生しました...」
       └─ isEditing = false
            └─ UserProfileView
                 ├─ Props: profile, editable=true, onEdit
                 └─ 「編集」クリック → isEditing = true
                      └─ ProfileEditForm
                           ├─ Props: profile, onSave, onCancel
                           ├─ 保存 → onSave(data) → updateProfile(data) → isEditing = false
                           └─ キャンセル → isEditing = false
```

### 8.2 エラーハンドリング

| レイヤー | エラー種別 | 対応 |
|---------|-----------|------|
| APIクライアント | HTTPエラー（4xx/5xx） | `Error('Failed to fetch/update profile: {status}')` をスロー |
| フック | 取得エラー | `error` 状態にセット、ページに伝達 |
| ページ | 取得エラー | ユーザーに `error.message` を表示（`エラーが発生しました: ...`） |
| フォーム | 保存エラー | `saveError` 状態にセット、フォーム内に表示 |
| フォーム | バリデーションエラー | `errors` 状態にセット、各フィールド下に表示 |

---

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/user.ts` | 型定義 | `User`, `UserProfile` インターフェース定義 |
| `src/api/client.ts` | APIクライアント | `getUserProfile`, `updateUserProfile` 実装 |
| `src/hooks/useUserProfile.ts` | フック | プロフィール取得・更新状態管理 |
| `src/components/UserProfileView.tsx` | コンポーネント | プロフィール閲覧コンポーネント |
| `src/components/UserProfileView.module.css` | スタイル | `UserProfileView` のスタイル |
| `src/components/ProfileEditForm.tsx` | コンポーネント | プロフィール編集フォームコンポーネント |
| `src/components/ProfileEditForm.module.css` | スタイル | `ProfileEditForm` のスタイル |
| `app/profile/page.tsx` | ページ | `/profile` ルートのページ |
| `src/api/__tests__/client.test.ts` | テスト | APIクライアントのユニットテスト |
| `src/hooks/__tests__/useUserProfile.test.ts` | テスト | `useUserProfile` のユニットテスト |
| `src/components/__tests__/UserProfileView.test.tsx` | テスト | `UserProfileView` のユニットテスト |
| `src/components/__tests__/ProfileEditForm.test.tsx` | テスト | `ProfileEditForm` のユニットテスト |
| `app/profile/__tests__/page.test.tsx` | テスト | プロフィールページの統合テスト |

### 9.2 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `app/layout.tsx` | スコープ外 |
| `src/types/notification.ts` | スコープ外 |
| `src/api/notificationClient.ts` | スコープ外 |
| `src/hooks/useNotificationSettings.ts` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/components/NotificationSettingsForm.tsx` | スコープ外 |
| `app/settings/notifications/page.tsx` | スコープ外 |
| `app/users/[id]/page.tsx` | スコープ外 |

---

## 10. テスト戦略

### 10.1 ユニットテスト対象モジュール

| テスト対象 | テストファイル | テスト方針 |
|-----------|---------------|-----------|
| `getUserProfile`, `updateUserProfile` | `src/api/__tests__/client.test.ts` | `fetch` をモック化し、正常系・エラー系・IDバリデーションを検証 |
| `useUserProfile` | `src/hooks/__tests__/useUserProfile.test.ts` | APIクライアントをモック化し、取得・更新・エラー・ID変更による再取得を検証 |
| `UserProfileView` | `src/components/__tests__/UserProfileView.test.tsx` | Testing Library でレンダリングし、表示内容・条件分岐・クリックイベントを検証 |
| `ProfileEditForm` | `src/components/__tests__/ProfileEditForm.test.tsx` | Testing Library でフォーム操作をシミュレートし、バリデーション・送信・エラー表示を検証 |
| `ProfilePage` | `app/profile/__tests__/page.test.tsx` | APIクライアントをモック化し、ローディング・表示・編集遷移・保存・エラーを統合的に検証 |

### 10.2 テストケース詳細

#### `client.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | `getUserProfile` 正常系 | 正しいURLへ `fetch` が呼ばれ、レスポンスが返ること |
| 2 | `getUserProfile` HTTPエラー | `Error('Failed to fetch profile: 404')` がスローされること |
| 3 | `getUserProfile` IDが空文字 | `Error('User ID is required')` がスローされること |
| 4 | `updateUserProfile` 正常系 | PATCH メソッドで正しいURLへリクエストが飛び、レスポンスが返ること |
| 5 | `updateUserProfile` HTTPエラー | `Error('Failed to update profile: 500')` がスローされること |
| 6 | `updateUserProfile` IDが空文字 | `Error('User ID is required')` がスローされること |

#### `useUserProfile.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | プロフィール正常取得 | `loading: true` → 取得完了後 `profile` がセットされ `loading: false` になること |
| 2 | APIエラー時 | `error` 状態にエラーオブジェクトがセットされること |
| 3 | `updateProfile` 正常更新 | 更新後 `profile` が最新値に更新されること |
| 4 | `updateProfile` 失敗時 | エラーがスローされること |
| 5 | ID変更時の再取得 | `rerender` で ID を変更すると再度 `getUserProfile` が呼ばれること |

#### `UserProfileView.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 全フィールド表示 | 名前・メール・bio・location・website・登録日が表示されること |
| 2 | オプショナルフィールドなし | bio・location・website セクションが非表示になること |
| 3 | `avatarUrl` 未設定 | デフォルト画像 `/default-avatar.png` が使われること |
| 4 | `editable=true` | 「プロフィールを編集」ボタンが表示されること |
| 5 | `editable=false` | 「プロフィールを編集」ボタンが非表示になること |
| 6 | `profile=null` | 「ユーザーが見つかりません」が表示されること |
| 7 | `profile=undefined` | 「ユーザーが見つかりません」が表示されること |
| 8 | プロトコルなしURL | `https://` が補完されてリンク生成されること |
| 9 | `https://` 付きURL | そのままリンク生成されること |
| 10 | `http://` 付きURL | そのままリンク生成されること |
| 11 | `createdAt` が文字列 | 正常に日付表示されること |
| 12 | `createdAt` が `null` | 「不明」が表示されること |
| 13 | `createdAt` が `undefined` | 「不明」が表示されること |
| 14 | `createdAt` が不正文字列 | 「不明」が表示されること |
| 15 | 編集ボタンクリック | `onEdit` が1回呼ばれること |

#### `ProfileEditForm.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | フォーム初期表示 | 既存プロフィール値がフォームに反映されること |
| 2 | メールアドレス読み取り専用 | メール入力欄が存在せず読み取り専用表示になること |
| 3 | 名前が空の場合 | 「名前は必須です」エラーが表示されること |
| 4 | bio が200文字超過 | bio エラーメッセージが表示されること |
| 5 | location が100文字超過 | location エラーメッセージが表示されること |
| 6 | websiteが `https://` 以外 | website エラーメッセージが表示されること |
| 7 | 正常送信 | `onSave` が正しいデータで呼ばれること |
| 8 | 保存中 | 保存ボタンが `disabled` になり「保存中...」と表示されること |
| 9 | API保存エラー | `saveError` メッセージがフォーム内に表示されること |
| 10 | キャンセルクリック | `onCancel` が1回呼ばれること |
| 11 | bio 文字数カウンター | 入力に応じてカウンターが更新されること |
| 12 | bio が180文字以上 | 警告スタイルが適用されること |

#### `page.test.tsx`（ProfilePage）

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ローディング中 | 「読み込み中...」が表示されること |
| 2 | プロフィール正常表示 | ユーザー名・メールが表示されること |
| 3 | APIエラー時 | 「エラーが発生しました」メッセージが表示されること |
| 4 | 編集ボタン押下 | 編集フォームに遷移すること |
| 5 | 保存後に閲覧モードに復帰 | 保存後に `UserProfileView` に戻ること |

### 10.3 Fake実装方針

```typescript
// APIクライアントのモック化（jest.mock を使用）
jest.mock('../../api/client');

const mockGetUserProfile = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
mockGetUserProfile.mockResolvedValue(mockProfile);

// fetch のモック化（APIクライアントのテスト）
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => mockProfile,
});
```

### 10.4 テストカバレッジ目標

- **目標**: 80% 以上（ステートメント・ブランチ・関数・行）
- **重点カバレッジ対象**:
  - `ProfileEditForm` のバリデーション分岐（100% を目指す）
  - `useUserProfile` の状態遷移（正常系・エラー系・再取得）
  - `UserProfileView` の条件付きレンダリング（null/undefined/各オプションフィールド）

---

## 11. セキュリティ考慮事項

### 11.1 外部入力のバリデーション方針

| 入力項目 | クライアントサイドバリデーション | サーバーサイドバリデーション |
|---------|--------------------------------|--------------------------|
| 名前 | 必須チェック（空白のみ不可） | API側でも必須チェックを行うこと |
| 自己紹介 | 200文字以内 | API側でも長さチェックを行うこと |
| 所在地 | 100文字以内 | API側でも長さチェックを行うこと |
| Webサイト | `https://` 始まりチェック | API側でもURL形式バリデーションを行うこと |

**注意事項**:
- クライアントサイドのバリデーションは UX 向上のためのもので、セキュリティ保護はサーバーサイドで担保する
- `<a href={url}>` に渡す URL は `ensureProtocol()` で正規化し、`javascript:` プロトコルによる XSS を防ぐ（現状 `https?://` 以外は `https://` を付与する実装）

### 11.2 秘密情報の管理方法

- `NEXT_PUBLIC_API_URL` は `.env.local` で管理し、リポジトリにコミットしない
- ユーザーIDは認証基盤導入まで暫定ハードコード（`current-user-id`）とし、本番環境での利用前に必ず差し替える
- APIトークン等の認証情報はフロントエンドのソースコードに埋め込まない

### 11.3 エラーメッセージの機密情報露出防止

- API エラー時のメッセージは `error.message` をそのまま表示しているため、サーバーが詳細なスタックトレース等を返さないよう API 側で制御する
- HTTPステータスコードは表示してよいが、内部エラーの詳細（DBエラー、スタックトレース等）は表示しない
- バリデーションエラーメッセージには内部情報（テーブル名、フィールド名等）を含めない

---

## 12. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 依存先 |
|------|----------|------|--------|
| 1 | `src/types/user.ts` | 型定義 | なし |
| 2 | `src/api/client.ts` | APIクライアント | 順序1 |
| 3 | `src/hooks/useUserProfile.ts` | フック | 順序1, 2 |
| 4 | `src/components/UserProfileView.tsx` + CSS | コンポーネント | 順序1 |
| 5 | `src/components/ProfileEditForm.tsx` + CSS | コンポーネント | 順序1 |
| 6 | `app/profile/page.tsx` | ページ | 順序3, 4, 5 |
| 7 | テストファイル群 | テスト | 順序2-6 |

**並列実装可能なグループ**:
- 順序4（`UserProfileView`）と 順序5（`ProfileEditForm`）は互いに独立しているため並列実装可能

---

## 13. 依存関係図

```
src/types/user.ts（型定義: User, UserProfile）
  ↓（参照）
src/api/client.ts（APIクライアント: getUserProfile, updateUserProfile）
  ↓（参照）
src/hooks/useUserProfile.ts（フック: プロフィール取得・更新）
  ↓                              ↑（参照）
src/components/UserProfileView.tsx ← src/types/user.ts
src/components/ProfileEditForm.tsx ← src/types/user.ts
  ↓（参照）
app/profile/page.tsx（ページ: 閲覧・編集モード管理）
```
