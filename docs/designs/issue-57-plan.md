# 実装計画: Issue #57 通知設定画面の追加

## 1. 概要

設計書 `docs/designs/issue-57.md` に基づき、通知設定画面を新規作成する。
メール通知・プッシュ通知の ON/OFF 切り替えと通知頻度の設定（即時 / 日次ダイジェスト / 週次ダイジェスト）を管理できる画面を実装する。

---

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義（依存なし）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 1 | `src/types/notification.ts` | 新規 | `NotificationFrequency` 型、`NotificationSettings` インターフェース、`FREQUENCY_LABELS` 定数、`DEFAULT_NOTIFICATION_SETTINGS` 定数 |

### Phase 2: API層（Phase 1 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 2a | `src/api/notificationClient.ts` | 新規 | `getNotificationSettings()` / `updateNotificationSettings()` — 既存 `client.ts` のパターンに準拠 |
| 2b | `app/api/notifications/settings/route.ts` | 新規 | GET / PATCH の Route Handler（モックデータ、インメモリ保存） |

### Phase 3: Hook・コンポーネント（Phase 2 に依存、互いに独立 → 並列実装可能）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 3a | `src/hooks/useNotificationSettings.ts` | 新規 | 通知設定の取得・更新ロジック — 既存 `useUserProfile.ts` のパターンに準拠 |
| 3b | `src/components/NotificationSettingsForm.tsx` | 新規 | 通知設定フォーム UI — 既存 `ProfileEditForm.tsx` のパターンに準拠 |
| 3c | `src/components/NotificationSettingsForm.module.css` | 新規 | フォームスタイル — 既存 `ProfileEditForm.module.css` のパターンに準拠 |

### Phase 4: ページ（Phase 3 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 4 | `app/settings/notifications/page.tsx` | 新規 | 通知設定ページ（`'use client'`） |

### Phase 5: 既存ページ変更（Phase 4 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 5 | `app/profile/page.tsx` | 変更 | 通知設定ページへの `Link` 追加 |

### Phase 6: テスト（Phase 1〜5 に依存）

| 順序 | ファイルパス | 新規/変更 | 説明 |
|------|-------------|-----------|------|
| 6a | `src/hooks/__tests__/useNotificationSettings.test.ts` | 新規 | Hook のユニットテスト |
| 6b | `src/components/__tests__/NotificationSettingsForm.test.tsx` | 新規 | コンポーネントのユニットテスト |

### 変更なしファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | 通知設定は独立した型ファイルに定義 |
| `src/api/client.ts` | 通知設定用クライアントは独立ファイルに作成 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `app/layout.tsx` | ナビゲーションはプロフィールページに追加 |

---

## 3. 各ファイルの変更内容

### 3.1 `src/types/notification.ts`（新規）

通知設定に関する型定義・定数を定義する。

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

### 3.2 `src/api/notificationClient.ts`（新規）

既存 `src/api/client.ts` のパターンに準拠。`API_BASE` の取得方法、エラーハンドリング、関数シグネチャを統一する。

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

### 3.3 `app/api/notifications/settings/route.ts`（新規）

GET / PATCH の Route Handler。モックデータ（インメモリ保存）で実装する。

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { NotificationSettings } from '../../../../src/types/notification';

// モックデータ（インメモリ保存 — サーバー再起動でリセット）
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

### 3.4 `src/hooks/useNotificationSettings.ts`（新規）

既存 `src/hooks/useUserProfile.ts` のパターンに準拠。`useState` + `useEffect` で取得、`saveSettings` で更新。

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

### 3.5 `src/components/NotificationSettingsForm.tsx`（新規）

既存 `ProfileEditForm.tsx` のパターンに準拠。Props 経由で `settings` と `onSave` を受け取り、内部状態でフォーム値を管理する。

**shadcn/ui について**: `package.json` に shadcn/ui は未導入のため、設計書の注意事項 11.1 に従い、プレーンな HTML 要素（`<input type="checkbox">` / `<select>`）で実装する。後から shadcn/ui に差し替え可能な設計とする。

```typescript
'use client';

import React, { useState } from 'react';
import { NotificationSettings, NotificationFrequency, FREQUENCY_LABELS } from '../types/notification';
import styles from './NotificationSettingsForm.module.css';

interface NotificationSettingsFormProps {
  settings: NotificationSettings;
  onSave: (data: Partial<NotificationSettings>) => Promise<void>;
}

export const NotificationSettingsForm: React.FC<NotificationSettingsFormProps> = ({
  settings,
  onSave,
}) => {
  const [emailEnabled, setEmailEnabled] = useState(settings.emailEnabled);
  const [pushEnabled, setPushEnabled] = useState(settings.pushEnabled);
  const [frequency, setFrequency] = useState<NotificationFrequency>(settings.frequency);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onSave({ emailEnabled, pushEnabled, frequency });
      setSaveSuccess(true);
    } catch (err) {
      setSaveError('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>通知設定</h2>

      <div className={styles.settingItem}>
        <div className={styles.settingContent}>
          <label className={styles.settingLabel} htmlFor="emailEnabled">
            メール通知
          </label>
          <p className={styles.settingDescription}>メールで通知を受け取ります</p>
        </div>
        <input
          id="emailEnabled"
          type="checkbox"
          role="switch"
          checked={emailEnabled}
          onChange={(e) => setEmailEnabled(e.target.checked)}
        />
      </div>

      <div className={styles.settingItem}>
        <div className={styles.settingContent}>
          <label className={styles.settingLabel} htmlFor="pushEnabled">
            プッシュ通知
          </label>
          <p className={styles.settingDescription}>ブラウザのプッシュ通知を受け取ります</p>
        </div>
        <input
          id="pushEnabled"
          type="checkbox"
          role="switch"
          checked={pushEnabled}
          onChange={(e) => setPushEnabled(e.target.checked)}
        />
      </div>

      <div className={styles.settingItem}>
        <label className={styles.settingLabel} htmlFor="frequency">
          通知頻度
        </label>
        <select
          id="frequency"
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as NotificationFrequency)}
        >
          {(Object.entries(FREQUENCY_LABELS) as [NotificationFrequency, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>

      {saveError && <div className={styles.errorMessage}>{saveError}</div>}
      {saveSuccess && <div className={styles.successMessage}>設定を保存しました</div>}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={isSaving}
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
    </form>
  );
};
```

### 3.6 `src/components/NotificationSettingsForm.module.css`（新規）

既存 `ProfileEditForm.module.css` のスタイルパターン（`max-width: 600px`、フォントサイズ、色、ボーダー）に合わせる。

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

.settingItem {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #eee;
}

.settingContent {
  flex: 1;
}

.settingLabel {
  display: block;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
}

.settingDescription {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.settingItem select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  margin-top: 8px;
}

.errorMessage {
  color: #e00;
  margin-top: 16px;
  padding: 8px 12px;
  background: #fff0f0;
  border-radius: 6px;
}

.successMessage {
  color: #0a0;
  margin-top: 16px;
  padding: 8px 12px;
  background: #f0fff0;
  border-radius: 6px;
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

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .settingItem {
    flex-direction: column;
    align-items: flex-start;
  }

  .settingItem input[type="checkbox"] {
    margin-top: 8px;
  }
}
```

### 3.7 `app/settings/notifications/page.tsx`（新規）

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

### 3.8 `app/profile/page.tsx`（変更）

**変更内容**: `next/link` の import 追加、表示部分とリンクを `<div>` でラップ。

**変更前（38〜44行目）**:
```tsx
  return (
    <UserProfileView
      profile={profile}
      editable={true}
      onEdit={() => setIsEditing(true)}
    />
  );
```

**変更後**:
```tsx
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

また、ファイル先頭に `import Link from 'next/link';` を追加する。

---

## 4. 依存関係図

```
Phase 1: src/types/notification.ts
           │
     ┌─────┴─────┐
     ▼           ▼
Phase 2a:      Phase 2b:
notificationClient.ts   route.ts
     │
     ▼
Phase 3a:      Phase 3b + 3c:
useNotificationSettings.ts   NotificationSettingsForm.tsx + .module.css
     │                │
     └───────┬────────┘
             ▼
Phase 4: app/settings/notifications/page.tsx
             │
             ▼
Phase 5: app/profile/page.tsx（リンク追加）
             │
             ▼
Phase 6: テスト（6a: Hook テスト, 6b: コンポーネントテスト）
```

---

## 5. テスト方針

### 5.1 テストツール・パターン

既存テスト（`ProfileEditForm.test.tsx` / `useUserProfile.test.ts`）のパターンに準拠する。

- **テストフレームワーク**: Jest + ts-jest
- **テスト環境**: jsdom（`jest.config.js` で設定済み）
- **テストライブラリ**: `@testing-library/react` / `@testing-library/user-event`
- **モック**: `jest.mock()` で API クライアントをモック
- **CSS モジュール**: `identity-obj-proxy` で自動モック（`jest.config.js` で設定済み）

### 5.2 `src/hooks/__tests__/useNotificationSettings.test.ts`

既存 `useUserProfile.test.ts` のパターンに準拠。`jest.mock('../../api/notificationClient')` で API をモック。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 通知設定を正常に取得できる | `getNotificationSettings` が呼ばれ、`settings` にセットされること |
| 2 | ローディング状態 | 取得中は `loading: true`、完了後 `loading: false` であること |
| 3 | API エラー時にエラー状態が設定される | `error` にエラーがセットされること |
| 4 | `saveSettings` で設定を更新できる | `updateNotificationSettings` が呼ばれ、`settings` が更新されること |
| 5 | `saveSettings` 失敗時にエラーがスローされる | Promise が reject されること |

### 5.3 `src/components/__tests__/NotificationSettingsForm.test.tsx`

既存 `ProfileEditForm.test.tsx` のパターンに準拠。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期表示 | 渡された設定値がフォームに反映されること |
| 2 | メール通知の ON/OFF 切り替え | チェックボックスをクリックすると値が切り替わること |
| 3 | プッシュ通知の ON/OFF 切り替え | チェックボックスをクリックすると値が切り替わること |
| 4 | 通知頻度の変更 | Select の値を変更すると反映されること |
| 5 | 保存ボタンクリック | `onSave` が正しいデータで呼ばれること |
| 6 | 保存中の表示 | 保存中は「保存中...」が表示され、ボタンが非活性になること |
| 7 | 保存エラー | 「設定の保存に失敗しました」が表示されること |
| 8 | 保存成功 | 「設定を保存しました」が表示されること |

### 5.4 テスト実行コマンド

```bash
npm test
```

---

## 6. 実装時の注意事項

### 6.1 shadcn/ui 未導入への対応

`package.json` を確認したところ shadcn/ui は未導入。設計書の注意事項 11.1 に従い、プレーンな HTML 要素で実装する。

- Switch → `<input type="checkbox" role="switch">`
- Select → `<select>` + `<option>`

### 6.2 モックデータの扱い

- Route Handler のインメモリ変数によるデータ保持（サーバー再起動でリセット）
- コード内コメントで「モックデータ」であることを明記
- 実際の DB 連携は後続 Issue で対応

### 6.3 認証チェック

- `app/profile/page.tsx` の `getCurrentUserId()` がプレースホルダー状態
- Route Handler 内の認証チェックは `// TODO: NextAuth.js 認証チェック` コメントで明示

### 6.4 既存パターンとの一貫性

| 項目 | 既存パターン（参照元） | 新規ファイルでの適用 |
|------|----------------------|---------------------|
| API クライアント | `src/api/client.ts`: `API_BASE` 定数、`fetch` + エラーハンドリング | `notificationClient.ts` で同パターン |
| Hook | `useUserProfile.ts`: `useState` + `useEffect` + 更新関数 | `useNotificationSettings.ts` で同パターン |
| コンポーネント | `ProfileEditForm.tsx`: Props 型定義、内部状態、`handleSubmit` | `NotificationSettingsForm.tsx` で同パターン |
| CSS | `ProfileEditForm.module.css`: `max-width: 600px`、色・フォント | `NotificationSettingsForm.module.css` で同パターン |
| テスト（Hook） | `useUserProfile.test.ts`: `jest.mock` + `renderHook` + `waitFor` | `useNotificationSettings.test.ts` で同パターン |
| テスト（Component） | `ProfileEditForm.test.tsx`: `render` + `screen` + `fireEvent` + `userEvent` | `NotificationSettingsForm.test.tsx` で同パターン |

---

## 7. 見積もり

| Phase | 内容 | 見積もり |
|-------|------|----------|
| 1 | 型定義 | 小 |
| 2 | API クライアント + Route Handler | 小 |
| 3 | Hook + コンポーネント + CSS | 中 |
| 4 | ページ | 小 |
| 5 | 既存ページ変更 | 小 |
| 6 | テスト | 中 |
