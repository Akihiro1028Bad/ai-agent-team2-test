# 設計書: Issue #136 通知一覧に「すべて既読にする」ボタンを追加

## 1. 概要

通知一覧画面を新規作成し、ヘッダー右側に「すべて既読にする」ボタンを配置する。

- `GET /notifications` で通知一覧を取得・表示
- 「すべて既読にする」ボタンで `POST /notifications/read-all` を呼び出し、全未読を既読に変更
- 未読 0 件時はボタンを `disabled` にする
- 処理中はローディング表示で二重実行を防止
- 失敗時はインラインエラーメッセージを表示（既存の `saveError` パターンに倣う）

### 1.1 スコープ

| 対象 | 内容 |
|------|------|
| **対象** | 型定義・APIクライアント・カスタムフック・通知一覧コンポーネント・ページ・モック Route Handler |
| **対象外** | ヘッダーの未読バッジ更新（Issue #135）、DB・バックエンド変更、トーストライブラリ追加 |

### 1.2 エラー表示方針

プロジェクトにトーストライブラリが存在しないため、既存の `NotificationSettingsForm` における `saveError` ステートパターン（インライン `<div class="errorMessage">` 表示）を踏襲する。

---

## 2. 既存コードの分析

### 2.1 現在の実装状況

| ファイル | 現状 | 変更要否 |
|---------|------|----------|
| `src/types/notification.ts` | `NotificationSettings` のみ定義 | ⚠️ `Notification` 型を追加 |
| `src/api/notificationClient.ts` | 通知設定の取得・更新のみ | ⚠️ `getNotifications()` / `markAllAsRead()` を追加 |
| `src/hooks/useNotificationSettings.ts` | 通知設定専用 Hook | ✅ 変更なし |
| `src/components/NotificationSettingsForm.tsx` | 通知設定フォームのみ | ✅ 変更なし |

### 2.2 既存パターン

**APIクライアントパターン** (`src/api/notificationClient.ts`):

```typescript
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`);
  if (!res.ok) throw new Error(`Failed to fetch notification settings: ${res.status}`);
  return res.json();
}
```

**Hookパターン** (`src/hooks/useNotificationSettings.ts`):

```typescript
export function useNotificationSettings() {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // fetch on mount + update function
  return { data, loading, error, updateFn };
}
```

**エラー表示パターン** (`src/components/NotificationSettingsForm.tsx`):

```tsx
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);

{saveError && <div className={styles.errorMessage}>{saveError}</div>}
<button disabled={isSaving}>{isSaving ? '処理中...' : '実行'}</button>
```

---

## 3. 型定義

### 3.1 変更ファイル: `src/types/notification.ts`

既存の `NotificationSettings` 定義はそのままに、以下を追加する。

```typescript
/**
 * 個別通知アイテム
 */
export interface Notification {
  id: string;
  title: string;
  body?: string;
  isRead: boolean;
  createdAt: string; // ISO 8601 形式
}
```

---

## 4. API設計

### 4.1 GET `/api/notifications`

通知一覧を取得する（モック実装）。

**レスポンス**:
```json
[
  { "id": "1", "title": "コメントが届きました", "body": "...", "isRead": false, "createdAt": "2026-06-11T09:00:00Z" },
  { "id": "2", "title": "いいねされました", "isRead": true, "createdAt": "2026-06-10T15:00:00Z" }
]
```

| ステータス | 説明 |
|-----------|------|
| 200 | 一覧取得成功 |
| 500 | サーバーエラー |

### 4.2 POST `/api/notifications/read-all`

未読通知をすべて既読にする（モック実装）。

**リクエストボディ**: なし

**レスポンス**:
```json
{ "updatedCount": 1 }
```

| ステータス | 説明 |
|-----------|------|
| 200 | 全既読処理成功 |
| 500 | サーバーエラー |

### 4.3 Route Handler 実装ファイル

```
app/api/notifications/route.ts            ← 新規（GET /api/notifications）
app/api/notifications/read-all/route.ts   ← 新規（POST /api/notifications/read-all）
```

```typescript
// app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { Notification } from '../../../../src/types/notification';

// モックデータ（インメモリ）
let mockNotifications: Notification[] = [
  { id: '1', title: 'コメントが届きました', body: 'ユーザーAがコメントしました', isRead: false, createdAt: '2026-06-11T09:00:00Z' },
  { id: '2', title: 'いいねされました', isRead: true, createdAt: '2026-06-10T15:00:00Z' },
];

export async function GET() {
  return NextResponse.json(mockNotifications);
}
```

```typescript
// app/api/notifications/read-all/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  // モックデータ参照を更新（実際のDB処理は後続Issueで対応）
  // TODO: 実DBとの連携
  const updatedCount = mockNotifications.filter((n) => !n.isRead).length;
  mockNotifications = mockNotifications.map((n) => ({ ...n, isRead: true }));
  return NextResponse.json({ updatedCount });
}
```

> **注意**: `mockNotifications` はモジュール間で共有するため、`route.ts` 同士の参照方法は実装時にファイル分割か共通モジュール化で対応する。

---

## 5. APIクライアント設計

### 5.1 変更ファイル: `src/api/notificationClient.ts`

既存関数はそのままに、以下を追記する。

```typescript
import { Notification, NotificationSettings } from '../types/notification';

/**
 * 通知一覧を取得する
 */
export async function getNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
  return res.json();
}

/**
 * 全未読通知を既読にする
 */
export async function markAllAsRead(): Promise<{ updatedCount: number }> {
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to mark all as read: ${res.status}`);
  return res.json();
}
```

---

## 6. カスタムフック設計

### 6.1 新規ファイル: `src/hooks/useNotificationList.ts`

**責務**: 通知一覧の取得、全既読処理、ローディング・エラー状態の管理

```typescript
export function useNotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    // getNotifications() で一覧を取得
  }, []);

  const handleMarkAllAsRead = async () => {
    // markAllAsRead() を呼び出し、成功時は全通知の isRead を true に更新
    // 失敗時は markAllReadError をセット、通知状態は変更しない
  };

  return { notifications, loading, error, unreadCount, isMarkingAllRead, markAllReadError, handleMarkAllAsRead };
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `notifications` | `Notification[]` | 通知一覧 |
| `loading` | `boolean` | 一覧取得中フラグ |
| `error` | `Error \| null` | 一覧取得エラー |
| `unreadCount` | `number` | 未読件数（派生値） |
| `isMarkingAllRead` | `boolean` | 全既読処理中フラグ |
| `markAllReadError` | `string \| null` | 全既読エラーメッセージ |
| `handleMarkAllAsRead` | `() => Promise<void>` | 全既読実行関数 |

---

## 7. コンポーネント設計

### 7.1 新規コンポーネント: `src/components/NotificationList.tsx`

**責務**: 通知一覧の表示、「すべて既読にする」ボタンのUI制御

**Props**:
```typescript
interface NotificationListProps {
  notifications: Notification[];
  unreadCount: number;
  isMarkingAllRead: boolean;
  markAllReadError: string | null;
  onMarkAllAsRead: () => Promise<void>;
}
```

**UI構成**:

```
┌────────────────────────────────────────────┐
│  通知一覧                [すべて既読にする] │  ← ヘッダー右側にボタン
│  ──────────────────────────────────────── │
│  ※ エラー時: [エラーメッセージ]             │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │ ● コメントが届きました (未読)       │    │
│  │   ユーザーAがコメントしました        │    │
│  │   2026-06-11 09:00                  │    │
│  └────────────────────────────────────┘    │
│                                            │
│  ┌────────────────────────────────────┐    │
│  │   いいねされました (既読)           │    │
│  │   2026-06-10 15:00                  │    │
│  └────────────────────────────────────┘    │
└────────────────────────────────────────────┘
```

**ボタン状態**:

| 条件 | ボタン表示 |
|------|-----------|
| 未読 1件以上 / 処理中でない | `すべて既読にする`（active） |
| 処理中 (`isMarkingAllRead: true`) | `処理中...`（disabled） |
| 未読 0件 | `すべて既読にする`（disabled） |

```tsx
<button
  onClick={onMarkAllAsRead}
  disabled={unreadCount === 0 || isMarkingAllRead}
  className={styles.markAllReadButton}
>
  {isMarkingAllRead ? '処理中...' : 'すべて既読にする'}
</button>
```

### 7.2 新規CSSモジュール: `src/components/NotificationList.module.css`

| クラス名 | 説明 |
|---------|------|
| `.container` | 全体のコンテナ |
| `.header` | ヘッダー（タイトル＋ボタンを横並び） |
| `.title` | 「通知一覧」タイトル |
| `.markAllReadButton` | 「すべて既読にする」ボタン |
| `.errorMessage` | エラーメッセージ表示 |
| `.list` | 通知アイテムのリスト |
| `.item` | 個別通知アイテム |
| `.itemUnread` | 未読アイテムのハイライト |
| `.itemTitle` | 通知タイトル |
| `.itemBody` | 通知本文 |
| `.itemDate` | 通知日時 |
| `.empty` | 通知 0件時のメッセージ |

---

## 8. ページコンポーネント設計

### 8.1 新規ページ: `app/notifications/page.tsx`

**責務**: `useNotificationList` フックと `NotificationList` コンポーネントの接続

```tsx
'use client';

import React from 'react';
import { useNotificationList } from '../../src/hooks/useNotificationList';
import { NotificationList } from '../../src/components/NotificationList';

export default function NotificationsPage() {
  const { notifications, loading, error, unreadCount, isMarkingAllRead, markAllReadError, handleMarkAllAsRead } =
    useNotificationList();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <NotificationList
      notifications={notifications}
      unreadCount={unreadCount}
      isMarkingAllRead={isMarkingAllRead}
      markAllReadError={markAllReadError}
      onMarkAllAsRead={handleMarkAllAsRead}
    />
  );
}
```

---

## 9. 状態管理

### 9.1 状態遷移図

```
[/notifications ページ表示]
  ↓
  Loading 中（loading: true）
    → エラー → "エラーが発生しました: {message}"
    → 成功   → NotificationList 表示
                 ┌ 未読あり: ボタン active
                 └ 未読なし: ボタン disabled
                      ↓（ボタンクリック）
                   処理中（isMarkingAllRead: true）
                    → 成功: 全通知 isRead = true、ボタン disabled
                    → 失敗: markAllReadError 表示、通知状態変更なし
```

### 9.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `notifications` | `useNotificationList` | 通知一覧データ |
| `loading` | `useNotificationList` | 一覧取得中フラグ |
| `error` | `useNotificationList` | 一覧取得エラー |
| `unreadCount` | `useNotificationList`（派生値） | 未読件数 |
| `isMarkingAllRead` | `useNotificationList` | 全既読処理中フラグ |
| `markAllReadError` | `useNotificationList` | 全既読エラーメッセージ |

---

## 10. ファイル変更一覧

### 10.1 新規作成

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `app/api/notifications/route.ts` | API Route | GET /api/notifications（モック） |
| `app/api/notifications/read-all/route.ts` | API Route | POST /api/notifications/read-all（モック） |
| `src/hooks/useNotificationList.ts` | Hook | 通知一覧の取得・全既読処理 |
| `src/components/NotificationList.tsx` | コンポーネント | 通知一覧UI |
| `src/components/NotificationList.module.css` | スタイル | 通知一覧のスタイル |
| `app/notifications/page.tsx` | ページ | 通知一覧ページ |

### 10.2 変更あり

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/notification.ts` | `Notification` インターフェースを追加 |
| `src/api/notificationClient.ts` | `getNotifications()` / `markAllAsRead()` を追加 |

### 10.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/hooks/useNotificationSettings.ts` | 通知設定のみ管理、スコープ外 |
| `src/components/NotificationSettingsForm.tsx` | スコープ外 |
| `src/components/Header.tsx` | 未読バッジは Issue #135 で対応 |

---

## 11. セキュリティ考慮事項

| 項目 | 対応方針 |
|------|---------|
| API レスポンスのバリデーション | `getNotifications()` は配列であることを前提とし、型アサーション後に使用。不正なデータはエラーとして扱う |
| エラーメッセージの機密情報 | ユーザー向けエラーメッセージは固定文言（`'すべて既読の処理に失敗しました'`）。スタックトレース等は表示しない |
| 二重送信防止 | `isMarkingAllRead` フラグで処理中はボタン `disabled` にし、二重 POST を防ぐ |
| 認証 | モック Route Handler では認証チェックなし。実DB連携時に NextAuth.js との統合を実施（TODO コメントで明示） |

---

## 12. テスト方針

### 12.1 ユニットテスト対象

| テスト対象 | テストファイル | テストカバレッジ目標 |
|-----------|---------------|-------------------|
| `notificationClient.ts`（追加関数） | `src/api/__tests__/notificationClient.test.ts` | 80%以上 |
| `useNotificationList` | `src/hooks/__tests__/useNotificationList.test.ts` | 80%以上 |
| `NotificationList` コンポーネント | `src/components/__tests__/NotificationList.test.tsx` | 80%以上 |

### 12.2 テストケース詳細

#### `notificationClient.test.ts`（追加分）

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | `getNotifications()` 正常系 | fetch が呼ばれ、配列が返ること |
| 2 | `getNotifications()` 異常系 | `res.ok` が false の場合エラーをスローすること |
| 3 | `markAllAsRead()` 正常系 | POST が呼ばれ、`{ updatedCount }` が返ること |
| 4 | `markAllAsRead()` 異常系 | `res.ok` が false の場合エラーをスローすること |

#### `useNotificationList.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期ローディング | マウント時 `loading: true` であること |
| 2 | 一覧取得成功 | `notifications` に取得データがセットされること |
| 3 | 一覧取得エラー | `error` にエラーがセットされること |
| 4 | `unreadCount` 計算 | `isRead: false` の件数のみカウントされること |
| 5 | `handleMarkAllAsRead` 成功 | 全通知の `isRead` が `true` になること |
| 6 | `handleMarkAllAsRead` 失敗 | `markAllReadError` がセットされ、通知データが変更されないこと |
| 7 | 処理中フラグ | `handleMarkAllAsRead` 実行中は `isMarkingAllRead: true` であること |
| 8 | 二重実行防止 | 処理中に再呼び出しが行われないこと（フック側はフラグ管理のみ、UI側でテスト） |

#### `NotificationList.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 通知一覧表示 | 渡された通知が全件表示されること |
| 2 | 未読あり | ボタンが active（`disabled` でない）であること |
| 3 | 未読 0件 | ボタンが `disabled` であること |
| 4 | ボタンクリック | `onMarkAllAsRead` が呼ばれること |
| 5 | 処理中表示 | `isMarkingAllRead: true` のとき「処理中...」が表示されボタンが `disabled` になること |
| 6 | エラーメッセージ | `markAllReadError` に値がある場合エラーメッセージが表示されること |
| 7 | 通知 0件 | 「通知はありません」等の空状態メッセージが表示されること |
| 8 | 未読・既読の区別 | 未読アイテムにハイライトクラスが付与されること |

### 12.3 Fakeパターン

```typescript
// fetch のモック例（jest.setup.ts のパターンに倣う）
global.fetch = jest.fn();

beforeEach(() => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => mockNotifications,
  });
});
```

---

## サブタスク

### subtask-1: 型定義追加 + モック Route Handler 新規作成
- files: [`src/types/notification.ts`, `app/api/notifications/route.ts`, `app/api/notifications/read-all/route.ts`]
- depends_on: []
- description: `src/types/notification.ts` に `Notification` インターフェースを追加。`GET /api/notifications` と `POST /api/notifications/read-all` のモック Route Handler を新規作成（インメモリデータで動作）。

### subtask-2: APIクライアント拡張 + テスト
- files: [`src/api/notificationClient.ts`, `src/api/__tests__/notificationClient.test.ts`]
- depends_on: [1]
- description: `src/api/notificationClient.ts` に `getNotifications()` と `markAllAsRead()` 関数を追加。既存パターンに倣い fetch ラッパーとして実装。対応するユニットテストを新規作成。

### subtask-3: カスタムフック新規作成 + テスト
- files: [`src/hooks/useNotificationList.ts`, `src/hooks/__tests__/useNotificationList.test.ts`]
- depends_on: [2]
- description: `useNotificationList` フックを新規作成。通知一覧の取得（マウント時）、未読件数の派生計算、全既読処理（ローディング・エラー・楽観的更新なし）を実装。対応するユニットテストを新規作成。

### subtask-4: 通知一覧コンポーネント + ページ + テスト
- files: [`src/components/NotificationList.tsx`, `src/components/NotificationList.module.css`, `app/notifications/page.tsx`, `src/components/__tests__/NotificationList.test.tsx`]
- depends_on: [3]
- description: `NotificationList` コンポーネントと CSS モジュールを新規作成。ヘッダー右側に「すべて既読にする」ボタン（未読 0件 / 処理中は disabled）、エラーメッセージ表示、通知アイテム一覧（未読ハイライト・空状態）を実装。`app/notifications/page.tsx` でフックとコンポーネントを接続。コンポーネントのユニットテストを新規作成。
