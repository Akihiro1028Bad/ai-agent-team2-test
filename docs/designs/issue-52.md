# 設計書: Issue #52 ユーザープロフィール表示機能の追加

## 1. 概要

既存のユーザープロフィール画面に対して、以下の機能追加・改善を行う。

- プロフィール画像のアップロード機能（S3 Presigned URL方式）
- バリデーション強化（名前の50文字制限）
- NextAuth.js による認証・認可の統合
- 他ユーザーのプロフィール編集を防ぐ認可チェック

### 1.1 背景

Issue #36 で基本的なプロフィール表示・編集機能が実装済みだが、以下が未実装のままである。

- アバター画像のアップロード機能
- 名前の文字数制限バリデーション
- 認証基盤との統合（現在はハードコードされたユーザーID）
- 認可チェック（誰でも誰のプロフィールを編集できてしまう問題）

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）のみ
- **対象外**: バックエンド（FastAPI）、DBマイグレーション（profiles テーブル）は別リポジトリ・別Issueで対応
- **APIメソッド**: 既存の `PATCH` に統一（Issueに記載の `PUT` は採用しない）
- **メールアドレス**: 表示のみ（編集不可）— 既存実装を維持

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | バックエンドスコープ | フロントエンドのみ。バックエンドは別リポジトリ |
| 2 | APIメソッド | PATCH に統一 |
| 3 | 名前の文字数制限 | 50文字上限 |
| 4 | メールアドレス編集 | 表示のみ（編集不可） |
| 5 | 画像サイズ上限 | 5MB |
| 6 | 画像フォーマット | JPEG / PNG / WebP |
| 7 | 画像リサイズ | フロント側で実施 |
| 8 | S3アップロード方式 | Presigned URL で直接アップロード |
| 9 | 既存フィールド | bio / location / website は引き続き含める |
| 10 | 認証 | NextAuth.js を使用 |
| 11 | 認可チェック | スコープに含める |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（アバターアップロード関連型追加） |
| **APIクライアント** | `src/api/client.ts` | `getUserProfile` / `updateUserProfile` (PATCH) 実装済み | ⚠️ 変更（Presigned URL取得関数追加） |
| **Hook** | `src/hooks/useUserProfile.ts` | プロフィール取得・更新済み | ✅ 変更なし |
| **表示コンポーネント** | `src/components/UserProfileView.tsx` | 名前・メール・アバター・bio等の表示済み | ✅ 変更なし |
| **編集フォーム** | `src/components/ProfileEditForm.tsx` | 名前・bio・location・website の編集済み。**アバターアップロード未実装** | ⚠️ 変更（アバターアップロードUI追加、名前50文字制限追加） |
| **自分のプロフィールページ** | `app/profile/page.tsx` | 表示・編集の切替済み。**認証はプレースホルダー** | ⚠️ 変更（NextAuth.js統合） |
| **他ユーザーページ** | `app/users/[id]/page.tsx` | 閲覧のみ。editable=false | ⚠️ 変更（認可チェック追加: 自分のプロフィールならeditable=true） |

### 2.2 既存の型定義

```typescript
// src/types/user.ts（現在）
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

### 2.3 既存のAPIクライアント

```typescript
// src/api/client.ts（現在）
getUser(id: string): Promise<User>                              // GET
getUserProfile(id: string): Promise<UserProfile>                // GET
updateUser(id: string, data: Partial<User>): Promise<User>      // PATCH
updateUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile>  // PATCH
```

## 3. 機能設計

### 3.1 アバター画像アップロード

#### フロー

```
[ユーザーが画像を選択]
  ↓
[フロント側でバリデーション]
  - ファイルサイズ: 5MB以下
  - フォーマット: JPEG / PNG / WebP
  ↓
[フロント側でリサイズ]
  - Canvas APIを使用
  - 最大 400x400px にリサイズ
  - アスペクト比を維持してクロップ
  ↓
[Presigned URL取得]
  - GET /api/users/{id}/avatar/presigned-url
  - レスポンス: { uploadUrl, avatarUrl }
  ↓
[S3に直接アップロード]
  - PUT uploadUrl (Content-Type: image/*)
  ↓
[プロフィール更新]
  - PATCH /api/users/{id}/profile { avatarUrl }
  ↓
[表示を更新]
```

#### 画像バリデーション仕様

| 項目 | 制約 | エラーメッセージ |
|------|------|-----------------|
| ファイルサイズ | 5MB以下 | `画像は5MB以下にしてください` |
| フォーマット | JPEG / PNG / WebP | `JPEG、PNG、WebP形式の画像を選択してください` |

#### リサイズ仕様

| 項目 | 値 |
|------|-----|
| 最大サイズ | 400 x 400 px |
| 方式 | アスペクト比維持、中央クロップ |
| 出力フォーマット | 元のフォーマットを維持（WebPの場合はWebP） |
| 品質 | 0.85 |

### 3.2 バリデーション強化

#### 変更前（現在）

| フィールド | バリデーション |
|-----------|---------------|
| name | 必須（空チェックのみ） |
| bio | 500文字以内 |
| location | 100文字以内 |
| website | `https://` で始まること |

#### 変更後

| フィールド | バリデーション | 変更点 |
|-----------|---------------|--------|
| name | 必須 + **50文字以内** | ⭐ 文字数制限追加 |
| bio | 500文字以内 | 変更なし |
| location | 100文字以内 | 変更なし |
| website | `https://` で始まること | 変更なし |

### 3.3 認証・認可

#### NextAuth.js 統合

- `useSession()` hookを使用してログインユーザーの情報を取得
- 未認証の場合は `/profile` ページでログインページへリダイレクト
- セッションから `user.id` を取得して `getCurrentUserId()` プレースホルダーを置換

#### 認可チェック

- `/profile` ページ: ログインユーザー自身のプロフィールのみ編集可能（既存動作を維持）
- `/users/[id]` ページ: ログインユーザーのIDと一致する場合 `editable={true}` に変更

## 4. コンポーネント設計

### 4.1 新規コンポーネント

#### `AvatarUpload` コンポーネント

```
src/components/AvatarUpload.tsx        ← 新規
src/components/AvatarUpload.module.css ← 新規
```

**責務**: アバター画像の表示・選択・プレビュー・アップロードを管理

**Props**:
```typescript
interface AvatarUploadProps {
  currentAvatarUrl?: string;
  userId: string;
  onUploadComplete: (avatarUrl: string) => void;
  onError: (error: string) => void;
}
```

**内部状態**:
- `preview`: 選択された画像のプレビューURL
- `isUploading`: アップロード中フラグ
- `uploadProgress`: アップロード進捗（0-100）

**UI構成**:
```
┌─────────────────────────┐
│   ┌───────────┐         │
│   │  アバター  │         │
│   │   画像    │         │
│   └───────────┘         │
│   [画像を変更]           │
│                         │
│   ※ JPEG/PNG/WebP      │
│     5MB以下             │
└─────────────────────────┘
```

### 4.2 新規Hook

#### `useAvatarUpload` Hook

```
src/hooks/useAvatarUpload.ts ← 新規
```

**責務**: 画像のバリデーション・リサイズ・Presigned URL取得・S3アップロードのロジックをカプセル化

**インターフェース**:
```typescript
export function useAvatarUpload(userId: string) {
  return {
    uploadAvatar: (file: File) => Promise<string>,  // アバターURLを返す
    isUploading: boolean,
    error: string | null,
  };
}
```

**内部処理フロー**:
1. `validateFile(file)` — サイズ・フォーマットチェック
2. `resizeImage(file)` — Canvas APIでリサイズ
3. `getPresignedUrl(userId)` — APIからPresigned URL取得
4. `uploadToS3(presignedUrl, resizedBlob)` — S3へアップロード
5. `avatarUrl` を返却

### 4.3 既存コンポーネントの変更

#### `ProfileEditForm.tsx` の変更

**変更内容**:
1. `AvatarUpload` コンポーネントをフォーム上部に追加
2. 名前のバリデーションに50文字制限を追加
3. `onAvatarChange` コールバックを追加

**変更後のProps**:
```typescript
interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
  // 以下は既存Propsに含まれないが、AvatarUploadコンポーネントが内部で処理するため追加不要
}
```

**バリデーション変更箇所**:
```typescript
// 変更前
if (!name.trim()) {
  newErrors.name = '名前は必須です';
}

// 変更後
if (!name.trim()) {
  newErrors.name = '名前は必須です';
} else if (name.trim().length > 50) {
  newErrors.name = '名前は50文字以内で入力してください';
}
```

#### `app/profile/page.tsx` の変更

**変更内容**: NextAuth.js の `useSession()` を使用して認証ユーザーIDを取得

```typescript
// 変更前
function getCurrentUserId(): string {
  return 'current-user-id';
}

// 変更後
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

// コンポーネント内で:
const { data: session, status } = useSession();
if (status === 'loading') return <div>読み込み中...</div>;
if (!session) {
  redirect('/api/auth/signin');
  return null;
}
const userId = session.user.id;
```

#### `app/users/[id]/page.tsx` の変更

**変更内容**: ログインユーザーと同一IDの場合は `editable={true}` にする

```typescript
// 変更前
return <UserProfileView profile={profile} editable={false} />;

// 変更後
import { useSession } from 'next-auth/react';

const { data: session } = useSession();
const isOwnProfile = session?.user?.id === id;

return (
  <UserProfileView
    profile={profile}
    editable={isOwnProfile}
    onEdit={isOwnProfile ? () => setIsEditing(true) : undefined}
  />
);
```

## 5. 型定義の変更

### 5.1 `src/types/user.ts` の追加

```typescript
// 既存の User / UserProfile は変更なし

// 新規追加
export interface PresignedUrlResponse {
  uploadUrl: string;    // S3 Presigned PUT URL
  avatarUrl: string;    // アップロード後の公開URL
}

export interface AvatarUploadOptions {
  maxSizeMB: number;           // 5
  allowedFormats: string[];    // ['image/jpeg', 'image/png', 'image/webp']
  maxDimension: number;        // 400
  quality: number;             // 0.85
}
```

## 6. API設計

### 6.1 追加するAPI関数

```typescript
// src/api/client.ts に追加

/**
 * アバターアップロード用の Presigned URL を取得する
 */
export async function getAvatarPresignedUrl(
  userId: string
): Promise<PresignedUrlResponse> {
  const res = await fetch(`${API_BASE}/users/${userId}/avatar/presigned-url`);
  if (!res.ok) throw new Error(`Failed to get presigned URL: ${res.status}`);
  return res.json();
}

/**
 * S3に画像を直接アップロードする
 */
export async function uploadAvatarToS3(
  presignedUrl: string,
  file: Blob,
  contentType: string
): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!res.ok) throw new Error(`Failed to upload avatar: ${res.status}`);
}
```

### 6.2 API呼び出しフロー

```
[アバターアップロード]
  AvatarUpload → useAvatarUpload
    → getAvatarPresignedUrl(userId)  → GET /api/users/:id/avatar/presigned-url
    → uploadAvatarToS3(url, blob)    → PUT <S3 Presigned URL>
    → updateUserProfile(id, { avatarUrl })  → PATCH /api/users/:id/profile

[認証]
  useSession() → NextAuth.js → GET /api/auth/session
```

## 7. 画像リサイズユーティリティ

### 7.1 新規ファイル

```
src/utils/imageResize.ts ← 新規
```

### 7.2 インターフェース

```typescript
/**
 * 画像ファイルを指定サイズにリサイズする
 * Canvas API を使用し、アスペクト比を維持して中央クロップ
 */
export async function resizeImage(
  file: File,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  // 1. FileをImageオブジェクトに変換
  // 2. Canvas に描画（中央クロップ）
  // 3. canvas.toBlob() で出力
}

/**
 * ファイルのバリデーション
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number,
  allowedFormats: string[]
): { valid: boolean; error?: string } {
  // サイズチェック、フォーマットチェック
}
```

## 8. 状態管理

### 8.1 画面の状態遷移（変更後）

```
[/profile ページ]
  認証チェック
    → 未認証 → ログインページへリダイレクト
    → 認証済み → Loading → 表示（閲覧モード）
      ⇄ 表示（編集モード）
        → アバターアップロード中 → アップロード完了
        → 保存中 → 表示（閲覧モード）
        → エラー → 表示（編集モード）

[/users/[id] ページ]
  Loading → 表示
    → 自分のプロフィール → editable=true（編集ボタン表示）
    → 他ユーザー → editable=false（閲覧のみ）
```

### 8.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `session` / `status` | `useSession()` | NextAuth.jsのセッション状態 |
| `profile` / `loading` / `error` | `useUserProfile()` | プロフィールデータの取得状態 |
| `isEditing` | ページコンポーネント | 編集モードかどうか |
| `isSaving` | `ProfileEditForm` | プロフィール更新API呼び出し中 |
| `isUploading` | `useAvatarUpload()` | 画像アップロード中 |
| `preview` | `AvatarUpload` | 選択された画像のプレビュー |

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/components/AvatarUpload.tsx` | コンポーネント | アバター画像アップロードUI |
| `src/components/AvatarUpload.module.css` | スタイル | アバターアップロードのスタイル |
| `src/hooks/useAvatarUpload.ts` | Hook | アバターアップロードロジック |
| `src/utils/imageResize.ts` | ユーティリティ | 画像リサイズ・バリデーション |
| `src/components/__tests__/AvatarUpload.test.tsx` | テスト | AvatarUploadのユニットテスト |
| `src/hooks/__tests__/useAvatarUpload.test.ts` | テスト | useAvatarUploadのユニットテスト |
| `src/utils/__tests__/imageResize.test.ts` | テスト | 画像リサイズのユニットテスト |

### 9.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `PresignedUrlResponse`, `AvatarUploadOptions` 型の追加 |
| `src/api/client.ts` | `getAvatarPresignedUrl`, `uploadAvatarToS3` 関数の追加 |
| `src/components/ProfileEditForm.tsx` | アバターアップロードUI統合、名前50文字制限追加 |
| `app/profile/page.tsx` | NextAuth.js `useSession()` 統合、認証チェック |
| `app/users/[id]/page.tsx` | 認可チェック追加（自分のプロフィールなら編集可能）、編集モードサポート |
| `src/components/__tests__/ProfileEditForm.test.tsx` | 名前50文字制限テスト追加、アバターアップロードテスト追加 |
| `app/profile/__tests__/page.test.tsx` | NextAuth.js モックによる認証テスト追加 |
| `app/users/[id]/__tests__/page.test.tsx` | 認可チェックのテスト追加 |

### 9.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/components/UserProfileView.tsx` | 表示ロジックに変更なし。`editable` propsの制御はページ側で行う |
| `src/components/UserProfileView.module.css` | スタイル変更なし |
| `src/hooks/useUserProfile.ts` | 取得・更新ロジックに変更なし |
| `src/hooks/useUser.ts` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |

## 10. 実装上の注意事項

### 10.1 NextAuth.js の導入

- `next-auth` パッケージのインストールが必要
- `SessionProvider` をルートレイアウト（`app/layout.tsx`）に追加
- NextAuth.js の設定ファイル（`app/api/auth/[...nextauth]/route.ts`）はバックエンドチームが提供する認証エンドポイントと連携する想定
- **本Issueでは NextAuth.js の初期設定（プロバイダー設定等）はスコープ外** — `useSession()` を呼び出す側のコードのみ実装する

### 10.2 Presigned URL の有効期限

- バックエンドが返す Presigned URL の有効期限（通常5-15分）を考慮し、アップロード時に期限切れの場合は再取得するロジックを組み込む
- ただし、有効期限のハンドリングの主要部分はバックエンド側の責務

### 10.3 画像リサイズの注意点

- `canvas.toBlob()` はブラウザAPIのため、テスト時はモック化が必要
- WebP形式の `toBlob()` はブラウザのサポート状況に依存するため、非対応ブラウザではPNG/JPEGにフォールバック
- リサイズ処理は非同期（`Promise<Blob>`）として実装

### 10.4 エラーハンドリング

- アバターアップロード失敗時: エラーメッセージを表示し、プロフィールの他のフィールドの編集は継続可能
- Presigned URL 取得失敗時: 「画像のアップロードに失敗しました。もう一度お試しください」を表示
- S3アップロード失敗時: 同上のメッセージ
- ネットワークエラー時: 汎用エラーメッセージ

### 10.5 パッケージ追加

```json
{
  "dependencies": {
    "next-auth": "^4.24.0"
  }
}
```

## 11. テスト方針

### 11.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `AvatarUpload` | `src/components/__tests__/AvatarUpload.test.tsx` | 画像選択UI表示 / プレビュー表示 / アップロード中の状態表示 / エラー表示 |
| `useAvatarUpload` | `src/hooks/__tests__/useAvatarUpload.test.ts` | Presigned URL取得 / S3アップロード / バリデーションエラー / アップロードエラー |
| `imageResize` | `src/utils/__tests__/imageResize.test.ts` | ファイルバリデーション（サイズ超過、不正フォーマット）/ リサイズ処理のモック確認 |
| `ProfileEditForm` | `src/components/__tests__/ProfileEditForm.test.tsx` | **追加**: 名前50文字超過でバリデーションエラー / アバターアップロードUIの統合表示 |

### 11.2 結合テスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `/profile` ページ | `app/profile/__tests__/page.test.tsx` | **追加**: 未認証時のリダイレクト / 認証済みユーザーのプロフィール表示 |
| `/users/[id]` ページ | `app/users/[id]/__tests__/page.test.tsx` | **追加**: 自分のIDでアクセス時に編集ボタン表示 / 他ユーザーIDでは非表示 |

### 11.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-52/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | アバターアップロード画面 | `avatar-upload-ui.png` |
| 2 | アバターアップロード成功 | `avatar-upload-success.png` |
| 3 | 画像バリデーションエラー（サイズ超過） | `avatar-validation-size.png` |
| 4 | 画像バリデーションエラー（不正フォーマット） | `avatar-validation-format.png` |
| 5 | 名前50文字制限エラー | `name-validation-length.png` |
| 6 | 未認証時のリダイレクト | `auth-redirect.png` |
| 7 | 他ユーザーページ（自分）で編集ボタン表示 | `users-own-editable.png` |
| 8 | 他ユーザーページ（他人）で編集ボタン非表示 | `users-other-readonly.png` |

## 12. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/utils/imageResize.ts` | ユーティリティ | 新規 | なし |
| 3 | `src/api/client.ts` | API | 変更 | 順序1 |
| 4 | `src/hooks/useAvatarUpload.ts` | Hook | 新規 | 順序2, 3 |
| 5 | `src/components/AvatarUpload.tsx` + CSS | コンポーネント | 新規 | 順序4 |
| 6 | `src/components/ProfileEditForm.tsx` | コンポーネント | 変更 | 順序5 |
| 7 | `app/profile/page.tsx` | ページ | 変更 | NextAuth.js |
| 8 | `app/users/[id]/page.tsx` | ページ | 変更 | NextAuth.js |
| 9 | テスト追加・更新 | テスト | 変更/新規 | 順序1-8 |

**並列実装可能なグループ**:
- 順序1 と 順序2 は互いに独立しているため並列実装可能
- 順序7 と 順序8 は互いに独立しているため並列実装可能

## 13. 依存関係図

```
src/types/user.ts（変更: 型追加）
  ↓
src/utils/imageResize.ts（新規）
  ↓
src/api/client.ts（変更: Presigned URL関連追加）
  ↓
src/hooks/useAvatarUpload.ts（新規）
  ↓
src/components/AvatarUpload.tsx + CSS（新規）
  ↓
src/components/ProfileEditForm.tsx（変更: アバターUI統合 + バリデーション強化）
  ↓
app/profile/page.tsx（変更: NextAuth.js統合）
app/users/[id]/page.tsx（変更: 認可チェック追加）
```
