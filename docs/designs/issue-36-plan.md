# 実装計画: Issue #36 ユーザープロフィール画面の追加

## 1. 実装概要

設計書 `docs/designs/issue-36.md` に基づき、ユーザープロフィール画面（閲覧・編集）を実装する。
既存コードの型定義・APIクライアント・Hookパターンを踏襲し、App Router によるページを新規追加する。

## 2. 変更ファイル一覧と実装順序

依存関係に基づき、以下の順序で実装する。下流のファイルが上流のファイルに依存するため、番号順に実装すること。

| 順序 | ファイルパス | 種別 | 新規/変更 | 依存先 |
|------|-------------|------|-----------|--------|
| 1 | `src/api/client.ts` | API | 変更 | `src/types/user.ts`（変更なし） |
| 2 | `src/hooks/useUserProfile.ts` | Hook | 新規 | `src/api/client.ts`, `src/types/user.ts` |
| 3 | `src/components/UserProfileView.module.css` | スタイル | 新規 | なし |
| 4 | `src/components/UserProfileView.tsx` | コンポーネント | 新規 | `src/types/user.ts` |
| 5 | `src/components/ProfileEditForm.module.css` | スタイル | 新規 | なし |
| 6 | `src/components/ProfileEditForm.tsx` | コンポーネント | 新規 | `src/types/user.ts` |
| 7 | `app/layout.tsx` | ページ | 新規 | なし |
| 8 | `app/profile/page.tsx` | ページ | 新規 | Hook(2), コンポーネント(4,6) |
| 9 | `app/users/[id]/page.tsx` | ページ | 新規 | Hook(2), コンポーネント(4) |

### 変更なしのファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | 既存の `User` / `UserProfile` 型で全要件を網羅済み |
| `src/components/UserCard.tsx` | 今回のスコープ外 |
| `src/hooks/useUser.ts` | 変更不要。新規 `useUserProfile` で対応 |

## 3. 各ファイルの変更内容

### 3.1 `src/api/client.ts`（変更）

**変更内容**: `updateUserProfile` 関数を末尾に追加する。

```typescript
// 既存コードの末尾に追加
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

**確認ポイント**:
- 既存の `updateUser` と同じエラーハンドリングパターンを踏襲
- `UserProfile` 型のインポートは既存のインポート文に含まれている

---

### 3.2 `src/hooks/useUserProfile.ts`（新規）

**目的**: プロフィールの取得・更新を管理するカスタムHook。

```typescript
import { useState, useEffect } from 'react';
import { UserProfile } from '../types/user';
import { getUserProfile, updateUserProfile } from '../api/client';

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

**確認ポイント**:
- 既存 `useUser` のパターン（`useState` + `useEffect`）を踏襲
- `updateProfile` を追加で返すことで編集機能をサポート
- `useEffect` 内で `setError(null)` をリセットし、再取得時にエラー状態をクリア

---

### 3.3 `src/components/UserProfileView.module.css`（新規）

**目的**: プロフィール表示コンポーネントのスタイル。

```css
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
}

.name {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 4px 0;
}

.email {
  color: #666;
  margin: 0;
}

.section {
  margin-bottom: 16px;
}

.label {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.value {
  font-size: 16px;
  margin: 0;
}

.editButton {
  margin-top: 24px;
  padding: 8px 24px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.editButton:hover {
  background: #005bb5;
}

.meta {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
  font-size: 14px;
  color: #888;
}
```

---

### 3.4 `src/components/UserProfileView.tsx`（新規）

**目的**: プロフィール情報の表示を担当する presentational コンポーネント。

```typescript
import React from 'react';
import { UserProfile } from '../types/user';
import styles from './UserProfileView.module.css';

interface UserProfileViewProps {
  profile: UserProfile;
  editable: boolean;
  onEdit?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  profile,
  editable,
  onEdit,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img
          className={styles.avatar}
          src={profile.avatarUrl || '/default-avatar.png'}
          alt={profile.name}
        />
        <div>
          <h1 className={styles.name}>{profile.name}</h1>
          <p className={styles.email}>{profile.email}</p>
        </div>
      </div>

      {profile.bio && (
        <div className={styles.section}>
          <div className={styles.label}>自己紹介</div>
          <p className={styles.value}>{profile.bio}</p>
        </div>
      )}

      {profile.location && (
        <div className={styles.section}>
          <div className={styles.label}>所在地</div>
          <p className={styles.value}>{profile.location}</p>
        </div>
      )}

      {profile.website && (
        <div className={styles.section}>
          <div className={styles.label}>Webサイト</div>
          <p className={styles.value}>
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          </p>
        </div>
      )}

      <div className={styles.meta}>
        登録日: {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
      </div>

      {editable && (
        <button className={styles.editButton} onClick={onEdit}>
          プロフィールを編集
        </button>
      )}
    </div>
  );
};
```

**確認ポイント**:
- `editable` prop により編集ボタンの表示/非表示を制御
- オプショナルフィールド（`bio`, `location`, `website`）は値がある場合のみ表示
- `createdAt` は `ja-JP` ロケールでフォーマット

---

### 3.5 `src/components/ProfileEditForm.module.css`（新規）

**目的**: 編集フォームのスタイル。

```css
.form {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

.title {
  font-size: 20px;
  margin-bottom: 24px;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}

.field input,
.field textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.field textarea {
  min-height: 100px;
  resize: vertical;
}

.fieldError {
  color: #e00;
  font-size: 12px;
  margin-top: 4px;
}

.readOnly {
  color: #888;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.saveButton {
  padding: 8px 24px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.saveButton:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancelButton {
  padding: 8px 24px;
  background: white;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.errorMessage {
  color: #e00;
  margin-top: 16px;
  padding: 8px 12px;
  background: #fff0f0;
  border-radius: 6px;
}
```

---

### 3.6 `src/components/ProfileEditForm.tsx`（新規）

**目的**: プロフィール編集フォームコンポーネント。

```typescript
'use client';

import React, { useState } from 'react';
import { UserProfile } from '../types/user';
import styles from './ProfileEditForm.module.css';

interface ProfileEditFormProps {
  profile: UserProfile;
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
}

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  profile,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [website, setWebsite] = useState(profile.website || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const validate = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = '名前は必須です';
    }
    if (bio.length > 500) {
      newErrors.bio = '自己紹介は500文字以内で入力してください';
    }
    if (location.length > 100) {
      newErrors.location = '所在地は100文字以内で入力してください';
    }
    if (website && !website.startsWith('https://')) {
      newErrors.website = 'URLは https:// で始めてください';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave({
        name: name.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : '保存に失敗しました'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>プロフィール編集</h2>

      <div className={styles.field}>
        <label htmlFor="name">名前 *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && <div className={styles.fieldError}>{errors.name}</div>}
      </div>

      <div className={styles.field}>
        <label>メールアドレス</label>
        <div className={styles.readOnly}>{profile.email}</div>
      </div>

      <div className={styles.field}>
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
        />
        {errors.bio && <div className={styles.fieldError}>{errors.bio}</div>}
      </div>

      <div className={styles.field}>
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
        />
        {errors.location && (
          <div className={styles.fieldError}>{errors.location}</div>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://example.com"
        />
        {errors.website && (
          <div className={styles.fieldError}>{errors.website}</div>
        )}
      </div>

      <div className={styles.field}>
        <label>登録日</label>
        <div className={styles.readOnly}>
          {new Date(profile.createdAt).toLocaleDateString('ja-JP')}
        </div>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSaving}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
};
```

**確認ポイント**:
- `email`, `createdAt` は読み取り専用として表示
- バリデーション: `name` 必須、`website` は `https://` 形式、`bio` 500文字、`location` 100文字
- 保存失敗時はフォームを維持し、エラーメッセージを表示してリトライ可能
- `isSaving` 状態でボタンを `disabled` にして二重送信を防止

---

### 3.7 `app/layout.tsx`（新規）

**目的**: App Router のルートレイアウト（Server Component）。

```typescript
import React from 'react';

export const metadata = {
  title: 'Sample App',
  description: 'Next.js + TypeScript サンプルアプリケーション',
};

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

**確認ポイント**:
- Server Component として実装（`'use client'` なし）
- `lang="ja"` で日本語ロケールを指定

---

### 3.8 `app/profile/page.tsx`（新規）

**目的**: ログインユーザー自身のプロフィールページ（閲覧・編集）。

```typescript
'use client';

import React, { useState } from 'react';
import { useUserProfile } from '../../src/hooks/useUserProfile';
import { UserProfileView } from '../../src/components/UserProfileView';
import { ProfileEditForm } from '../../src/components/ProfileEditForm';
import { UserProfile } from '../../src/types/user';

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
    <UserProfileView
      profile={profile}
      editable={true}
      onEdit={() => setIsEditing(true)}
    />
  );
}
```

**確認ポイント**:
- `'use client'` ディレクティブ（`useState` / `useEffect` 使用のため）
- `getCurrentUserId()` はプレースホルダー実装（認証基盤導入後に差し替え）
- 状態遷移: Loading → 閲覧モード ⇄ 編集モード → 保存中 → 閲覧モード

---

### 3.9 `app/users/[id]/page.tsx`（新規）

**目的**: 他ユーザーのプロフィール閲覧ページ。

```typescript
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useUserProfile } from '../../../src/hooks/useUserProfile';
import { UserProfileView } from '../../../src/components/UserProfileView';

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { profile, loading, error } = useUserProfile(id);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!profile) return <div>ユーザーが見つかりません</div>;

  return <UserProfileView profile={profile} editable={false} />;
}
```

**確認ポイント**:
- `useParams()` で URL パラメータ `id` を取得
- `editable={false}` で編集ボタンを非表示
- 閲覧専用のため `ProfileEditForm` は不要

## 4. 依存関係図

```
src/types/user.ts（変更なし）
  ↓
src/api/client.ts（変更: updateUserProfile 追加）  ── 順序 1
  ↓
src/hooks/useUserProfile.ts（新規）                 ── 順序 2
  ↓
src/components/UserProfileView.tsx + CSS（新規）     ── 順序 3
src/components/ProfileEditForm.tsx + CSS（新規）     ── 順序 4
  ↓
app/layout.tsx（新規）                               ── 順序 5
  ↓
app/profile/page.tsx（新規）                         ── 順序 6
app/users/[id]/page.tsx（新規）                      ── 順序 7
```

**並列実装可能なグループ**:
- 順序 3 と 順序 4 は互いに独立しているため並列実装可能
- 順序 6 と 順序 7 は互いに独立しているため並列実装可能

## 5. テスト方針

### 5.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserProfile` | `src/hooks/__tests__/useUserProfile.test.ts` | プロフィール取得の正常系（データが返る）/ 異常系（エラー状態）/ `updateProfile` による更新成功・失敗 |
| `UserProfileView` | `src/components/__tests__/UserProfileView.test.tsx` | 全フィールドの表示確認 / オプショナルフィールド非表示 / `editable=true` で編集ボタン表示 / `editable=false` で非表示 / `onEdit` コールバック発火 |
| `ProfileEditForm` | `src/components/__tests__/ProfileEditForm.test.tsx` | 初期値の表示 / `email`, `createdAt` が読み取り専用 / バリデーション（`name` 空、`website` 不正、`bio` 500文字超、`location` 100文字超）/ 保存成功時の `onSave` 呼び出し / 保存失敗時のエラー表示 / `isSaving` 中のボタン無効化 / キャンセル時の `onCancel` 呼び出し |

### 5.2 結合テスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `/profile` ページ | `app/profile/__tests__/page.test.tsx` | ローディング表示 → プロフィール表示 / 編集ボタン押下で編集モード遷移 / 保存で閲覧モード復帰 / APIエラー時のエラー表示 |
| `/users/[id]` ページ | `app/users/[id]/__tests__/page.test.tsx` | URLパラメータからのプロフィール取得・表示 / 編集ボタンが非表示 / 存在しないユーザーの404表示 |

### 5.3 テスト実行コマンド

```bash
npm test
```

### 5.4 テストエビデンス

設計書 Section 11.2 に記載の通り、以下のスクリーンショットを `docs/evidence/issue-36/` に保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | プロフィール表示画面（自分） | `profile-view-own.png` |
| 2 | プロフィール表示画面（他ユーザー） | `profile-view-other.png` |
| 3 | プロフィール編集モード | `profile-edit-mode.png` |
| 4 | プロフィール編集保存成功 | `profile-edit-success.png` |
| 5 | バリデーションエラー表示 | `profile-edit-validation-error.png` |
| 6 | API エラー表示 | `profile-error.png` |
| 7 | ローディング状態 | `profile-loading.png` |
| 8 | ユーザー未発見（404） | `profile-not-found.png` |

## 6. 実装チェックリスト

- [ ] `src/api/client.ts` に `updateUserProfile` 関数を追加
- [ ] `src/hooks/useUserProfile.ts` を新規作成
- [ ] `src/components/UserProfileView.module.css` を新規作成
- [ ] `src/components/UserProfileView.tsx` を新規作成
- [ ] `src/components/ProfileEditForm.module.css` を新規作成
- [ ] `src/components/ProfileEditForm.tsx` を新規作成
- [ ] `app/layout.tsx` を新規作成
- [ ] `app/profile/page.tsx` を新規作成
- [ ] `app/users/[id]/page.tsx` を新規作成
- [ ] ユニットテストを作成・実行
- [ ] 結合テストを作成・実行
- [ ] テストエビデンスを保存
