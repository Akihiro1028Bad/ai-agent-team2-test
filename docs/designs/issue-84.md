# 設計書: Issue #84 ActivityLog 型定義・APIクライアント・Route Handler の追加

## 1. 概要

アクティビティ履歴機能の基盤レイヤー（型定義・APIクライアント・モックエンドポイント）を構築する。

- `ActivityAction` union type と `ActivityLog` interface の型定義
- ページネーション対応の `PaginatedActivities` interface
- アクションラベル・アイコンの定数定義
- APIクライアント関数 `getUserActivities()`
- GET Route Handler（モックデータ、ページネーション対応）

### 1.1 背景

親Issue #83 のアクティビティ履歴機能を実装するにあたり、最初に着手すべき基盤レイヤーを構築する。本Issueは他のサブIssueへの依存がなく、最初に着手可能である。

### 1.2 スコープ

- **対象**: 型定義（`src/types/activity.ts`）、APIクライアント（`src/api/activityClient.ts`）、Route Handler（`app/api/users/[id]/activities/route.ts`）
- **対象外**: UI コンポーネント、Hook、ページコンポーネント（後続Issueで対応）
- **API方式**: Route Handler（GET）、モックデータで実装
- **認証**: NextAuth.js 対応済みの想定（TODO コメントで明示）

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ✅ 変更なし |
| **型定義** | `src/types/notification.ts` | `NotificationSettings` 等定義済み | ✅ 変更なし（参考パターン） |
| **APIクライアント** | `src/api/client.ts` | ユーザー関連のAPI関数 | ✅ 変更なし |
| **APIクライアント** | `src/api/notificationClient.ts` | 通知設定関連のAPI関数 | ✅ 変更なし（参考パターン） |
| **Route Handler** | `app/api/notifications/settings/route.ts` | 通知設定のGET/PATCH | ✅ 変更なし（参考パターン） |

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

### 2.3 既存の型定義パターン

```typescript
// src/types/notification.ts（現在のパターン）
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

### 2.4 既存のRoute Handlerパターン

```typescript
// app/api/notifications/settings/route.ts（現在のパターン）
import { NextRequest, NextResponse } from 'next/server';

// モックデータ（インメモリ保存）
let mockSettings: XxxSettings = { ... };

export async function GET() {
  // TODO: NextAuth.js 認証チェック
  return NextResponse.json(mockSettings);
}
```

## 3. 型定義

### 3.1 新規ファイル: `src/types/activity.ts`

```typescript
/**
 * アクティビティアクションの種別
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
 * アクションの表示ラベル
 */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  login: 'ログイン',
  logout: 'ログアウト',
  profile_update: 'プロフィール更新',
  notification_settings_change: '通知設定変更',
};

/**
 * アクションのアイコン（絵文字）
 */
export const ACTION_ICONS: Record<ActivityAction, string> = {
  login: '🔑',
  logout: '🚪',
  profile_update: '✏️',
  notification_settings_change: '🔔',
};
```

**設計判断**:
- `details` フィールドは `Record<string, unknown> | null` とする。アクションの種別によって構造化データを含む場合と、何も含まない場合（null）がある
- `timestamp` は ISO 8601 形式の文字列（`string`）として扱う。Date オブジェクトへの変換は表示レイヤーの責務とする
- `id` は UUID 文字列を想定

## 4. API設計

### 4.1 Route Handler（モックデータ）

#### GET `/api/users/[id]/activities`

指定ユーザーのアクティビティ履歴をページネーション付きで取得する。

**クエリパラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `page` | `number` | `1` | ページ番号（1始まり） |
| `limit` | `number` | `20` | 1ページあたりの件数 |

**レスポンス（200 OK）**:
```json
{
  "activities": [
    {
      "id": "act-1",
      "userId": "user-1",
      "action": "login",
      "timestamp": "2026-04-02T10:00:00Z",
      "details": null
    },
    {
      "id": "act-2",
      "userId": "user-1",
      "action": "profile_update",
      "timestamp": "2026-04-01T15:30:00Z",
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

| ステータス | レスポンス | 説明 |
|-----------|-----------|------|
| 200 | `PaginatedActivities` | 取得成功 |
| 400 | `{ "error": "..." }` | 不正なクエリパラメータ |
| 401 | `{ "error": "Unauthorized" }` | 未認証（TODO） |
| 500 | `{ "error": "Internal Server Error" }` | サーバーエラー |

### 4.2 Route Handler 実装ファイル

```
app/api/users/[id]/activities/route.ts ← 新規
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog } from '../../../../../src/types/activity';

// モックデータ（インメモリ — サーバー再起動でリセット）
const mockActivities: ActivityLog[] = [
  {
    id: 'act-1',
    userId: 'user-1',
    action: 'login',
    timestamp: '2026-04-02T10:00:00Z',
    details: null,
  },
  {
    id: 'act-2',
    userId: 'user-1',
    action: 'profile_update',
    timestamp: '2026-04-01T15:30:00Z',
    details: { field: 'name', oldValue: '旧名前', newValue: '新名前' },
  },
  {
    id: 'act-3',
    userId: 'user-1',
    action: 'notification_settings_change',
    timestamp: '2026-04-01T12:00:00Z',
    details: { setting: 'emailEnabled', oldValue: true, newValue: false },
  },
  {
    id: 'act-4',
    userId: 'user-1',
    action: 'logout',
    timestamp: '2026-04-01T09:00:00Z',
    details: null,
  },
  {
    id: 'act-5',
    userId: 'user-1',
    action: 'login',
    timestamp: '2026-04-01T08:00:00Z',
    details: null,
  },
  {
    id: 'act-6',
    userId: 'user-1',
    action: 'profile_update',
    timestamp: '2026-03-31T14:00:00Z',
    details: { field: 'bio', oldValue: '', newValue: '自己紹介文' },
  },
  {
    id: 'act-7',
    userId: 'user-1',
    action: 'login',
    timestamp: '2026-03-31T09:00:00Z',
    details: null,
  },
  {
    id: 'act-8',
    userId: 'user-1',
    action: 'notification_settings_change',
    timestamp: '2026-03-30T16:00:00Z',
    details: { setting: 'frequency', oldValue: 'immediate', newValue: 'daily' },
  },
  {
    id: 'act-9',
    userId: 'user-1',
    action: 'logout',
    timestamp: '2026-03-30T12:00:00Z',
    details: null,
  },
  {
    id: 'act-10',
    userId: 'user-1',
    action: 'login',
    timestamp: '2026-03-30T08:00:00Z',
    details: null,
  },
];

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // TODO: NextAuth.js 認証チェック
  const { id: userId } = params;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));

  // ユーザーIDでフィルタリング
  const userActivities = mockActivities.filter((a) => a.userId === userId);
  const total = userActivities.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const activities = userActivities.slice(start, end);
  const hasNext = end < total;

  return NextResponse.json({
    activities,
    total,
    page,
    limit,
    hasNext,
  });
}
```

**設計判断**:
- `page` のデフォルトは `1`、`limit` のデフォルトは `20`
- `limit` は最大100、最小1に制限
- モックデータは10件用意し、ページネーションの動作確認が可能な量とする
- 全モックデータの `userId` は `'user-1'` で統一（既存の `client.ts` パターンと整合）

### 4.3 APIクライアント

```
src/api/activityClient.ts ← 新規
```

既存の `src/api/notificationClient.ts` のパターンに準拠し、アクティビティ用のAPIクライアントを独立ファイルとして新規作成する。

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

**設計判断**:
- 関数シグネチャは `getUserActivities(userId, page, limit)` とし、Issue仕様に準拠
- `page` と `limit` にはデフォルト値を設定し、呼び出し側の利便性を確保
- 既存の `notificationClient.ts` と同様に `API_BASE` 定数を使用

## 5. ファイル変更一覧

### 5.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/activity.ts` | 型定義 | `ActivityAction`, `ActivityLog`, `PaginatedActivities`, `ACTION_LABELS`, `ACTION_ICONS` |
| `src/api/activityClient.ts` | APIクライアント | `getUserActivities()` 関数 |
| `app/api/users/[id]/activities/route.ts` | Route Handler | GET（モックデータ、ページネーション対応） |

### 5.2 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | アクティビティは独立した型ファイルに定義するため変更不要 |
| `src/types/notification.ts` | スコープ外 |
| `src/api/client.ts` | アクティビティ用クライアントは独立ファイルに作成するため変更不要 |
| `src/api/notificationClient.ts` | スコープ外 |

## 6. 実装上の注意事項

### 6.1 モックデータの取り扱い

- Route Handler ではインメモリ配列にデータを保持する（サーバー再起動でリセット）
- 実際のDB連携は後続Issueで対応
- モックデータを使用していることをコード内コメントで明記する
- モックデータは全アクション種別（`login`, `logout`, `profile_update`, `notification_settings_change`）を含む

### 6.2 認証チェック

- Route Handler 内の認証チェックは `// TODO: NextAuth.js 認証チェック` コメントで明示し、認証Issueの完了後に統合する
- 既存の `app/api/notifications/settings/route.ts` と同じ方針

### 6.3 ページネーション

- オフセットベース方式（`?page=1&limit=20`）を採用
- レスポンス形式: `{ activities, total, page, limit, hasNext }`
- `page` は1始まり（0始まりではない）
- `limit` の上限は100に制限し、過大なリクエストを防止

### 6.4 型安全性

- `details` フィールドの型は `Record<string, unknown> | null` とし、型安全性と柔軟性を両立
- `ActivityAction` union type により、未知のアクション種別をコンパイル時に検出可能

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
  └─→ app/api/users/[id]/activities/route.ts（新規: Route Handler）
```
