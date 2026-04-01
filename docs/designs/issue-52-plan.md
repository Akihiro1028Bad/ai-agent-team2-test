# 実装計画: Issue #52 ユーザープロフィール表示機能の追加

## 1. 実装概要

設計書 `docs/designs/issue-36.md` に基づき、ユーザープロフィール画面（閲覧・編集）を実装する。
既存コードの型定義・APIクライアント・Hookパターンを踏襲し、App Router によるページを新規追加する。

### 1.1 現状分析

Issue #36 の設計・実装により、以下の基盤がすでに整備されている。

| 区分 | ファイル | 状態 |
|------|---------|------|
| 型定義 | `src/types/user.ts` | ✅ `User` / `UserProfile` 定義済み |
| API | `src/api/client.ts` | ✅ `getUserProfile` / `updateUserProfile` 実装済み |
| Hook | `src/hooks/useUserProfile.ts` | ✅ 実装済み |
| コンポーネント | `src/components/UserProfileView.tsx` | ✅ 実装済み |
| コンポーネント | `src/components/ProfileEditForm.tsx` | ✅ 実装済み |
| スタイル | `*.module.css`（2ファイル） | ✅ 実装済み |
| ページ | `app/layout.tsx` | ✅ 実装済み |
| ページ | `app/profile/page.tsx` | ✅ 実装済み |
| ページ | `app/users/[id]/page.tsx` | ✅ 実装済み |
| テスト | 全5ファイル | ✅ 実装済み |

### 1.2 Issue #52 で対応する項目

設計書のレビューおよび既存実装の精査を行った結果、以下の改善・追加が必要である。

| # | 項目 | 理由 |
|---|------|------|
| 1 | `useUserProfile` のエラー時リトライ機能 | 設計書 10.3 にリトライ可能と記載があるが、Hook レベルでの `refetch` 関数が未提供 |
| 2 | `/users/[id]` ページの 404 専用表示 | 設計書 10.3 に「ユーザーが見つからない場合（404）は専用メッセージを表示する」とあるが、現在は汎用エラーメッセージのみ |
| 3 | `ProfileEditForm` の `onSave` 戻り値型の整合 | `onSave` の型が `Promise<void>` だが、`handleSave` では `updateProfile` の戻り値（`UserProfile`）を返す。型の不整合を修正 |
| 4 | テストカバレッジの拡充 | 設計書 11.1 に記載されているが未実装のテストケースを追加 |
| 5 | テストエビデンスの保存 | 設計書 11.2 に記載のスクリーンショットが `docs/evidence/issue-52/` に未保存 |

## 2. 変更ファイル一覧と実装順序

依存関係に基づき、以下の順序で実装する。下流のファイルが上流のファイルに依存するため、番号順に実装すること。

| 順序 | ファイルパス | 種別 | 新規/変更 | 依存先 |
|------|-------------|------|-----------|--------|
| 1 | `src/hooks/useUserProfile.ts` | Hook | 変更 | `src/api/client.ts` |
| 2 | `src/components/ProfileEditForm.tsx` | コンポーネント | 変更 | `src/types/user.ts` |
| 3 | `app/users/[id]/page.tsx` | ページ | 変更 | Hook(1), コンポーネント |
| 4 | `app/profile/page.tsx` | ページ | 変更 | Hook(1), コンポーネント(2) |
| 5 | `src/hooks/__tests__/useUserProfile.test.ts` | テスト | 変更 | Hook(1) |
| 6 | `src/components/__tests__/ProfileEditForm.test.tsx` | テスト | 変更 | コンポーネント(2) |
| 7 | `app/users/[id]/__tests__/page.test.tsx` | テスト | 変更 | ページ(3) |
| 8 | `app/profile/__tests__/page.test.tsx` | テスト | 変更 | ページ(4) |

### 変更なしのファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | 既存の `User` / `UserProfile` 型で全要件を網羅済み |
| `src/api/client.ts` | `getUserProfile` / `updateUserProfile` とも実装済み |
| `src/components/UserProfileView.tsx` | 設計通りに実装済み、変更不要 |
| `src/components/UserProfileView.module.css` | 変更不要 |
| `src/components/ProfileEditForm.module.css` | 変更不要 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/hooks/useUser.ts` | 変更不要 |
| `app/layout.tsx` | 変更不要 |

## 3. 各ファイルの変更内容

### 3.1 `src/hooks/useUserProfile.ts`（変更）

**変更内容**: `refetch` 関数を追加し、エラー時のリトライを可能にする。

```typescript
import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/user';
import { getUserProfile, updateUserProfile } from '../api/client';

export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await updateUserProfile(id, data);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile, refetch: fetchProfile };
}
```

**変更ポイント**:
- `useEffect` 内の取得ロジックを `fetchProfile` 関数（`useCallback`）に抽出
- `refetch` として外部に公開し、エラー画面からのリトライを実現
- 既存の `profile`, `loading`, `error`, `updateProfile` の戻り値は変更なし（後方互換）

---

### 3.2 `src/components/ProfileEditForm.tsx`（変更）

**変更内容**: `onSave` の戻り値型を `Promise<void>` のまま維持するが、呼び出し側で `updateProfile` を `void` として扱う整合性のドキュメントコメントを追加。

現在の `ProfileEditForm` の `onSave` 型は `(data: Partial<UserProfile>) => Promise<void>` であり、`app/profile/page.tsx` 側の `handleSave` は `await updateProfile(data)` の戻り値を捨てているため、実質的な不整合はない。ただし、将来的に戻り値を利用する可能性を考慮し、型を明示化する。

```typescript
interface ProfileEditFormProps {
  profile: UserProfile;
  /** 保存処理。成功時に resolve、失敗時に reject する Promise を返す */
  onSave: (data: Partial<UserProfile>) => Promise<void>;
  onCancel: () => void;
}
```

> **判断**: 現時点では型自体の変更は不要。JSDoc コメントの追加のみとする。コンポーネント本体のロジックは変更なし。

---

### 3.3 `app/users/[id]/page.tsx`（変更）

**変更内容**: 404 専用表示の追加、リトライ機能の追加。

```typescript
'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useUserProfile } from '../../../src/hooks/useUserProfile';
import { UserProfileView } from '../../../src/components/UserProfileView';

export default function UserProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const { profile, loading, error, refetch } = useUserProfile(id);

  if (loading) return <div>読み込み中...</div>;

  if (error) {
    const is404 = error.message.includes('404');
    if (is404) {
      return <div>ユーザーが見つかりません（ID: {id}）</div>;
    }
    return (
      <div>
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    );
  }

  if (!profile) return <div>ユーザーが見つかりません</div>;

  return <UserProfileView profile={profile} editable={false} />;
}
```

**変更ポイント**:
- `error.message` に `404` が含まれるかで 404 専用メッセージを表示
- 404 以外のエラー時は「再試行」ボタンを表示し、`refetch` を呼び出す
- `refetch` を `useUserProfile` から取得

---

### 3.4 `app/profile/page.tsx`（変更）

**変更内容**: リトライ機能の追加。

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
  const { profile, loading, error, updateProfile, refetch } = useUserProfile(userId);
  const [isEditing, setIsEditing] = useState(false);

  if (loading) return <div>読み込み中...</div>;

  if (error) {
    return (
      <div>
        <p>エラーが発生しました: {error.message}</p>
        <button onClick={refetch}>再試行</button>
      </div>
    );
  }

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

**変更ポイント**:
- `refetch` を `useUserProfile` から取得
- エラー時に「再試行」ボタンを追加

## 4. 依存関係図

```
src/types/user.ts（変更なし）
src/api/client.ts（変更なし）
  │
  ▼
src/hooks/useUserProfile.ts（変更: refetch 追加）      ── 順序 1
  │
  ├──▶ src/components/ProfileEditForm.tsx（変更: JSDoc） ── 順序 2
  │
  ├──▶ app/users/[id]/page.tsx（変更: 404対応・リトライ）── 順序 3
  │
  └──▶ app/profile/page.tsx（変更: リトライ）            ── 順序 4
        │
        ▼
    テストファイル群（変更: カバレッジ拡充）              ── 順序 5〜8
```

**並列実装可能なグループ**:
- 順序 2, 3, 4 は互いに独立しているため並列実装可能
- 順序 5〜8 のテストファイルも互いに独立しているため並列実装可能

## 5. テスト方針

### 5.1 既存テストの状態

| テストファイル | 現在のテスト数 | 状態 |
|---------------|--------------|------|
| `src/hooks/__tests__/useUserProfile.test.ts` | 5件 | ✅ 正常取得、エラー、更新成功、更新失敗、ID変更時再取得 |
| `src/components/__tests__/UserProfileView.test.tsx` | 6件 | ✅ 全フィールド表示、オプショナル非表示、デフォルトアバター、編集ボタン表示/非表示、onEdit発火 |
| `src/components/__tests__/ProfileEditForm.test.tsx` | 7件 | ✅ 初期値、読み取り専用、バリデーション（name/website）、保存成功、保存失敗、キャンセル、保存中ボタン無効化 |
| `app/profile/__tests__/page.test.tsx` | 5件 | ✅ ローディング、表示、エラー、編集モード遷移、保存後復帰 |
| `app/users/[id]/__tests__/page.test.tsx` | 4件 | ✅ 表示、編集ボタン非表示、エラー、ローディング |

### 5.2 追加するテストケース

| テストファイル | 追加テスト | 目的 |
|---------------|-----------|------|
| `src/hooks/__tests__/useUserProfile.test.ts` | `refetch` 呼び出しでプロフィールを再取得できる | `refetch` 機能のテスト |
| `src/hooks/__tests__/useUserProfile.test.ts` | `refetch` 呼び出しで前回のエラーがクリアされる | エラーリセットの確認 |
| `app/users/[id]/__tests__/page.test.tsx` | 404 エラー時に専用メッセージが表示される | 404 専用表示のテスト |
| `app/users/[id]/__tests__/page.test.tsx` | エラー時に「再試行」ボタンが表示・動作する | リトライ機能のテスト |
| `app/profile/__tests__/page.test.tsx` | エラー時に「再試行」ボタンが表示・動作する | リトライ機能のテスト |
| `src/components/__tests__/ProfileEditForm.test.tsx` | bio が 500 文字超の場合にバリデーションエラー | 設計書 10.4 のバリデーション |
| `src/components/__tests__/ProfileEditForm.test.tsx` | location が 100 文字超の場合にバリデーションエラー | 設計書 10.4 のバリデーション |

### 5.3 テスト実行コマンド

```bash
# 全テスト実行
npm test

# 特定ファイルのテスト実行
npx jest src/hooks/__tests__/useUserProfile.test.ts
npx jest src/components/__tests__/ProfileEditForm.test.tsx
npx jest app/profile/__tests__/page.test.tsx
npx jest app/users/\\[id\\]/__tests__/page.test.tsx
```

### 5.4 テストエビデンス

設計書 Section 11.2 に準拠し、以下のスクリーンショットを `docs/evidence/issue-52/` に保存する。

| # | エビデンス | ファイル名 | 取得タイミング |
|---|-----------|-----------|---------------|
| 1 | プロフィール表示画面（自分） | `profile-view-own.png` | `/profile` ページ表示時 |
| 2 | プロフィール表示画面（他ユーザー） | `profile-view-other.png` | `/users/[id]` ページ表示時 |
| 3 | プロフィール編集モード | `profile-edit-mode.png` | 編集ボタン押下後のフォーム表示時 |
| 4 | プロフィール編集保存成功 | `profile-edit-success.png` | 保存完了後の閲覧モード復帰時 |
| 5 | バリデーションエラー表示 | `profile-edit-validation-error.png` | `name` 未入力や `website` 不正形式の入力時 |
| 6 | API エラー表示 + 再試行ボタン | `profile-error-retry.png` | API呼び出し失敗時のエラーメッセージ＋再試行ボタン表示 |
| 7 | ローディング状態 | `profile-loading.png` | データ取得中のローディング表示 |
| 8 | ユーザー未発見（404） | `profile-not-found.png` | 存在しないユーザーIDでアクセス時 |

## 6. 実装チェックリスト

- [ ] `src/hooks/useUserProfile.ts` に `refetch` 関数を追加
- [ ] `src/components/ProfileEditForm.tsx` に JSDoc コメントを追加
- [ ] `app/users/[id]/page.tsx` に 404 専用表示・リトライ機能を追加
- [ ] `app/profile/page.tsx` にリトライ機能を追加
- [ ] `src/hooks/__tests__/useUserProfile.test.ts` に refetch テストを追加
- [ ] `src/components/__tests__/ProfileEditForm.test.tsx` に bio/location バリデーションテストを追加
- [ ] `app/users/[id]/__tests__/page.test.tsx` に 404・リトライテストを追加
- [ ] `app/profile/__tests__/page.test.tsx` にリトライテストを追加
- [ ] `npm test` で全テストが通ることを確認
- [ ] テストエビデンスを `docs/evidence/issue-52/` に保存

## 7. リスクと注意事項

| リスク | 影響 | 対策 |
|--------|------|------|
| `refetch` 追加による既存テストへの影響 | 戻り値の型が変わる | `refetch` はオプショナルな追加のみで後方互換性を維持。既存テストは変更不要 |
| 404 判定のロジック | `error.message.includes('404')` はAPIの実装に依存 | 将来的にはエラーオブジェクトにステータスコードを含める構造への改善を検討 |
| 認証基盤未整備 | `/profile` のユーザーID取得がハードコーディング | `getCurrentUserId()` のプレースホルダー実装を維持。認証基盤導入時に差し替え |
