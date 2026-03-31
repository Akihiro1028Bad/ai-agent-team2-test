# 実装計画: Issue #34 - プロフィール画面の実装

## 1. 変更ファイル一覧と実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 依存先 |
|------|---------|------|--------|
| 1 | `src/types/user.ts` | 変更 | なし |
| 2 | `src/api/client.ts` | 変更 | `src/types/user.ts` |
| 3 | `src/hooks/useUserProfile.ts` | 新規 | `src/types/user.ts`, `src/api/client.ts` |
| 4 | `src/components/ProfileView.tsx` | 新規 | `src/types/user.ts` |
| 5 | `src/components/ProfileEditForm.tsx` | 新規 | `src/types/user.ts` |
| 6 | `app/layout.tsx` | 新規 | なし |
| 7 | `app/profile/[id]/page.tsx` | 新規 | 上記すべて |

> **ポイント**: 順序 1〜2 は基盤レイヤー、3 はデータ取得レイヤー、4〜5 はUIレイヤー、6〜7 はルーティングレイヤーに対応する。下位レイヤーから順に実装することで、各ステップでの動作確認が容易になる。

---

## 2. 各ファイルの変更内容

### 2.1. `src/types/user.ts`（変更）

**変更内容**: `UserProfileUpdateInput` インターフェースを追加する。

```typescript
// 既存の User, UserProfile はそのまま維持

// ===== 以下を追加 =====
export interface UserProfileUpdateInput {
  bio?: string;
  location?: string;
  website?: string;
}
```

**変更理由**: プロフィール更新 API のリクエストボディ型を定義する。編集可能な 3 フィールド（`bio`, `location`, `website`）を optional で保持する。

---

### 2.2. `src/api/client.ts`（変更）

**変更内容**: `updateUserProfile` 関数を追加する。

```typescript
// import に UserProfileUpdateInput を追加
import { User, UserProfile, UserProfileUpdateInput } from '../types/user';

// ===== 既存の updateUser の後に追加 =====
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

**変更理由**: 既存の `getUser` / `updateUser` のパターン（fetch → ok チェック → json 返却）に統一し、PATCH `/users/:id/profile` を呼び出す関数を追加する。

---

### 2.3. `src/hooks/useUserProfile.ts`（新規作成）

**概要**: プロフィール取得・更新のステート管理を行うカスタムフック。既存の `useUser` フックのパターンを踏襲する。

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

**設計ポイント**:
- `loading`: 初回データ取得中の状態
- `updating`: 更新リクエスト中の状態（保存ボタンの disabled 制御に使用）
- `updateProfile`: 更新成功時に `profile` ステートを即座に反映し、UIの再レンダリングを発火

---

### 2.4. `src/components/ProfileView.tsx`（新規作成）

**概要**: プロフィール情報を閲覧表示するコンポーネント。`UserCard` のスタイルパターンに合わせる。

```typescript
import React from 'react';
import { UserProfile } from '../types/user';

interface ProfileViewProps {
  profile: UserProfile;
  onEdit: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onEdit }) => {
  const formattedDate = new Date(profile.createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return (
    <div className="profile-view">
      <div className="profile-header">
        <img
          src={profile.avatarUrl || '/default-avatar.png'}
          alt={profile.name}
          className="profile-avatar"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/default-avatar.png';
          }}
        />
        <h2>{profile.name}</h2>
        <p className="profile-email">{profile.email}</p>
      </div>

      <div className="profile-details">
        <div className="profile-field">
          <span className="profile-label">自己紹介</span>
          <p>{profile.bio || '未設定'}</p>
        </div>
        <div className="profile-field">
          <span className="profile-label">📍 所在地</span>
          <p>{profile.location || '未設定'}</p>
        </div>
        <div className="profile-field">
          <span className="profile-label">🔗 Webサイト</span>
          {profile.website ? (
            <a href={profile.website} target="_blank" rel="noopener noreferrer">
              {profile.website}
            </a>
          ) : (
            <p>未設定</p>
          )}
        </div>
        <div className="profile-field">
          <span className="profile-label">登録日</span>
          <p>{formattedDate}</p>
        </div>
      </div>

      <button className="profile-edit-button" onClick={onEdit}>
        編集
      </button>
    </div>
  );
};
```

**設計ポイント**:
- `UserCard` と同様に `React.FC` + props パターンで実装
- アバター画像の `onError` ハンドラでフォールバック（リスク対策）
- 未設定フィールドは「未設定」プレースホルダを表示
- `website` はリンクとして表示（`target="_blank"` + `rel="noopener noreferrer"`）
- 編集ボタンは自分/他人問わず常に表示（ヒアリング結果に準拠）

---

### 2.5. `src/components/ProfileEditForm.tsx`（新規作成）

**概要**: `bio` / `location` / `website` の 3 フィールドを編集するフォームコンポーネント。

```typescript
import React, { useState } from 'react';
import { UserProfileUpdateInput } from '../types/user';

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

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
  initialValues,
  onSave,
  onCancel,
  saving,
}) => {
  const [bio, setBio] = useState(initialValues.bio || '');
  const [location, setLocation] = useState(initialValues.location || '');
  const [website, setWebsite] = useState(initialValues.website || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (bio.length > 500) {
      newErrors.bio = '自己紹介は500文字以内で入力してください';
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      newErrors.website = '有効なURL（http:// または https://）を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave({ bio, location, website });
  };

  return (
    <form className="profile-edit-form" onSubmit={handleSubmit}>
      <div className="form-field">
        <label htmlFor="bio">自己紹介</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="自己紹介を入力してください"
        />
        <span className="char-count">{bio.length}/500</span>
        {errors.bio && <span className="error">{errors.bio}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="location">所在地</label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="例: Tokyo, Japan"
        />
      </div>

      <div className="form-field">
        <label htmlFor="website">Webサイト</label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="例: https://example.com"
        />
        {errors.website && <span className="error">{errors.website}</span>}
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          キャンセル
        </button>
      </div>
    </form>
  );
};
```

**設計ポイント**:
- バリデーション: `bio` は 500 文字制限、`website` は URL 形式チェック
- 保存中（`saving=true`）は保存・キャンセル両ボタンを disabled にし「保存中...」表示
- フォーム送信は `onSubmit` で制御（Enter キーでの送信に対応）

---

### 2.6. `app/layout.tsx`（新規作成）

**概要**: App Router に必要な最小限のルートレイアウト。

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

**注意**: `app/` ディレクトリの新規作成により App Router が有効化される。既存の `src/` 配下のコード構成には影響を与えない。

---

### 2.7. `app/profile/[id]/page.tsx`（新規作成）

**概要**: プロフィール画面のページコンポーネント。閲覧モードと編集モードを切り替える。

```typescript
'use client';

import React, { useState } from 'react';
import { useUserProfile } from '../../../src/hooks/useUserProfile';
import { ProfileView } from '../../../src/components/ProfileView';
import { ProfileEditForm } from '../../../src/components/ProfileEditForm';
import { UserProfileUpdateInput } from '../../../src/types/user';

interface PageProps {
  params: { id: string };
}

export default function ProfilePage({ params }: PageProps) {
  const { profile, loading, error, updating, updateProfile } = useUserProfile(params.id);
  const [isEditing, setIsEditing] = useState(false);

  if (loading) {
    return <div className="profile-loading">読み込み中...</div>;
  }

  if (error) {
    return <div className="profile-error">エラーが発生しました: {error.message}</div>;
  }

  if (!profile) {
    return <div className="profile-error">ユーザーが見つかりません</div>;
  }

  const handleSave = async (data: UserProfileUpdateInput) => {
    await updateProfile(data);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="profile-page">
        <h1>プロフィール編集</h1>
        <ProfileEditForm
          initialValues={{
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
          }}
          onSave={handleSave}
          onCancel={() => setIsEditing(false)}
          saving={updating}
        />
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1>プロフィール</h1>
      <ProfileView profile={profile} onEdit={() => setIsEditing(true)} />
    </div>
  );
}
```

**状態遷移**:
```
初期アクセス → loading=true → 「読み込み中...」表示
                ↓
           loading=false
                ↓
         error あり → エラーメッセージ表示
         profile null → 「ユーザーが見つかりません」表示
         正常取得 → ProfileView（閲覧モード）
                        ↓ 編集ボタン押下
                   ProfileEditForm（編集モード）
                        ↓ 保存成功 / キャンセル
                   ProfileView（閲覧モード）に戻る
```

---

## 3. 依存関係グラフ

```
src/types/user.ts （Step 1: 基盤）
    ↓
src/api/client.ts （Step 2: API層）
    ↓
src/hooks/useUserProfile.ts （Step 3: データ取得層）
    ↓
src/components/ProfileView.tsx （Step 4: UI層 - 閲覧）
src/components/ProfileEditForm.tsx （Step 5: UI層 - 編集）
    ↓
app/layout.tsx （Step 6: ルーティング基盤）
app/profile/[id]/page.tsx （Step 7: ページ統合）
```

> Step 4 と Step 5 は互いに依存しないため並行実装可能。Step 6 も独立しているため Step 3 完了後に並行で着手可能。

---

## 4. テスト方針

### 4.1. ユニットテスト

| テストファイル | 対象 | テストケース |
|--------------|------|-------------|
| `src/hooks/__tests__/useUserProfile.test.ts` | `useUserProfile` | - 初回取得時に `loading=true` → 取得成功後 `loading=false`, `profile` にデータがセットされる |
| | | - API エラー時に `error` がセットされる |
| | | - `updateProfile` 呼び出し時に `updating=true` → 成功後 `updating=false`, `profile` が更新される |
| | | - `updateProfile` 失敗時に `error` がセットされ、例外が throw される |
| `src/components/__tests__/ProfileView.test.tsx` | `ProfileView` | - 全フィールドが正しくレンダリングされる |
| | | - 未設定フィールド（`bio`, `location`, `website` が undefined）で「未設定」が表示される |
| | | - `avatarUrl` 未設定時にデフォルト画像が使用される |
| | | - 登録日が `YYYY/MM/DD` 形式で表示される |
| | | - 編集ボタンクリックで `onEdit` が呼ばれる |
| `src/components/__tests__/ProfileEditForm.test.tsx` | `ProfileEditForm` | - 初期値がフォームに反映される |
| | | - `bio` 500 文字超でバリデーションエラーが表示される |
| | | - `website` に不正な URL を入力するとバリデーションエラーが表示される |
| | | - 正常入力時に保存ボタンクリックで `onSave` が正しい引数で呼ばれる |
| | | - キャンセルボタンクリックで `onCancel` が呼ばれる |
| | | - `saving=true` 時にボタンが disabled になり「保存中...」が表示される |

### 4.2. テスト実行コマンド

```bash
npm test
```

### 4.3. テスト環境の前提

- Jest（`package.json` で設定済み）
- React Testing Library の追加が必要になる可能性あり（`package.json` の `devDependencies` を確認し、不足していれば追加）

---

## 5. 注意事項・リスク対策

| 項目 | 対策 |
|------|------|
| PATCH API がバックエンド未実装の可能性 | フロントエンドを先行実装し、モックデータで動作確認する。API エラー時のハンドリングも実装済みとする |
| `app/` ディレクトリ新規作成の影響 | Next.js 14 は `app/` と `pages/` の共存をサポートしている。既存の `src/` 構成には影響なし |
| 認証なしでの編集ボタン表示 | ヒアリング結果に基づき暫定対応。将来の認証実装時に制御を追加する |
| React Testing Library 未導入 | テスト実装フェーズで `@testing-library/react` と `@testing-library/jest-dom` の追加を検討する |
