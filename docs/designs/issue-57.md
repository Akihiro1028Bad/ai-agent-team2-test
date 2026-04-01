# 設計書: Issue #57 通知設定画面の追加

## 1. 概要

通知設定画面を新規作成し、ユーザーがメール通知とプッシュ通知の設定を管理できるようにする。

- メール通知・プッシュ通知のON/OFF切り替え
- 通知頻度の設定（即時 / 日次ダイジェスト / 週次ダイジェスト）
- 設定の取得・保存用APIエンドポイント（Route Handler）
- レスポンシブ対応のUI（shadcn/ui の Switch + Select 使用）

### 1.1 背景

現在のアプリケーションにはユーザープロフィール機能が実装済みだが、通知に関する設定画面が存在しない。ユーザーが通知の受信方法や頻度を自分でコントロールできるようにするため、通知設定画面を新規追加する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— 通知設定画面、API Route Handler（モックデータ）、型定義、Hook
- **対象外**: 実際の通知配信基盤（メール送信、プッシュ通知送信）は別Issueで対応
- **API方式**: Route Handler（GET / PATCH）、モックデータで実装
- **認証**: NextAuth.js 対応済みの想定

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | 通知種別 | メール通知 / プッシュ通知の2種類、チャネル単位の単純ON/OFF |
| 2 | 通知頻度の選択肢 | 即時 / 日次ダイジェスト / 週次ダイジェスト |
| 3 | 通知頻度の適用範囲 | グローバル設定（1つの頻度設定を全通知に適用） |
| 4 | ページパス | `app/settings/notifications/page.tsx` |
| 5 | API実装方式 | Route Handler（GET / PATCH）、モックデータ |
| 6 | UIコンポーネント | shadcn/ui の Switch + Select |
| 7 | 認証 | NextAuth.js 対応済みの想定 |
| 8 | 画面遷移 | プロフィールページ（`app/profile/page.tsx`）にリンク追加 |
| 9 | デフォルト値 | 全通知ON / 頻度「即時」 |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ✅ 変更なし |
| **APIクライアント** | `src/api/client.ts` | ユーザー関連のAPI関数のみ | ✅ 変更なし（通知用は別ファイルに新規作成） |
| **Hook** | `src/hooks/useUserProfile.ts` | プロフィール取得・更新済み | ✅ 変更なし |
| **プロフィールページ** | `app/profile/page.tsx` | 表示・編集の切替済み | ⚠️ 変更（通知設定へのリンク追加） |

### 2.2 既存のAPIクライアントパターン

```typescript
// src/api/client.ts（現在のパターン）
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getXxx(id: string): Promise<Xxx> {
  const res = await fetch(`${API_BASE}/xxx/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch xxx: ${res.status}`);
  return res.json();
}
```

### 2.3 既存のHookパターン

```typescript
// src/hooks/useUserProfile.ts（現在のパターン）
export function useXxx(id: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => { /* fetch */ }, [id]);

  const update = async (data: Partial<T>) => { /* update */ };

  return { data, loading, error, update };
}
```

## 3. 機能設計

### 3.1 通知設定画面

#### UI構成

```
┌──────────────────────────────────────────┐
│  通知設定                                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ メール通知                         │  │
│  │ メールで通知を受け取ります         │  │
│  │                        [Switch ON] │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ プッシュ通知                       │  │
│  │ ブラウザのプッシュ通知を受け取ります│  │
│  │                        [Switch ON] │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 通知頻度                           │  │
│  │ [Select: 即時 ▼]                   │  │
│  │   - 即時                           │  │
│  │   - 日次ダイジェスト               │  │
│  │   - 週次ダイジェスト               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [保存] [キャンセル]                     │
│                                          │
│  ※ 保存成功時: 「設定を保存しました」    │
│  ※ エラー時: 「設定の保存に失敗しました」│
└──────────────────────────────────────────┘
```

#### ユーザー操作フロー

```
[プロフィールページの「通知設定」リンクをクリック]
  ↓
[/settings/notifications へ遷移]
  ↓
[API: GET /api/notifications/settings で現在の設定を取得]
  ↓ （未保存の場合はデフォルト値を表示）
[通知設定フォームを表示]
  ↓
[ユーザーが設定を変更]
  ↓
[「保存」ボタンをクリック]
  ↓
[API: PATCH /api/notifications/settings で設定を保存]
  ↓
[成功メッセージを表示]
```

### 3.2 デフォルト値

| 項目 | デフォルト値 |
|------|-------------|
| メール通知 | ON（`true`） |
| プッシュ通知 | ON（`true`） |
| 通知頻度 | 即時（`"immediate"`） |

## 4. 型定義

### 4.1 新規ファイル: `src/types/notification.ts`

```typescript
/**
 * 通知頻度の種別
 */
export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

/**
 * 通知設定
 */
export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: NotificationFrequency;
}

/**
 * 通知頻度の表示ラベル
 */
export const FREQUENCY_LABELS: Record<NotificationFrequency, string> = {
  immediate: '即時',
  daily: '日次ダイジェスト',
  weekly: '週次ダイジェスト',
};

/**
 * 通知設定のデフォルト値
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};
```

## 5. API設計

### 5.1 Route Handler（モックデータ）

#### GET `/api/notifications/settings`

通知設定を取得する。

**レスポンス**:
```json
{
  "emailEnabled": true,
  "pushEnabled": true,
  "frequency": "immediate"
}
```

**エラーレスポンス**:
```json
{
  "error": "Unauthorized"
}
```

| ステータス | 説明 |
|-----------|------|
| 200 | 設定取得成功 |
| 401 | 未認証 |
| 500 | サーバーエラー |

#### PATCH `/api/notifications/settings`

通知設定を更新する。

**リクエストボディ**:
```json
{
  "emailEnabled": false,
  "pushEnabled": true,
  "frequency": "daily"
}
```

**レスポンス**:
```json
{
  "emailEnabled": false,
  "pushEnabled": true,
  "frequency": "daily"
}
```

| ステータス | 説明 |
|-----------|------|
| 200 | 設定更新成功 |
| 400 | バリデーションエラー |
| 401 | 未認証 |
| 500 | サーバーエラー |

### 5.2 Route Handler 実装ファイル

```
app/api/notifications/settings/route.ts ← 新規
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { NotificationSettings } from '../../../../src/types/notification';

// モックデータ（インメモリ保存）
let mockSettings: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};

export async function GET() {
  // TODO: NextAuth.js 認証チェック
  return NextResponse.json(mockSettings);
}

export async function PATCH(request: NextRequest) {
  // TODO: NextAuth.js 認証チェック
  const body = await request.json();

  // バリデーション
  if (body.frequency && !['immediate', 'daily', 'weekly'].includes(body.frequency)) {
    return NextResponse.json(
      { error: '無効な通知頻度です' },
      { status: 400 }
    );
  }

  mockSettings = { ...mockSettings, ...body };
  return NextResponse.json(mockSettings);
}
```

### 5.3 APIクライアント

```
src/api/notificationClient.ts ← 新規
```

既存の `src/api/client.ts` のパターンに倣い、通知設定用のAPIクライアントを独立ファイルとして新規作成する。

```typescript
import { NotificationSettings } from '../types/notification';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * 通知設定を取得する
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`);
  if (!res.ok) throw new Error(`Failed to fetch notification settings: ${res.status}`);
  return res.json();
}

/**
 * 通知設定を更新する
 */
export async function updateNotificationSettings(
  data: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update notification settings: ${res.status}`);
  return res.json();
}
```

## 6. Hook設計

### 6.1 新規Hook: `useNotificationSettings`

```
src/hooks/useNotificationSettings.ts ← 新規
```

**責務**: 通知設定の取得・更新ロジックをカプセル化

```typescript
import { useState, useEffect } from 'react';
import { NotificationSettings, DEFAULT_NOTIFICATION_SETTINGS } from '../types/notification';
import { getNotificationSettings, updateNotificationSettings } from '../api/notificationClient';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNotificationSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const saveSettings = async (data: Partial<NotificationSettings>) => {
    const updated = await updateNotificationSettings(data);
    setSettings(updated);
    return updated;
  };

  return { settings, loading, error, saveSettings };
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `settings` | `NotificationSettings` | 現在の通知設定 |
| `loading` | `boolean` | 読み込み中フラグ |
| `error` | `Error \| null` | エラー情報 |
| `saveSettings` | `(data: Partial<NotificationSettings>) => Promise<NotificationSettings>` | 設定更新関数 |

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `NotificationSettingsForm`

```
src/components/NotificationSettingsForm.tsx        ← 新規
src/components/NotificationSettingsForm.module.css ← 新規
```

**責務**: 通知設定のフォームUI、ユーザー入力の管理、保存処理の呼び出し

**Props**:
```typescript
interface NotificationSettingsFormProps {
  settings: NotificationSettings;
  onSave: (data: Partial<NotificationSettings>) => Promise<void>;
}
```

**内部状態**:

| 状態 | 型 | 初期値 | 説明 |
|------|-----|--------|------|
| `emailEnabled` | `boolean` | `props.settings.emailEnabled` | メール通知ON/OFF |
| `pushEnabled` | `boolean` | `props.settings.pushEnabled` | プッシュ通知ON/OFF |
| `frequency` | `NotificationFrequency` | `props.settings.frequency` | 通知頻度 |
| `isSaving` | `boolean` | `false` | 保存中フラグ |
| `saveError` | `string \| null` | `null` | 保存エラーメッセージ |
| `saveSuccess` | `boolean` | `false` | 保存成功フラグ |

**UIコンポーネント構成**:

```
<form>
  <h2>通知設定</h2>

  <div class="settingItem">
    <label>メール通知</label>
    <p>メールで通知を受け取ります</p>
    <Switch checked={emailEnabled} onChange={...} />     ← shadcn/ui Switch
  </div>

  <div class="settingItem">
    <label>プッシュ通知</label>
    <p>ブラウザのプッシュ通知を受け取ります</p>
    <Switch checked={pushEnabled} onChange={...} />      ← shadcn/ui Switch
  </div>

  <div class="settingItem">
    <label>通知頻度</label>
    <Select value={frequency} onChange={...}>             ← shadcn/ui Select
      <option value="immediate">即時</option>
      <option value="daily">日次ダイジェスト</option>
      <option value="weekly">週次ダイジェスト</option>
    </Select>
  </div>

  {saveError && <div class="errorMessage">{saveError}</div>}
  {saveSuccess && <div class="successMessage">設定を保存しました</div>}

  <div class="actions">
    <button type="submit" disabled={isSaving}>
      {isSaving ? '保存中...' : '保存'}
    </button>
  </div>
</form>
```

### 7.2 CSSモジュール: `NotificationSettingsForm.module.css`

既存の `ProfileEditForm.module.css` のスタイルパターンに合わせ、以下のクラスを定義する。

| クラス名 | 説明 |
|---------|------|
| `.form` | フォーム全体のレイアウト |
| `.title` | ページタイトル |
| `.settingItem` | 各設定項目のコンテナ |
| `.settingLabel` | 設定項目のラベル |
| `.settingDescription` | 設定項目の説明文 |
| `.errorMessage` | エラーメッセージ |
| `.successMessage` | 成功メッセージ |
| `.actions` | ボタン配置エリア |
| `.saveButton` | 保存ボタン |

レスポンシブ対応:
- モバイル（`max-width: 768px`）: 1カラムレイアウト、Switch は項目名の下に配置
- デスクトップ: 設定項目のラベルとSwitchを横並び表示

## 8. ページコンポーネント設計

### 8.1 新規ページ: `app/settings/notifications/page.tsx`

```typescript
'use client';

import React from 'react';
import { useNotificationSettings } from '../../../src/hooks/useNotificationSettings';
import { NotificationSettingsForm } from '../../../src/components/NotificationSettingsForm';
import { NotificationSettings } from '../../../src/types/notification';

export default function NotificationSettingsPage() {
  const { settings, loading, error, saveSettings } = useNotificationSettings();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  const handleSave = async (data: Partial<NotificationSettings>) => {
    await saveSettings(data);
  };

  return (
    <NotificationSettingsForm
      settings={settings}
      onSave={handleSave}
    />
  );
}
```

### 8.2 既存ページの変更: `app/profile/page.tsx`

プロフィールページに通知設定へのナビゲーションリンクを追加する。

```typescript
// 変更前
return (
  <UserProfileView
    profile={profile}
    editable={true}
    onEdit={() => setIsEditing(true)}
  />
);

// 変更後
import Link from 'next/link';

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
```

## 9. 状態管理

### 9.1 画面の状態遷移

```
[プロフィールページの「通知設定」リンクをクリック]
  ↓
[/settings/notifications ページ]
  Loading（読み込み中）
    → エラー → エラーメッセージ表示
    → 成功 → フォーム表示
      → ユーザーが設定を変更
        → 「保存」クリック → 保存中...
          → 保存成功 → 「設定を保存しました」表示
          → 保存失敗 → 「設定の保存に失敗しました」表示
```

### 9.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `settings` | `useNotificationSettings()` | 通知設定データ |
| `loading` | `useNotificationSettings()` | 設定読み込み中フラグ |
| `error` | `useNotificationSettings()` | 設定取得エラー |
| `emailEnabled` | `NotificationSettingsForm` | メール通知の入力値 |
| `pushEnabled` | `NotificationSettingsForm` | プッシュ通知の入力値 |
| `frequency` | `NotificationSettingsForm` | 通知頻度の入力値 |
| `isSaving` | `NotificationSettingsForm` | 保存API呼び出し中 |
| `saveError` | `NotificationSettingsForm` | 保存エラーメッセージ |
| `saveSuccess` | `NotificationSettingsForm` | 保存成功フラグ |

## 10. ファイル変更一覧

### 10.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/notification.ts` | 型定義 | 通知設定の型、頻度ラベル、デフォルト値 |
| `src/api/notificationClient.ts` | APIクライアント | 通知設定の取得・更新関数 |
| `src/hooks/useNotificationSettings.ts` | Hook | 通知設定の取得・更新ロジック |
| `src/components/NotificationSettingsForm.tsx` | コンポーネント | 通知設定フォームUI |
| `src/components/NotificationSettingsForm.module.css` | スタイル | 通知設定フォームのスタイル |
| `app/settings/notifications/page.tsx` | ページ | 通知設定ページ |
| `app/api/notifications/settings/route.ts` | API Route | 通知設定のGET/PATCH Route Handler（モック） |
| `src/components/__tests__/NotificationSettingsForm.test.tsx` | テスト | NotificationSettingsFormのユニットテスト |
| `src/hooks/__tests__/useNotificationSettings.test.ts` | テスト | useNotificationSettingsのユニットテスト |

### 10.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `app/profile/page.tsx` | 通知設定ページへのリンク追加 |

### 10.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | 通知設定は独立した型ファイルに定義するため変更不要 |
| `src/api/client.ts` | 通知設定用クライアントは独立ファイルに作成するため変更不要 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `app/layout.tsx` | ナビゲーションリンクはプロフィールページに追加するため変更不要 |

## 11. 実装上の注意事項

### 11.1 shadcn/ui コンポーネントの導入

- `Switch` と `Select` コンポーネントを使用するため、shadcn/ui の初期セットアップが必要
- `npx shadcn-ui@latest add switch select` でコンポーネントを追加
- shadcn/ui が未導入の場合は、プレーンな `<input type="checkbox">` と `<select>` で代替し、後からshadcn/uiに差し替え可能な設計とする

### 11.2 モックデータの取り扱い

- Route Handler ではインメモリ変数にデータを保持する（サーバー再起動でリセット）
- 実際のDB連携は後続Issueで対応
- モックデータを使用していることをコード内コメントで明記する

### 11.3 認証チェック

- NextAuth.js 対応済みの想定だが、現時点では `app/profile/page.tsx` で `getCurrentUserId()` がプレースホルダーの状態
- Route Handler 内の認証チェックは `// TODO: NextAuth.js 認証チェック` コメントで明示し、認証Issueの完了後に統合する

### 11.4 エラーハンドリング

| シナリオ | 表示メッセージ |
|---------|---------------|
| 設定取得失敗 | `エラーが発生しました: {error.message}` |
| 設定保存失敗 | `設定の保存に失敗しました` |
| 設定保存成功 | `設定を保存しました` |

### 11.5 レスポンシブ対応

- CSSモジュールの `@media (max-width: 768px)` でモバイル対応
- Switch コンポーネントのタッチ操作対応
- フォーム幅 `max-width: 600px` で中央配置

## 12. テスト方針

### 12.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `NotificationSettingsForm` | `src/components/__tests__/NotificationSettingsForm.test.tsx` | フォーム表示 / Switch切り替え / Select変更 / 保存ボタン / 保存中の状態表示 / エラー表示 / 成功メッセージ表示 |
| `useNotificationSettings` | `src/hooks/__tests__/useNotificationSettings.test.ts` | 設定取得 / デフォルト値 / 設定更新 / エラーハンドリング / ローディング状態 |

### 12.2 テストケース詳細

#### `NotificationSettingsForm.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 渡された設定値がフォームに反映されること |
| 2 | メール通知のON/OFF切り替え | Switchをクリックすると値が切り替わること |
| 3 | プッシュ通知のON/OFF切り替え | Switchをクリックすると値が切り替わること |
| 4 | 通知頻度の変更 | Selectの値を変更すると反映されること |
| 5 | 保存ボタンクリック | `onSave` が正しいデータで呼ばれること |
| 6 | 保存中の表示 | 保存中は「保存中...」が表示され、ボタンが非活性になること |
| 7 | 保存エラー | エラーメッセージが表示されること |
| 8 | 保存成功 | 成功メッセージが表示されること |

#### `useNotificationSettings.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ロード | API呼び出しが行われ、設定が取得されること |
| 2 | ローディング状態 | 取得中は `loading: true` であること |
| 3 | 取得成功 | 設定データが正しくセットされること |
| 4 | 取得エラー | エラーが `error` にセットされること |
| 5 | 設定保存 | 更新APIが呼ばれ、設定が更新されること |

### 12.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-57/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | 通知設定画面の初期表示 | `notification-settings-initial.png` |
| 2 | 設定変更後の画面 | `notification-settings-changed.png` |
| 3 | 設定保存成功 | `notification-settings-saved.png` |
| 4 | 設定保存エラー | `notification-settings-error.png` |
| 5 | モバイル表示 | `notification-settings-mobile.png` |
| 6 | プロフィールページの通知設定リンク | `profile-notification-link.png` |

## 13. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/notification.ts` | 型定義 | 新規 | なし |
| 2 | `src/api/notificationClient.ts` | APIクライアント | 新規 | 順序1 |
| 3 | `app/api/notifications/settings/route.ts` | API Route | 新規 | 順序1 |
| 4 | `src/hooks/useNotificationSettings.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/NotificationSettingsForm.tsx` + CSS | コンポーネント | 新規 | 順序1 |
| 6 | `app/settings/notifications/page.tsx` | ページ | 新規 | 順序4, 5 |
| 7 | `app/profile/page.tsx` | ページ | 変更 | 順序6 |
| 8 | テスト追加 | テスト | 新規 | 順序1-7 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序4 と 順序5 は互いに独立しているため並列実装可能

## 14. 依存関係図

```
src/types/notification.ts（新規: 型定義）
  ├─→ src/api/notificationClient.ts（新規: APIクライアント）
  │     ↓
  │   src/hooks/useNotificationSettings.ts（新規: Hook）
  │     ↓
  ├─→ src/components/NotificationSettingsForm.tsx + CSS（新規: フォームUI）
  │     ↓
  │   app/settings/notifications/page.tsx（新規: ページ）
  │     ↓
  │   app/profile/page.tsx（変更: リンク追加）
  │
  └─→ app/api/notifications/settings/route.ts（新規: Route Handler）
```
