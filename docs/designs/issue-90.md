# 設計書: Issue #90 ActivityLog 型定義・APIクライアント・Route Handler の追加

## 1. 概要

アクティビティ履歴機能の基盤レイヤー（型定義・APIクライアント・モックエンドポイント）を構築する。

- `ActivityAction` union型、`ActivityLog` インターフェース、`PaginatedActivities` インターフェースの型定義
- アクション種別のラベル定数・アイコン定数の定義
- `getUserActivities` APIクライアント関数の実装
- GET Route Handler（モックデータ、ページネーション対応）の実装

### 1.1 背景

親Issue #83（アクティビティ履歴機能）の最初のサブタスクとして、後続の UI コンポーネントや Hook が依存する基盤レイヤーを先行して構築する。依存関係がないため最初に着手する。

### 1.2 スコープ

- **対象**: 型定義（`src/types/`）、APIクライアント（`src/api/`）、Route Handler（`app/api/`）
- **対象外**: UIコンポーネント、Hook、ページコンポーネントは後続Issueで対応
- **API方式**: Route Handler（GET）、モックデータで実装
- **ページネーション**: オフセットベース (`?page=1&limit=20`)

### 1.3 設計判断

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | `details` フィールドの型 | `Record<string, unknown> \| null`（構造化データ、アクションによってはnull） |
| 2 | ページネーション方式 | オフセットベース (`?page=1&limit=20`) |
| 3 | レスポンス形式 | `{ activities, total, page, limit, hasNext }` |
| 4 | アイコン表現 | 絵文字（🔑🚪✏️🔔） |
| 5 | アクション種別 | `login`, `logout`, `profile_update`, `notification_settings_change` |
| 6 | APIクライアントパターン | 既存 `notificationClient.ts` に準拠（独立ファイル） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/notification.ts` | 通知設定の型定義パターンが確立済み | ✅ 参考にする（変更なし） |
| **型定義** | `src/types/user.ts` | ユーザー型定義済み | ✅ 変更なし |
| **APIクライアント** | `src/api/notificationClient.ts` | 独立ファイルパターンが確立済み | ✅ 参考にする（変更なし） |
| **APIクライアント** | `src/api/client.ts` | ユーザー関連のAPI関数 | ✅ 変更なし |
| **Route Handler** | `app/api/notifications/settings/route.ts` | モックデータ＋インメモリ保存パターン | ✅ 参考にする（変更なし） |

### 2.2 既存のAPIクライアントパターン

```typescript
// src/api/notificationClient.ts（参考パターン）
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
// src/types/notification.ts（参考パターン）
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
// app/api/notifications/settings/route.ts（参考パターン）
import { NextRequest, NextResponse } from 'next/server';

// モックデータ（インメモリ保存）
let mockSettings: NotificationSettings = { ... };

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
 * アクション種別の日本語ラベル
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

### 3.2 型定義の設計意図

| 型/定数 | 設計意図 |
|---------|----------|
| `ActivityAction` | union型で取りうるアクション種別を厳密に制約する。後続Issueでアクション種別が追加される場合はここに追記する |
| `ActivityLog` | 1件のアクティビティログを表す。`timestamp` は ISO 8601 形式の文字列（APIレスポンスとの整合性のため） |
| `PaginatedActivities` | ページネーション対応のレスポンス型。`hasNext` フラグにより次ページの有無をクライアント側で簡潔に判定可能 |
| `ACTION_LABELS` | UIで日本語表示する際のラベルマッピング。`Record<ActivityAction, string>` により網羅性を型レベルで保証 |
| `ACTION_ICONS` | アクション種別ごとの絵文字アイコン。`Record<ActivityAction, string>` により網羅性を型レベルで保証 |

## 4. API設計

### 4.1 Route Handler（モックデータ）

#### GET `/api/users/[id]/activities`

指定ユーザーのアクティビティ履歴を取得する（ページネーション対応）。

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
      "timestamp": "2025-01-15T10:30:00Z",
      "details": null
    },
    {
      "id": "act-2",
      "userId": "user-1",
      "action": "profile_update",
      "timestamp": "2025-01-15T09:00:00Z",
      "details": { "field": "name", "oldValue": "太郎", "newValue": "花太郎" }
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "hasNext": true
}
```

| ステータス | 説明 |
|-----------|------|
| 200 | アクティビティ取得成功 |
| 400 | 不正なクエリパラメータ |

### 4.2 Route Handler 実装ファイル

```
app/api/users/[id]/activities/route.ts ← 新規
```

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, ActivityAction } from '../../../../../src/types/activity';

// モックデータ生成
function generateMockActivities(userId: string): ActivityLog[] {
  const actions: { action: ActivityAction; details: Record<string, unknown> | null }[] = [
    { action: 'login', details: null },
    { action: 'logout', details: null },
    { action: 'profile_update', details: { field: 'name', oldValue: '太郎', newValue: '花太郎' } },
    { action: 'notification_settings_change', details: { emailEnabled: true, pushEnabled: false } },
    { action: 'login', details: null },
    { action: 'profile_update', details: { field: 'bio', oldValue: '', newValue: 'こんにちは' } },
    { action: 'logout', details: null },
    { action: 'login', details: null },
    { action: 'notification_settings_change', details: { frequency: 'daily' } },
    { action: 'login', details: null },
    { action: 'logout', details: null },
    { action: 'profile_update', details: { field: 'location', oldValue: '東京', newValue: '大阪' } },
    { action: 'login', details: null },
    { action: 'profile_update', details: { field: 'website', oldValue: '', newValue: 'https://example.com' } },
    { action: 'logout', details: null },
    { action: 'login', details: null },
    { action: 'notification_settings_change', details: { pushEnabled: true } },
    { action: 'login', details: null },
    { action: 'logout', details: null },
    { action: 'login', details: null },
    { action: 'profile_update', details: { field: 'name', oldValue: '花太郎', newValue: '次郎' } },
    { action: 'logout', details: null },
    { action: 'login', details: null },
    { action: 'login', details: null },
    { action: 'logout', details: null },
  ];

  const baseDate = new Date('2025-01-15T12:00:00Z');

  return actions.map((item, index) => ({
    id: `act-${index + 1}`,
    userId,
    action: item.action,
    timestamp: new Date(baseDate.getTime() - index * 3600000).toISOString(),
    details: item.details,
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await params;
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  // パラメータのバリデーション
  if (isNaN(page) || isNaN(limit)) {
    return NextResponse.json(
      { error: '不正なクエリパラメータです' },
      { status: 400 }
    );
  }

  const allActivities = generateMockActivities(userId);
  const total = allActivities.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const activities = allActivities.slice(start, end);
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

### 4.3 モックデータの設計意図

- 25件のアクティビティを生成し、ページネーションの動作確認が可能なデータ量とする
- 全4種類のアクション種別を含め、`details` フィールドの `null` / オブジェクトの両パターンをカバー
- `timestamp` は1時間間隔で降順に生成（新しい順）
- `limit` の上限を100に制限し、過大なリクエストを防止

## 5. APIクライアント

### 5.1 新規ファイル: `src/api/activityClient.ts`

既存の `notificationClient.ts` のパターンに準拠し、アクティビティ取得用のAPIクライアントを独立ファイルとして作成する。

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

### 5.2 APIクライアントの設計意図

| 項目 | 説明 |
|------|------|
| 独立ファイル | `notificationClient.ts` と同様、機能ドメインごとにファイルを分離して保守性を確保 |
| デフォルト引数 | `page = 1`, `limit = 20` でデフォルト値を設定し、呼び出し側の記述を簡潔に |
| 戻り値型 | `PaginatedActivities` 型でレスポンス構造を型安全に提供 |
| エラーハンドリング | 既存パターンと同様に `res.ok` チェック + `throw new Error` で統一 |

## 6. ファイル変更一覧

### 6.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/activity.ts` | 型定義 | `ActivityAction`, `ActivityLog`, `PaginatedActivities`, `ACTION_LABELS`, `ACTION_ICONS` |
| `src/api/activityClient.ts` | APIクライアント | `getUserActivities` 関数 |
| `app/api/users/[id]/activities/route.ts` | Route Handler | GET（モックデータ、ページネーション対応） |

### 6.2 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | アクティビティは独立した型ファイルに定義するため変更不要 |
| `src/types/notification.ts` | スコープ外 |
| `src/api/client.ts` | アクティビティ用クライアントは独立ファイルに作成するため変更不要 |
| `src/api/notificationClient.ts` | スコープ外 |
| `app/api/notifications/settings/route.ts` | スコープ外 |

## 7. 実装上の注意事項

### 7.1 既存パターンへの準拠

- 型定義ファイルは `src/types/notification.ts` のパターン（union型 + interface + 定数マップ）に合わせる
- APIクライアントは `src/api/notificationClient.ts` のパターン（`API_BASE` 定数 + `fetch` + エラーハンドリング）に合わせる
- Route Handler は `app/api/notifications/settings/route.ts` のパターン（モックデータ + `NextResponse.json`）に合わせる

### 7.2 モックデータの取り扱い

- Route Handler ではリクエストごとにモックデータを生成する（インメモリ保持不要、読み取り専用）
- 実際のDB連携は後続Issueで対応
- モックデータを使用していることをコード内コメントで明記する

### 7.3 `timestamp` フィールドの型

- `ActivityLog.timestamp` は `string` 型（ISO 8601形式）とする
- `Date` 型ではなく `string` 型を採用する理由: APIレスポンス（JSON）では `Date` はシリアライズされて文字列になるため、型定義をレスポンスの実態に合わせる
- UIで表示する際のフォーマットは後続Issueで対応

### 7.4 Next.js App Router の params の型

- Next.js 15以降では Route Handler の `params` は `Promise` 型となるため、`await params` でアクセスする
- `{ params }: { params: Promise<{ id: string }> }` の型注釈を使用

### 7.5 パッケージ追加

なし。既存の依存関係のみで実装可能。

## 8. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/activity.ts` | 型定義 | 新規 | なし |
| 2 | `src/api/activityClient.ts` | APIクライアント | 新規 | 順序1 |
| 3 | `app/api/users/[id]/activities/route.ts` | Route Handler | 新規 | 順序1 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能（どちらも順序1のみに依存）

## 9. 依存関係図

```
src/types/activity.ts（新規: 型定義）
  ├─→ src/api/activityClient.ts（新規: APIクライアント）
  │
  └─→ app/api/users/[id]/activities/route.ts（新規: Route Handler）
```

## 10. 完了条件チェックリスト

- [ ] `ActivityAction` union型が `src/types/activity.ts` に定義されていること
- [ ] `ActivityLog` インターフェースが `src/types/activity.ts` に定義されていること
- [ ] `PaginatedActivities` インターフェースが `src/types/activity.ts` に定義されていること
- [ ] `ACTION_LABELS` 定数が全アクション種別をカバーしていること
- [ ] `ACTION_ICONS` 定数が全アクション種別をカバーしていること
- [ ] APIクライアント `getUserActivities(userId, page, limit)` が `src/api/activityClient.ts` に実装されていること
- [ ] Route Handler が `app/api/users/[id]/activities/route.ts` に実装され、GET リクエストに対しモックデータを返すこと
- [ ] ページネーション（`page`, `limit` パラメータ、`hasNext` フラグ）が正しく動作すること
- [ ] `npm run build` が通ること
