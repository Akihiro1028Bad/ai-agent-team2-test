# 設計書: Issue #108 通知設定の履歴表示機能

## 1. 概要

通知設定ページに変更履歴セクションを追加し、ユーザーが過去の設定変更を確認できるようにする。

### 1.1 背景

Issue #57 で通知設定の表示・編集機能が実装済みだが、設定変更の履歴を確認する手段がない。ユーザーがいつ・どの設定を・どのように変更したかを把握できるようにする。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— 型定義拡張、APIエンドポイント追加（GET）、APIクライアント追加、カスタムhook新規作成、履歴表示コンポーネント新規作成、既存ページへの統合、テスト
- **対象外**: 履歴の削除・編集機能、ページネーション、履歴のフィルタリング・検索、実際のDB連携
- **API方式**: Route Handler（GET）、モックデータで実装
- **認証**: NextAuth.js 対応済みの想定（既存パターンに準拠）

### 1.3 要件サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | 表示位置 | 通知設定ページの設定フォーム下部に変更履歴セクションを追加 |
| 2 | 表示件数 | 最新5件（ページネーションなし） |
| 3 | 表示項目 | 変更日時・変更内容（フィールド名）・変更前の値・変更後の値 |
| 4 | データ取得 | カスタムhook `useNotificationHistory` |
| 5 | APIエンドポイント | GET `/api/notifications/history` |
| 6 | Issue種別 | feature-m（5〜10ファイル程度の変更） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/notification.ts` | `NotificationSettings`, `NotificationFrequency`, `FREQUENCY_LABELS`, `DEFAULT_NOTIFICATION_SETTINGS` 定義済み | ⚠️ 変更（履歴関連型追加） |
| **APIクライアント** | `src/api/notificationClient.ts` | `getNotificationSettings`, `updateNotificationSettings` 実装済み | ⚠️ 変更（履歴取得関数追加） |
| **Hook** | `src/hooks/useNotificationSettings.ts` | 設定取得・更新済み | ✅ 変更なし |
| **コンポーネント** | `src/components/NotificationSettingsForm.tsx` | 設定フォーム実装済み | ✅ 変更なし |
| **ページ** | `app/settings/notifications/page.tsx` | `useNotificationSettings` + `NotificationSettingsForm` を使用 | ⚠️ 変更（履歴セクション追加） |
| **APIルート** | `app/api/notifications/settings/route.ts` | GET/PATCH 実装済み（モック） | ✅ 変更なし |

### 2.2 既存の型定義

```typescript
// src/types/notification.ts（現在）
export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: NotificationFrequency;
}

export const FREQUENCY_LABELS: Record<NotificationFrequency, string> = {
  immediate: '即時',
  daily: '日次ダイジェスト',
  weekly: '週次ダイジェスト',
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};
```

### 2.3 既存のAPIクライアントパターン

```typescript
// src/api/notificationClient.ts（現在）
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`);
  if (!res.ok) throw new Error(`Failed to fetch notification settings: ${res.status}`);
  return res.json();
}
```

### 2.4 既存のHookパターン

```typescript
// src/hooks/useNotificationSettings.ts（現在）
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

### 2.5 既存のページ構成

```typescript
// app/settings/notifications/page.tsx（現在）
export default function NotificationSettingsPage() {
  const { settings, loading, error, saveSettings } = useNotificationSettings();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  const handleSave = async (data: Partial<NotificationSettings>) => {
    await saveSettings(data);
  };

  return (
    <NotificationSettingsForm settings={settings} onSave={handleSave} />
  );
}
```

## 3. 機能設計

### 3.1 変更履歴の表示

#### 表示仕様

- 通知設定フォームの下部に「変更履歴」セクションを表示
- 最新5件の変更履歴を時系列降順（新しい順）で表示
- 各エントリに以下を表示:
  - **変更日時**: `YYYY/MM/DD HH:mm` 形式
  - **変更内容**: 変更されたフィールド名の日本語ラベル
  - **変更前の値**: 人間が読める形式に変換した値
  - **変更後の値**: 人間が読める形式に変換した値

#### 値の表示変換

| フィールド | 値 | 表示 |
|-----------|-----|------|
| `emailEnabled` | `true` | `ON` |
| `emailEnabled` | `false` | `OFF` |
| `pushEnabled` | `true` | `ON` |
| `pushEnabled` | `false` | `OFF` |
| `frequency` | `'immediate'` | `即時` |
| `frequency` | `'daily'` | `日次ダイジェスト` |
| `frequency` | `'weekly'` | `週次ダイジェスト` |

#### フィールド名の日本語ラベル

| フィールド | ラベル |
|-----------|--------|
| `emailEnabled` | メール通知 |
| `pushEnabled` | プッシュ通知 |
| `frequency` | 通知頻度 |

### 3.2 UI構成

```
┌─────────────────────────────────────────┐
│  通知設定                                │
│  ┌───────────────────────────────────┐   │
│  │ [既存の NotificationSettingsForm] │   │
│  │ メール通知       [ON/OFF]         │   │
│  │ プッシュ通知     [ON/OFF]         │   │
│  │ 通知頻度         [select]         │   │
│  │           [保存]                  │   │
│  └───────────────────────────────────┘   │
│                                          │
│  変更履歴                                │
│  ┌───────────────────────────────────┐   │
│  │ 2026/04/02 10:30                  │   │
│  │ メール通知: ON → OFF              │   │
│  ├───────────────────────────────────┤   │
│  │ 2026/04/01 15:00                  │   │
│  │ 通知頻度: 即時 → 日次ダイジェスト  │   │
│  ├───────────────────────────────────┤   │
│  │ 2026/03/30 09:15                  │   │
│  │ プッシュ通知: OFF → ON            │   │
│  │ 通知頻度: 週次ダイジェスト → 即時  │   │
│  └───────────────────────────────────┘   │
│                                          │
│  （履歴がない場合）                       │
│  変更履歴はありません                     │
└─────────────────────────────────────────┘
```

### 3.3 ユーザー操作フロー

```
[/settings/notifications ページにアクセス]
  ↓
[通知設定フォーム + 変更履歴セクションを表示]
  ↓
[API: GET /api/notifications/history で履歴を取得（設定取得と並行）]
  ↓ （履歴なしの場合は「変更履歴はありません」表示）
[最新5件の変更履歴を表示]
```

### 3.4 状態管理

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `settings` | `useNotificationSettings()` | 通知設定データ（既存） |
| `loading` | `useNotificationSettings()` | 設定読み込み中フラグ（既存） |
| `error` | `useNotificationSettings()` | 設定取得エラー（既存） |
| `history` | `useNotificationHistory()` | 変更履歴データ（新規） |
| `historyLoading` | `useNotificationHistory()` | 履歴読み込み中フラグ（新規） |
| `historyError` | `useNotificationHistory()` | 履歴取得エラー（新規） |

## 4. 型定義の変更

### 4.1 `src/types/notification.ts` への追加

既存の型はそのまま維持し、以下を追加する。

```typescript
// --- 以下を追加 ---

/**
 * 通知設定の変更対象フィールド
 */
export type NotificationSettingField = keyof NotificationSettings;

/**
 * 通知設定フィールドの表示ラベル
 */
export const SETTING_FIELD_LABELS: Record<NotificationSettingField, string> = {
  emailEnabled: 'メール通知',
  pushEnabled: 'プッシュ通知',
  frequency: '通知頻度',
};

/**
 * 通知設定の変更履歴エントリ
 */
export interface NotificationHistoryEntry {
  id: string;
  changedAt: string;  // ISO 8601 形式
  field: NotificationSettingField;
  oldValue: string;
  newValue: string;
}
```

## 5. API設計

### 5.1 エンドポイント

#### GET `/api/notifications/history`

通知設定の変更履歴を取得する（最新5件）。

**レスポンス（200 OK）**:
```json
[
  {
    "id": "1",
    "changedAt": "2026-04-02T10:30:00Z",
    "field": "emailEnabled",
    "oldValue": "true",
    "newValue": "false"
  },
  {
    "id": "2",
    "changedAt": "2026-04-01T15:00:00Z",
    "field": "frequency",
    "oldValue": "immediate",
    "newValue": "daily"
  }
]
```

**エラーレスポンス**:
```json
{
  "error": "Failed to fetch notification history"
}
```

| ステータス | 説明 |
|-----------|------|
| 200 | 履歴取得成功 |
| 401 | 未認証 |
| 500 | サーバーエラー |

### 5.2 APIルート実装（モック）

**新規ファイル**: `app/api/notifications/history/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { NotificationHistoryEntry } from '../../../../src/types/notification';

// モックデータ（インメモリ — サーバー再起動でリセット）
const mockHistory: NotificationHistoryEntry[] = [
  {
    id: '1',
    changedAt: '2026-04-02T10:30:00Z',
    field: 'emailEnabled',
    oldValue: 'true',
    newValue: 'false',
  },
  {
    id: '2',
    changedAt: '2026-04-01T15:00:00Z',
    field: 'frequency',
    oldValue: 'immediate',
    newValue: 'daily',
  },
  {
    id: '3',
    changedAt: '2026-03-30T09:15:00Z',
    field: 'pushEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
  {
    id: '4',
    changedAt: '2026-03-28T14:20:00Z',
    field: 'frequency',
    oldValue: 'weekly',
    newValue: 'immediate',
  },
  {
    id: '5',
    changedAt: '2026-03-25T11:00:00Z',
    field: 'emailEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
];

export async function GET() {
  // TODO: NextAuth.js 認証チェック
  // 最新5件を返却
  const history = mockHistory.slice(0, 5);
  return NextResponse.json(history);
}
```

### 5.3 APIクライアント関数の追加

**変更ファイル**: `src/api/notificationClient.ts`

```typescript
import { NotificationSettings, NotificationHistoryEntry } from '../types/notification';

// ... 既存の getNotificationSettings, updateNotificationSettings はそのまま ...

/**
 * 通知設定の変更履歴を取得する
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/notifications/history`);
  if (!res.ok) throw new Error(`Failed to fetch notification history: ${res.status}`);
  return res.json();
}
```

## 6. Hook設計

### 6.1 新規Hook: `useNotificationHistory`

**新規ファイル**: `src/hooks/useNotificationHistory.ts`

**責務**: 通知設定の変更履歴をAPIから取得し、状態を管理する

**実装パターン**: 既存の `useNotificationSettings` と同じパターン（useEffect でマウント時に取得）

```typescript
import { useState, useEffect } from 'react';
import { NotificationHistoryEntry } from '../types/notification';
import { getNotificationHistory } from '../api/notificationClient';

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotificationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNotificationHistory()
      .then(setHistory)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { history, loading, error };
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `history` | `NotificationHistoryEntry[]` | 変更履歴の配列（最新5件） |
| `loading` | `boolean` | 読み込み中フラグ |
| `error` | `Error \| null` | エラー情報 |

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `NotificationHistory`

**新規ファイル**:
- `src/components/NotificationHistory.tsx`
- `src/components/NotificationHistory.module.css`

**責務**: 通知設定の変更履歴リストを表示する

**Props**:
```typescript
interface NotificationHistoryProps {
  history: NotificationHistoryEntry[];
  loading: boolean;
  error: Error | null;
}
```

**表示ロジック**:
- `loading === true` の場合: 「読み込み中...」を表示
- `error !== null` の場合: 「履歴の取得に失敗しました」を表示
- `history.length === 0` の場合: 「変更履歴はありません」を表示
- それ以外: 履歴リストを表示

**値の表示変換ロジック**:
```typescript
/**
 * 変更値を人間が読める形式に変換する
 */
function formatHistoryValue(field: NotificationSettingField, value: string): string {
  if (field === 'emailEnabled' || field === 'pushEnabled') {
    return value === 'true' ? 'ON' : 'OFF';
  }
  if (field === 'frequency') {
    return FREQUENCY_LABELS[value as NotificationFrequency] || value;
  }
  return value;
}

/**
 * ISO 8601 日時を YYYY/MM/DD HH:mm 形式にフォーマットする
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${d} ${h}:${min}`;
}
```

**コンポーネント実装**:
```tsx
export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  history,
  loading,
  error,
}) => {
  if (loading) return <div>読み込み中...</div>;
  if (error) return <div className={styles.errorMessage}>履歴の取得に失敗しました</div>;

  return (
    <section className={styles.container}>
      <h2 className={styles.title}>変更履歴</h2>
      {history.length === 0 ? (
        <p className={styles.emptyMessage}>変更履歴はありません</p>
      ) : (
        <ul className={styles.historyList}>
          {history.map((entry) => (
            <li key={entry.id} className={styles.historyItem}>
              <div className={styles.changedAt}>
                {formatDateTime(entry.changedAt)}
              </div>
              <div className={styles.changeDetail}>
                {SETTING_FIELD_LABELS[entry.field]}:
                <span className={styles.oldValue}>
                  {formatHistoryValue(entry.field, entry.oldValue)}
                </span>
                {' → '}
                <span className={styles.newValue}>
                  {formatHistoryValue(entry.field, entry.newValue)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
```

### 7.2 CSSモジュール: `NotificationHistory.module.css`

既存の `NotificationSettingsForm.module.css` のスタイルパターンに合わせる。

| クラス名 | 説明 |
|---------|------|
| `.container` | 履歴セクション全体のコンテナ（`max-width: 600px`、中央配置） |
| `.title` | セクションタイトル（「変更履歴」） |
| `.historyList` | 履歴リスト（`<ul>`） |
| `.historyItem` | 各履歴エントリ（`<li>`、下線区切り） |
| `.changedAt` | 変更日時の表示（小さめフォント、グレー） |
| `.changeDetail` | 変更内容の表示 |
| `.oldValue` | 変更前の値（赤、取り消し線） |
| `.newValue` | 変更後の値（緑、太字） |
| `.emptyMessage` | 履歴なし時のメッセージ |
| `.errorMessage` | エラーメッセージ |

## 8. ページコンポーネントの変更

### 8.1 変更ファイル: `app/settings/notifications/page.tsx`

`useNotificationHistory` と `NotificationHistory` コンポーネントを統合する。

```typescript
'use client';

import React from 'react';
import { useNotificationSettings } from '../../../src/hooks/useNotificationSettings';
import { useNotificationHistory } from '../../../src/hooks/useNotificationHistory';
import { NotificationSettingsForm } from '../../../src/components/NotificationSettingsForm';
import { NotificationHistory } from '../../../src/components/NotificationHistory';
import { NotificationSettings } from '../../../src/types/notification';

export default function NotificationSettingsPage() {
  const { settings, loading, error, saveSettings } = useNotificationSettings();
  const {
    history,
    loading: historyLoading,
    error: historyError,
  } = useNotificationHistory();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  const handleSave = async (data: Partial<NotificationSettings>) => {
    await saveSettings(data);
  };

  return (
    <>
      <NotificationSettingsForm settings={settings} onSave={handleSave} />
      <NotificationHistory
        history={history}
        loading={historyLoading}
        error={historyError}
      />
    </>
  );
}
```

**設計ポイント**:
- 設定フォームと履歴の取得は独立して行い、片方がエラーでも他方は正常に表示する
- 設定の読み込み中は全体をブロック（既存動作を維持）
- 履歴の読み込み中は `NotificationHistory` コンポーネント内でローディング表示

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `app/api/notifications/history/route.ts` | APIルート | 履歴取得APIのモック実装 |
| `src/hooks/useNotificationHistory.ts` | Hook | 履歴データ取得Hook |
| `src/components/NotificationHistory.tsx` | コンポーネント | 履歴表示コンポーネント |
| `src/components/NotificationHistory.module.css` | スタイル | 履歴表示のスタイル |
| `src/hooks/__tests__/useNotificationHistory.test.ts` | テスト | useNotificationHistoryのユニットテスト |
| `src/components/__tests__/NotificationHistory.test.tsx` | テスト | NotificationHistoryのユニットテスト |

### 9.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/notification.ts` | `NotificationSettingField`, `SETTING_FIELD_LABELS`, `NotificationHistoryEntry` を追加 |
| `src/api/notificationClient.ts` | `getNotificationHistory` 関数を追加、import文にNotificationHistoryEntry追加 |
| `app/settings/notifications/page.tsx` | `useNotificationHistory` と `NotificationHistory` を統合 |

### 9.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/components/NotificationSettingsForm.tsx` | 設定フォーム自体に変更なし。履歴はページレベルで統合 |
| `src/components/NotificationSettingsForm.module.css` | スタイル変更なし |
| `src/hooks/useNotificationSettings.ts` | 設定取得・更新ロジックに変更なし |
| `app/api/notifications/settings/route.ts` | 既存の設定APIに変更なし |
| `src/types/user.ts` | スコープ外 |
| `src/api/client.ts` | 通知用クライアントは既存の別ファイルに追加するため変更不要 |

## 10. テスト方針

### 10.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useNotificationHistory` | `src/hooks/__tests__/useNotificationHistory.test.ts` | 履歴取得 / ローディング状態 / エラーハンドリング |
| `NotificationHistory` | `src/components/__tests__/NotificationHistory.test.tsx` | 履歴表示 / 空履歴 / 値フォーマット / ローディング / エラー |

### 10.2 テストケース詳細

#### `useNotificationHistory.test.ts`

既存の `useNotificationSettings.test.ts` のパターンに準拠（`jest.mock` + `renderHook` + `waitFor`）。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 履歴データを正常に取得できる | API呼び出しが行われ、履歴が取得されること |
| 2 | ローディング状態が正しく管理される | 取得中は `loading: true`、完了後は `loading: false` であること |
| 3 | APIエラー時にエラー状態が設定される | エラーが `error` にセットされること |
| 4 | 取得データが空配列の場合も正しく処理される | 空配列がセットされること |

#### `NotificationHistory.test.tsx`

既存の `NotificationSettingsForm.test.tsx` のパターンに準拠（`render` + `screen` + `waitFor`）。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 履歴データが正しく表示される | 変更日時・フィールド名・変更前後の値が表示されること |
| 2 | boolean値がON/OFFで表示される | `emailEnabled: "true" → "false"` が「メール通知: ON → OFF」と表示 |
| 3 | frequency値が日本語ラベルで表示される | `frequency: "immediate" → "daily"` が「通知頻度: 即時 → 日次ダイジェスト」と表示 |
| 4 | ローディング中に「読み込み中...」が表示される | `loading: true` の場合のUI |
| 5 | エラー時に「履歴の取得に失敗しました」が表示される | `error` が設定されている場合のUI |
| 6 | 履歴が空の場合に「変更履歴はありません」が表示される | 空配列の場合のUI |
| 7 | 複数件の履歴が表示される | 5件の履歴がすべて表示されること |

### 10.3 テストパターン

既存テストのパターンに準拠:
- APIクライアントを `jest.mock` でモック化
- `renderHook` / `render` + `waitFor` で非同期処理をテスト
- `@testing-library/react` を使用

## 11. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/notification.ts` | 型定義 | 変更 | なし |
| 2 | `src/api/notificationClient.ts` | APIクライアント | 変更 | 順序1 |
| 3 | `app/api/notifications/history/route.ts` | APIルート | 新規 | 順序1 |
| 4 | `src/hooks/useNotificationHistory.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/NotificationHistory.tsx` + CSS | コンポーネント | 新規 | 順序1 |
| 6 | `app/settings/notifications/page.tsx` | ページ | 変更 | 順序4, 5 |
| 7 | テスト追加 | テスト | 新規 | 順序1-6 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序4 と 順序5 は互いに独立しているため並列実装可能

## 12. 依存関係図

```
src/types/notification.ts（変更: 履歴関連型追加）
  ├─→ src/api/notificationClient.ts（変更: getNotificationHistory追加）
  │     ↓
  │   src/hooks/useNotificationHistory.ts（新規）
  │     ↓
  ├─→ src/components/NotificationHistory.tsx + CSS（新規）
  │     ↓
  └─→ app/settings/notifications/page.tsx（変更: 履歴セクション統合）

  app/api/notifications/history/route.ts（新規: モックAPI）
```

## 13. 実装上の注意事項

### 13.1 既存コンポーネントとの分離

- `NotificationSettingsForm` には手を加えず、履歴表示は独立した `NotificationHistory` コンポーネントとして実装する
- ページレベル（`app/settings/notifications/page.tsx`）で両コンポーネントを組み合わせる
- これにより、既存の `NotificationSettingsForm.test.tsx`（12テストケース）に影響を与えない

### 13.2 日時フォーマット

- APIからは ISO 8601 形式の文字列で受け取る
- 表示時に `YYYY/MM/DD HH:mm` 形式に変換する
- 外部ライブラリは使用せず、`Date` オブジェクトとカスタムフォーマット関数で対応する

### 13.3 モックAPIデータ

- `app/api/notifications/history/route.ts` にインメモリのモックデータを用意
- 既存の `app/api/notifications/settings/route.ts` と同じパターンで実装
- 5件のサンプル履歴データを返却

### 13.4 エラーハンドリング

- 履歴取得エラーは設定表示をブロックしない
- 設定フォームと履歴の取得は独立して行い、片方がエラーでも他方は正常に表示する

| シナリオ | 表示メッセージ |
|---------|---------------|
| 履歴取得中 | `読み込み中...` |
| 履歴取得失敗 | `履歴の取得に失敗しました` |
| 履歴0件 | `変更履歴はありません` |

### 13.5 認証チェック

- Route Handler 内の認証チェックは `// TODO: NextAuth.js 認証チェック` コメントで明示する（既存パターンに準拠）

### 13.6 パッケージ追加

追加パッケージは不要。既存の依存関係のみで実装可能。
