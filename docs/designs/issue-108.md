# 設計書: Issue #108 通知設定の履歴表示機能

## 1. 概要

通知設定ページに変更履歴セクションを追加し、ユーザーが過去の設定変更を確認できるようにする。

### 1.1 背景

Issue #57 で通知設定の表示・編集機能が実装済みだが、設定変更の履歴を確認する手段がない。ユーザーがいつ・どの設定を・どのように変更したかを把握できるようにする。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）のみ
- **対象外**: バックエンドAPI実装（モックで対応）
- **表示件数**: 最新5件（ページネーションなし）

### 1.3 要件サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | 表示位置 | 通知設定ページの設定フォーム下部に変更履歴セクションを追加 |
| 2 | 表示件数 | 最新5件 |
| 3 | ページネーション | なし |
| 4 | 表示項目 | 変更日時・変更内容（フィールド名）・変更前の値・変更後の値 |
| 5 | データ取得 | カスタムhook（useNotificationHistory）で取得 |
| 6 | APIエンドポイント | GET /api/notifications/history |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/notification.ts` | `NotificationSettings`, `NotificationFrequency`, `FREQUENCY_LABELS` 定義済み | ⚠️ 変更（履歴関連型追加） |
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

### 2.3 既存のAPIクライアント

```typescript
// src/api/notificationClient.ts（現在）
getNotificationSettings(): Promise<NotificationSettings>           // GET
updateNotificationSettings(data): Promise<NotificationSettings>    // PATCH
```

### 2.4 既存のページ構成

```typescript
// app/settings/notifications/page.tsx（現在）
// useNotificationSettings で設定を取得し、NotificationSettingsForm に渡すシンプルな構成
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
│  │ ...                               │   │
│  └───────────────────────────────────┘   │
│                                          │
│  （履歴がない場合）                       │
│  変更履歴はありません                     │
└─────────────────────────────────────────┘
```

### 3.3 状態管理

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `history` | `useNotificationHistory()` | 履歴データの配列 |
| `loading` | `useNotificationHistory()` | 履歴データ取得中フラグ |
| `error` | `useNotificationHistory()` | 履歴データ取得エラー |

## 4. 型定義の変更

### 4.1 `src/types/notification.ts` への追加

```typescript
// 既存の型はそのまま維持

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

```
GET /api/notifications/history
```

#### レスポンス

```typescript
// 成功時: 200 OK
NotificationHistoryEntry[]

// 例:
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

### 5.2 APIクライアント関数

```typescript
// src/api/notificationClient.ts に追加

/**
 * 通知設定の変更履歴を取得する
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/notifications/history`);
  if (!res.ok) throw new Error(`Failed to fetch notification history: ${res.status}`);
  return res.json();
}
```

### 5.3 APIルート（モック実装）

```
app/api/notifications/history/route.ts  ← 新規
```

```typescript
// モックデータを返すGETハンドラ
// 最新5件のモック履歴データを返却
```

## 6. コンポーネント設計

### 6.1 新規コンポーネント: `NotificationHistory`

```
src/components/NotificationHistory.tsx        ← 新規
src/components/NotificationHistory.module.css ← 新規
```

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
function formatHistoryValue(field: NotificationSettingField, value: string): string {
  if (field === 'emailEnabled' || field === 'pushEnabled') {
    return value === 'true' ? 'ON' : 'OFF';
  }
  if (field === 'frequency') {
    return FREQUENCY_LABELS[value as NotificationFrequency] || value;
  }
  return value;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  // YYYY/MM/DD HH:mm 形式にフォーマット
}
```

### 6.2 新規Hook: `useNotificationHistory`

```
src/hooks/useNotificationHistory.ts ← 新規
```

**責務**: 通知設定の変更履歴をAPIから取得し、状態を管理する

**インターフェース**:
```typescript
export function useNotificationHistory() {
  return {
    history: NotificationHistoryEntry[],
    loading: boolean,
    error: Error | null,
  };
}
```

**実装パターン**: 既存の `useNotificationSettings` と同じパターン（useEffect でマウント時に取得）

```typescript
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

### 6.3 既存ページの変更: `app/settings/notifications/page.tsx`

**変更内容**: `useNotificationHistory` と `NotificationHistory` コンポーネントを統合

```typescript
// 変更後
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

## 7. スタイル設計

### 7.1 `NotificationHistory.module.css`

```css
.container {
  max-width: 600px;
  margin: 24px auto 0;
  padding: 24px;
}

.title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
}

.historyList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.historyItem {
  padding: 12px 0;
  border-bottom: 1px solid #eee;
}

.historyItem:last-child {
  border-bottom: none;
}

.changedAt {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.changeDetail {
  font-size: 14px;
}

.oldValue {
  color: #e00;
  text-decoration: line-through;
}

.newValue {
  color: #0a0;
  font-weight: bold;
}

.emptyMessage {
  color: #888;
  font-size: 14px;
  padding: 16px 0;
}

.errorMessage {
  color: #e00;
  font-size: 14px;
  padding: 8px 12px;
  background: #fff0f0;
  border-radius: 6px;
}
```

## 8. ファイル変更一覧

### 8.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/notification.ts` | 型定義 | `NotificationHistoryEntry`, `NotificationSettingField`, `SETTING_FIELD_LABELS` の追加（既存ファイルへの追記） |
| `src/api/notificationClient.ts` | APIクライアント | `getNotificationHistory` 関数の追加（既存ファイルへの追記） |
| `src/hooks/useNotificationHistory.ts` | Hook | 履歴データ取得Hook（新規） |
| `src/components/NotificationHistory.tsx` | コンポーネント | 履歴表示コンポーネント（新規） |
| `src/components/NotificationHistory.module.css` | スタイル | 履歴表示のスタイル（新規） |
| `app/api/notifications/history/route.ts` | APIルート | 履歴取得APIのモック実装（新規） |
| `src/hooks/__tests__/useNotificationHistory.test.ts` | テスト | useNotificationHistory のユニットテスト（新規） |
| `src/components/__tests__/NotificationHistory.test.tsx` | テスト | NotificationHistory のユニットテスト（新規） |

### 8.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/notification.ts` | 履歴関連の型・定数を追加 |
| `src/api/notificationClient.ts` | `getNotificationHistory` 関数を追加 |
| `app/settings/notifications/page.tsx` | `useNotificationHistory` と `NotificationHistory` を統合 |

### 8.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/components/NotificationSettingsForm.tsx` | 設定フォーム自体に変更なし。履歴はページレベルで統合 |
| `src/components/NotificationSettingsForm.module.css` | スタイル変更なし |
| `src/hooks/useNotificationSettings.ts` | 設定取得・更新ロジックに変更なし |
| `app/api/notifications/settings/route.ts` | 既存の設定APIに変更なし |

## 9. テスト方針

### 9.1 ユニットテスト

#### `useNotificationHistory` のテスト

| # | テストケース |
|---|-------------|
| 1 | 履歴データを正常に取得できる |
| 2 | ローディング状態が正しく管理される |
| 3 | APIエラー時にエラー状態が設定される |
| 4 | 取得データが空配列の場合も正しく処理される |

#### `NotificationHistory` コンポーネントのテスト

| # | テストケース |
|---|-------------|
| 1 | 履歴データが正しく表示される（変更日時・フィールド名・変更前後の値） |
| 2 | boolean値（emailEnabled/pushEnabled）がON/OFFで表示される |
| 3 | frequency値が日本語ラベルで表示される |
| 4 | ローディング中に「読み込み中...」が表示される |
| 5 | エラー時に「履歴の取得に失敗しました」が表示される |
| 6 | 履歴が空の場合に「変更履歴はありません」が表示される |
| 7 | 複数件の履歴が時系列順に表示される |

### 9.2 テストパターン

既存の `useNotificationSettings.test.ts` と `NotificationSettingsForm.test.tsx` のパターンに準拠:
- APIクライアントを `jest.mock` でモック化
- `renderHook` / `render` + `waitFor` で非同期処理をテスト
- `@testing-library/react` を使用

## 10. 実装順序

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

## 11. 依存関係図

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

## 12. 実装上の注意事項

### 12.1 既存コンポーネントとの分離

- `NotificationSettingsForm` には手を加えず、履歴表示は独立した `NotificationHistory` コンポーネントとして実装する
- ページレベル（`app/settings/notifications/page.tsx`）で両コンポーネントを組み合わせる
- これにより、既存のテストに影響を与えない

### 12.2 日時フォーマット

- APIからは ISO 8601 形式の文字列で受け取る
- 表示時に `YYYY/MM/DD HH:mm` 形式に変換する
- 外部ライブラリは使用せず、`Date` オブジェクトと `toLocaleString` またはカスタムフォーマット関数で対応する

### 12.3 モックAPIデータ

- `app/api/notifications/history/route.ts` にインメモリのモックデータを用意
- 既存の `app/api/notifications/settings/route.ts` と同じパターンで実装
- 5件のサンプル履歴データを返却

### 12.4 エラーハンドリング

- 履歴取得エラーは設定表示をブロックしない
- 設定フォームと履歴の取得は独立して行い、片方がエラーでも他方は正常に表示する
- 履歴取得エラー時は履歴セクション内にエラーメッセージを表示

### 12.5 パッケージ追加

追加パッケージは不要。既存の依存関係のみで実装可能。
