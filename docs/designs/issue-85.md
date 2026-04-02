# 設計書: Issue #85 ActivityLog 型定義・APIクライアント・Route Handler の追加

## 1. 概要

アクティビティ履歴機能の基盤レイヤー（型定義・APIクライアント・モックエンドポイント）を構築する。

### 1.1 背景

親Issue #83 で計画されているアクティビティ履歴機能の実装にあたり、最初のステップとしてデータ型・API通信・バックエンドエンドポイントの基盤部分を構築する。この基盤を先に整備することで、後続の UI コンポーネントや Hook の実装をスムーズに進められる。

### 1.2 スコープ

- **対象**: 型定義（`src/types/activity.ts`）、APIクライアント（`src/api/activityClient.ts`）、Route Handler（`app/api/users/[id]/activities/route.ts`）
- **対象外**: UI コンポーネント、Hook、ページは後続 Issue で対応
- **依存関係**: なし（最初に着手）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | アクション種別 | `login`, `logout`, `profile_update`, `notification_settings_change` の4種 |
| 2 | `details` フィールド | `Record<string, unknown> \| null`（アクションによっては null） |
| 3 | ページネーション方式 | オフセットベース（`?page=1&limit=20`） |
| 4 | アイコン表現 | 絵文字（🔑🚪✏️🔔） |
| 5 | Issue分類 | type:feature-m（3ファイル新規作成） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ✅ 変更なし |
| **型定義** | `src/types/notification.ts` | `NotificationSettings` 等定義済み | ✅ 変更なし（パターン参照元） |
| **APIクライアント** | `src/api/client.ts` | ユーザー関連API関数 | ✅ 変更なし |
| **APIクライアント** | `src/api/notificationClient.ts` | 通知設定の取得・更新関数 | ✅ 変更なし（パターン参照元） |
| **Route Handler** | `app/api/notifications/settings/route.ts` | 通知設定のGET/PATCH | ✅ 変更なし（パターン参照元） |

### 2.2 既存のAPIクライアントパターン

```typescript
// src/api/notificationClient.ts（準拠するパターン）
import { NotificationSettings } from '../types/notification';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE}/notifications/settings`);
  if (!res.ok) throw new Error(`Failed to fetch notification settings: ${res.status}`);
  return res.json();
}
```

### 2.3 既存の型定義パターン

```typescript
// src/types/notification.ts（準拠するパターン）
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
```

### 2.4 既存の Route Handler パターン

```typescript
// app/api/notifications/settings/route.ts（準拠するパターン）
import { NextRequest, NextResponse } from 'next/server';

let mockSettings: NotificationSettings = { /* ... */ };

export async function GET() {
  return NextResponse.json(mockSettings);
}
```

## 3. 型定義

### 3.1 新規ファイル: `src/types/activity.ts`

```typescript
/**
 * アクティビティのアクション種別
 */
export type ActivityAction =
  | 'login'
  | 'logout'
  | 'profile_update'
  | 'notification_settings_change';

/**
 * アクティビティログ
 */
export interface ActivityLog {
  id: string;
  userId: string;
  action: ActivityAction;
  timestamp: string;
  details: Record<string, unknown> | null;
}

/**
 * ページネーション付きアクティビティレスポンス
 */
export interface PaginatedActivities {
  activities: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

/**
 * アクション種別の表示ラベル
 */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'ログイン',
  logout: 'ログアウト',
  profile_update: 'プロフィール更新',
  notification_settings_change: '通知設定変更',
};

/**
 * アクション種別のアイコン（絵文字）
 */
export const ACTION_ICONS: Record<ActivityAction, string> = {
  login: '🔑',
  logout: '🚪',
  profile_update: '✏️',
  notification_settings_change: '🔔',
};
```

#### 設計判断

| 項目 | 決定事項 | 理由 |
|------|----------|------|
| `details` の型 | `Record<string, unknown> \| null` | 構造化データだがアクションごとに内容が異なるため柔軟な型とする。null はアクションに付加情報がない場合 |
| `timestamp` の型 | `string`（ISO 8601形式） | JSON シリアライズとの互換性を確保するため文字列型を採用 |
| `id` の型 | `string` | 既存の `User.id` と同じ型に統一 |
| 定数の命名 | `ACTION_LABELS` / `ACTION_ICONS` | 既存の `FREQUENCY_LABELS` パターンに準拠 |

## 4. API設計

### 4.1 エンドポイント

#### GET `/api/users/[id]/activities`

指定ユーザーのアクティビティ履歴をページネーション付きで取得する。

**クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `page` | `number` | `1` | ページ番号（1始まり） |
| `limit` | `number` | `20` | 1ページあたりの件数 |

**レスポンス**（200 OK）:

```json
{
  "activities": [
    {
      "id": "act-1",
      "userId": "user-1",
      "action": "login",
      "timestamp": "2025-01-15T10:30:00Z",
      "details": null
    },
    {
      "id": "act-2",
      "userId": "user-1",
      "action": "profile_update",
      "timestamp": "2025-01-15T09:00:00Z",
      "details": { "field": "name", "oldValue": "旧名前", "newValue": "新名前" }
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "hasNext": true
}
```

**エラーレスポンス**:

| ステータス | 説明 | レスポンス |
|-----------|------|-----------|
| 400 | 不正なクエリパラメータ | `{ "error": "Invalid query parameters" }` |
| 200 | 正常取得 | 上記レスポンス形式 |

### 4.2 Route Handler 実装: `app/api/users/[id]/activities/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, PaginatedActivities } from '../../../../../src/types/activity';

// モックデータ
const mockActivities: ActivityLog[] = [
  {
    id: 'act-1',
    userId: 'user-1',
    action: 'login',
    timestamp: '2025-01-15T10:30:00Z',
    details: null,
  },
  {
    id: 'act-2',
    userId: 'user-1',
    action: 'profile_update',
    timestamp: '2025-01-15T09:00:00Z',
    details: { field: 'name', oldValue: '旧名前', newValue: '新名前' },
  },
  {
    id: 'act-3',
    userId: 'user-1',
    action: 'notification_settings_change',
    timestamp: '2025-01-14T16:45:00Z',
    details: { emailEnabled: true, pushEnabled: false },
  },
  {
    id: 'act-4',
    userId: 'user-1',
    action: 'logout',
    timestamp: '2025-01-14T12:00:00Z',
    details: null,
  },
  {
    id: 'act-5',
    userId: 'user-1',
    action: 'login',
    timestamp: '2025-01-14T08:30:00Z',
    details: null,
  },
  {
    id: 'act-6',
    userId: 'user-1',
    action: 'profile_update',
    timestamp: '2025-01-13T14:20:00Z',
    details: { field: 'bio', oldValue: '', newValue: 'こんにちは！' },
  },
  {
    id: 'act-7',
    userId: 'user-1',
    action: 'login',
    timestamp: '2025-01-13T09:00:00Z',
    details: null,
  },
  {
    id: 'act-8',
    userId: 'user-1',
    action: 'notification_settings_change',
    timestamp: '2025-01-12T11:30:00Z',
    details: { frequency: 'daily' },
  },
  {
    id: 'act-9',
    userId: 'user-1',
    action: 'logout',
    timestamp: '2025-01-12T10:00:00Z',
    details: null,
  },
  {
    id: 'act-10',
    userId: 'user-1',
    action: 'login',
    timestamp: '2025-01-12T08:00:00Z',
    details: null,
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  // バリデーション
  if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'Invalid query parameters' },
      { status: 400 }
    );
  }

  // ユーザーIDでフィルタリング
  const userActivities = mockActivities.filter(
    (activity) => activity.userId === params.id
  );

  const total = userActivities.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedItems = userActivities.slice(start, end);
  const hasNext = end < total;

  const response: PaginatedActivities = {
    activities: paginatedItems,
    total,
    page,
    limit,
    hasNext,
  };

  return NextResponse.json(response);
}
```

#### 設計ポイント

- モックデータは10件を用意し、4種すべてのアクション種別をカバー
- `details` が null のパターンと値があるパターンの両方を含む
- ページネーションのバリデーション: `page >= 1`, `limit: 1〜100`
- ユーザーIDによるフィルタリングを実装（将来的な複数ユーザー対応を見据える）

### 4.3 APIクライアント: `src/api/activityClient.ts`

```typescript
import { PaginatedActivities } from '../types/activity';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * ユーザーのアクティビティ履歴を取得する
 */
export async function getUserActivities(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedActivities> {
  const res = await fetch(
    `${API_BASE}/users/${userId}/activities?page=${page}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Failed to fetch activities: ${res.status}`);
  return res.json();
}
```

#### 設計ポイント

- 既存の `notificationClient.ts` のパターンに完全準拠
  - `API_BASE` 定数の定義方法
  - `fetch` + `res.ok` チェック + `throw new Error` のエラーハンドリング
  - 戻り値の型を `Promise<T>` で明示
- 引数 `page` と `limit` にはデフォルト値を設定（呼び出し側の簡便化）
- URLクエリパラメータとして `page` と `limit` を付与

## 5. ファイル変更一覧

### 5.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/activity.ts` | 型定義 | `ActivityAction`, `ActivityLog`, `PaginatedActivities`, `ACTION_LABELS`, `ACTION_ICONS` |
| `src/api/activityClient.ts` | APIクライアント | `getUserActivities(userId, page, limit)` |
| `app/api/users/[id]/activities/route.ts` | Route Handler | GET エンドポイント（モックデータ、ページネーション対応） |

### 5.2 変更ファイル

なし

### 5.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | アクティビティは独立した型ファイルに定義するため変更不要 |
| `src/types/notification.ts` | スコープ外 |
| `src/api/client.ts` | アクティビティ用クライアントは独立ファイルに作成するため変更不要 |
| `src/api/notificationClient.ts` | スコープ外 |

## 6. 実装上の注意事項

### 6.1 既存パターンへの準拠

- **型定義ファイル**: `src/types/notification.ts` のパターンに倣い、type → interface → 定数 の順で定義
- **APIクライアント**: `src/api/notificationClient.ts` のパターンに倣い、`API_BASE` 定数 + `fetch` ベースの関数を実装
- **Route Handler**: `app/api/notifications/settings/route.ts` のパターンに倣い、`NextRequest` / `NextResponse` を使用

### 6.2 モックデータの取り扱い

- Route Handler ではファイル内のモック配列にデータを保持（サーバー再起動でリセット）
- 実際のDB連携は後続Issueで対応
- モックデータにはすべてのアクション種別（`login`, `logout`, `profile_update`, `notification_settings_change`）を含める
- `details` が `null` のケースと値があるケースの両方を用意

### 6.3 ページネーション

- オフセットベース方式（`?page=1&limit=20`）
- `page` は1始まり
- `limit` のデフォルト値は 20、上限は 100
- `hasNext` フラグで次ページの有無を示す

### 6.4 型の拡張性

- `ActivityAction` は union type で定義しており、将来のアクション種別追加が容易
- `details` を `Record<string, unknown> | null` とすることで、アクションごとに異なる付加情報を柔軟に格納可能
- `ACTION_LABELS` / `ACTION_ICONS` は `ActivityAction` をキーとする Record 型のため、アクション種別追加時に型チェックで漏れを検出可能

## 7. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 依存先 |
|------|----------|------|--------|
| 1 | `src/types/activity.ts` | 型定義 | なし |
| 2 | `src/api/activityClient.ts` | APIクライアント | 順序1 |
| 3 | `app/api/users/[id]/activities/route.ts` | Route Handler | 順序1 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能

## 8. 依存関係図

```
src/types/activity.ts（新規: 型定義）
  ├─→ src/api/activityClient.ts（新規: APIクライアント）
  │
  └─→ app/api/users/[id]/activities/route.ts（新規: Route Handler）
```

## 9. 後続Issueへの接続点

本Issueで構築する基盤は、親Issue #83 の後続タスクで以下のように利用される:

- **Hook**: `src/hooks/useActivityLog.ts` で `getUserActivities` を呼び出し
- **コンポーネント**: `ActivityLog` 型と `ACTION_LABELS` / `ACTION_ICONS` 定数を参照してUIを構築
- **ページ**: Hook + コンポーネントを組み合わせてアクティビティ履歴ページを構成
