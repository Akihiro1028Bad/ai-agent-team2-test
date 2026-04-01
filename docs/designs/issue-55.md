# 設計書: Issue #55 ダッシュボード統計表示機能の追加

## 1. 概要

ダッシュボードページにユーザーの活動統計を表示する機能を追加する。

### 1.1 背景

現在のアプリケーションにはプロフィール表示・編集機能が存在するが、ユーザーの活動状況を可視化するダッシュボード画面がない。月間アクティブ日数・累計投稿数・直近30日間の活動グラフを表示することで、ユーザーの活動状況を一目で把握できるようにする。

### 1.2 スコープ

- **対象**: フロントエンド（React/TypeScript） + バックエンドRoute Handler（モックデータ）
- **対象外**: 実際のデータベース連携（モックデータで対応）、認証基盤との統合
- **新規ライブラリ**: `recharts`（最新安定版）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | APIレスポンス形式 | `UserStats` 型（monthlyActiveDays, totalPosts, dailyActivity[]） |
| 2 | 「投稿」の定義 | モックデータで対応（実エンティティは未実装） |
| 3 | 「アクティブ」の定義 | ログインした日 |
| 4 | ダッシュボードの配置 | `app/dashboard/page.tsx` を新規作成 |
| 5 | APIの実装範囲 | Route Handler（`app/api/users/[id]/stats/route.ts`）含む。モックデータを返す |
| 6 | rechartsバージョン | 最新安定版 |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/user.ts` | `User` / `UserProfile` 定義済み | ⚠️ 変更（統計関連型追加） |
| **APIクライアント** | `src/api/client.ts` | `getUser` / `getUserProfile` / `updateUser` / `updateUserProfile` 実装済み | ⚠️ 変更（統計取得関数追加） |
| **Hook** | `src/hooks/useUserProfile.ts` | プロフィール取得・更新済み | ✅ 変更なし |
| **コンポーネント** | `src/components/` | `UserProfileView`, `ProfileEditForm`, `UserCard` | ✅ 変更なし |
| **ページ** | `app/profile/page.tsx`, `app/users/[id]/page.tsx` | プロフィールページ実装済み | ✅ 変更なし |
| **Route Handler** | なし | 統計API未実装 | ⚠️ 新規作成 |

### 2.2 既存の型定義

```typescript
// src/types/user.ts（現在）
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}
```

### 2.3 既存のAPIクライアント

```typescript
// src/api/client.ts（現在）
getUser(id: string): Promise<User>                              // GET
getUserProfile(id: string): Promise<UserProfile>                // GET
updateUser(id: string, data: Partial<User>): Promise<User>      // PATCH
updateUserProfile(id: string, data: Partial<UserProfile>): Promise<UserProfile>  // PATCH
```

## 3. API設計

### 3.1 エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/users/{id}/stats` | ユーザーの活動統計を取得 |

### 3.2 レスポンス形式

```typescript
interface UserStats {
  monthlyActiveDays: number;    // 月間アクティブ日数（当月のログイン日数）
  totalPosts: number;           // 累計投稿数
  dailyActivity: {              // 直近30日間の日別データ
    date: string;               // "2026-03-15" 形式（ISO 8601 日付）
    count: number;              // その日の活動数
  }[];
}
```

### 3.3 レスポンス例

```json
{
  "monthlyActiveDays": 18,
  "totalPosts": 142,
  "dailyActivity": [
    { "date": "2026-03-03", "count": 3 },
    { "date": "2026-03-04", "count": 0 },
    { "date": "2026-03-05", "count": 5 },
    ...
  ]
}
```

### 3.4 エラーレスポンス

| ステータス | 条件 | レスポンスボディ |
|-----------|------|-----------------|
| 400 | `id` が不正な形式 | `{ "error": "Invalid user ID" }` |
| 404 | ユーザーが存在しない | `{ "error": "User not found" }` |
| 500 | サーバーエラー | `{ "error": "Internal server error" }` |

### 3.5 Route Handler 実装（モックデータ）

```
app/api/users/[id]/stats/route.ts ← 新規
```

- `NextResponse` を使用してモックデータを返す
- 直近30日分の `dailyActivity` をランダムに生成（seed値固定で再現性を確保）
- `monthlyActiveDays` は当月分の `dailyActivity` のうち `count > 0` の日数をカウント
- `totalPosts` は固定値（モック）

### 3.6 APIクライアント追加

```typescript
// src/api/client.ts に追加
export async function getUserStats(id: string): Promise<UserStats> {
  const res = await fetch(`${API_BASE}/users/${id}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch user stats: ${res.status}`);
  return res.json();
}
```

### 3.7 API呼び出しフロー

```
[ダッシュボード表示]
  app/dashboard/page.tsx → useUserStats(userId) → getUserStats(id) → GET /api/users/:id/stats
```

## 4. 型定義の変更

### 4.1 `src/types/user.ts` への追加

```typescript
// 既存の User / UserProfile は変更なし

// 新規追加
export interface DailyActivity {
  date: string;    // "2026-03-15" 形式
  count: number;   // その日の活動数
}

export interface UserStats {
  monthlyActiveDays: number;    // 月間アクティブ日数
  totalPosts: number;           // 累計投稿数
  dailyActivity: DailyActivity[];  // 直近30日間の日別データ
}
```

## 5. コンポーネント設計

### 5.1 コンポーネント構成図

```
app/dashboard/page.tsx                    ← ダッシュボードページ（新規）

src/components/
  StatCard.tsx                            ← 統計カードコンポーネント（新規）
  StatCard.module.css                     ← スタイル（新規）
  ActivityChart.tsx                       ← 活動グラフコンポーネント（新規）
  ActivityChart.module.css                ← スタイル（新規）
```

### 5.2 各コンポーネントの責務

#### `StatCard` コンポーネント（新規）

**責務**: 単一の統計値をカード形式で表示する汎用コンポーネント

**ファイル**:
```
src/components/StatCard.tsx
src/components/StatCard.module.css
```

**Props**:
```typescript
interface StatCardProps {
  title: string;     // カードのタイトル（例: "月間アクティブ日数"）
  value: number;     // 統計値（例: 18）
  unit: string;      // 単位（例: "日", "件"）
}
```

**UI構成**:
```
┌─────────────────────┐
│  月間アクティブ日数   │  ← title
│                     │
│       18 日         │  ← value + unit
└─────────────────────┘
```

**スタイル仕様**:
- カード形式（`border-radius: 8px`, `box-shadow`）
- パディング: `24px`
- タイトル: フォントサイズ `14px`, グレー系
- 値: フォントサイズ `36px`, 太字
- 単位: フォントサイズ `16px`, 値の右に表示
- レスポンシブ: モバイルでは横幅100%、デスクトップではグリッド配置

#### `ActivityChart` コンポーネント（新規）

**責務**: 直近30日間の活動データを棒グラフで表示する

**ファイル**:
```
src/components/ActivityChart.tsx
src/components/ActivityChart.module.css
```

**Props**:
```typescript
interface ActivityChartProps {
  data: DailyActivity[];   // 直近30日間の日別データ
}
```

**UI構成**:
```
┌───────────────────────────────────────┐
│  直近30日間の活動                       │
│                                       │
│  ▐          ▐                         │
│  ▐    ▐     ▐  ▐                      │
│  ▐  ▐ ▐  ▐  ▐  ▐  ▐    ▐             │
│  ▐  ▐ ▐  ▐  ▐  ▐  ▐  ▐ ▐  ...       │
│  ──────────────────────────────       │
│  3/3 3/4 3/5 ...              4/1     │
└───────────────────────────────────────┘
```

**recharts 使用コンポーネント**:
- `ResponsiveContainer`: レスポンシブ対応のコンテナ
- `BarChart`: 棒グラフ本体
- `Bar`: 棒（色: `#4F46E5` インディゴ系）
- `XAxis`: 横軸（日付、`M/d` 形式で表示）
- `YAxis`: 縦軸（活動数）
- `Tooltip`: ホバー時のツールチップ（日付と活動数を表示）
- `CartesianGrid`: グリッド線（`strokeDasharray="3 3"`）

**レスポンシブ仕様**:
- `ResponsiveContainer` で `width="100%"` `height={300}` を指定
- モバイル（768px以下）: `height={200}`、X軸ラベルを間引き表示

#### `app/dashboard/page.tsx`（新規）

**責務**: ダッシュボードページ。統計データを取得し、StatCard・ActivityChartを配置する

**構成**:
```typescript
'use client';

import React from 'react';
import { useUserStats } from '../../src/hooks/useUserStats';
import { StatCard } from '../../src/components/StatCard';
import { ActivityChart } from '../../src/components/ActivityChart';

// TODO: 認証基盤導入後に差し替え
function getCurrentUserId(): string {
  return 'current-user-id';
}

export default function DashboardPage() {
  const userId = getCurrentUserId();
  const { stats, loading, error } = useUserStats(userId);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!stats) return <div>統計データが見つかりません</div>;

  return (
    <div>
      <h1>ダッシュボード</h1>
      <div className={styles.statsGrid}>
        <StatCard
          title="月間アクティブ日数"
          value={stats.monthlyActiveDays}
          unit="日"
        />
        <StatCard
          title="累計投稿数"
          value={stats.totalPosts}
          unit="件"
        />
      </div>
      <ActivityChart data={stats.dailyActivity} />
    </div>
  );
}
```

**レイアウト**:
```
┌─────────────────────────────────────────────────┐
│  ダッシュボード                                    │ ← h1
│                                                 │
│  ┌───────────────────┐  ┌───────────────────┐   │
│  │ 月間アクティブ日数  │  │ 累計投稿数         │   │ ← StatCard × 2
│  │      18 日        │  │    142 件         │   │
│  └───────────────────┘  └───────────────────┘   │
│                                                 │
│  ┌───────────────────────────────────────────┐   │
│  │  直近30日間の活動                          │   │ ← ActivityChart
│  │  [====棒グラフ====]                        │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**レスポンシブ仕様**:
- デスクトップ（769px以上）: StatCardを横2列のグリッド配置（`grid-template-columns: repeat(2, 1fr)`）
- モバイル（768px以下）: StatCardを縦1列配置（`grid-template-columns: 1fr`）

## 6. カスタムHook設計

### 6.1 `useUserStats`（新規）

```typescript
// src/hooks/useUserStats.ts
import { useState, useEffect } from 'react';
import { UserStats } from '../types/user';
import { getUserStats } from '../api/client';

export function useUserStats(id: string) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getUserStats(id)
      .then(setStats)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { stats, loading, error };
}
```

- 既存の `useUserProfile` hookと同じパターンを踏襲し、一貫性を保つ

## 7. 状態管理

### 7.1 画面の状態遷移

```
[/dashboard ページ]
  Loading → 表示（統計データ表示）
         → エラー（API呼び出し失敗）
         → データなし（統計データが空）
```

### 7.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `stats` | `useUserStats()` | ユーザー統計データ |
| `loading` | `useUserStats()` | データ取得中フラグ |
| `error` | `useUserStats()` | API呼び出しエラー |

## 8. ファイル変更一覧

### 8.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/user.ts` | 型定義 | `DailyActivity`, `UserStats` 型の追加（既存ファイル変更） |
| `src/api/client.ts` | API | `getUserStats` 関数の追加（既存ファイル変更） |
| `src/hooks/useUserStats.ts` | Hook | 統計データ取得Hook |
| `src/components/StatCard.tsx` | コンポーネント | 統計カード表示 |
| `src/components/StatCard.module.css` | スタイル | 統計カードのスタイル |
| `src/components/ActivityChart.tsx` | コンポーネント | 活動グラフ表示 |
| `src/components/ActivityChart.module.css` | スタイル | 活動グラフのスタイル |
| `app/dashboard/page.tsx` | ページ | ダッシュボードページ |
| `app/api/users/[id]/stats/route.ts` | Route Handler | 統計API（モックデータ） |
| `src/components/__tests__/StatCard.test.tsx` | テスト | StatCardのユニットテスト |
| `src/components/__tests__/ActivityChart.test.tsx` | テスト | ActivityChartのユニットテスト |
| `src/hooks/__tests__/useUserStats.test.ts` | テスト | useUserStatsのユニットテスト |
| `app/dashboard/__tests__/page.test.tsx` | テスト | ダッシュボードページのテスト |

### 8.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/user.ts` | `DailyActivity`, `UserStats` 型の追加 |
| `src/api/client.ts` | `getUserStats` 関数の追加 |
| `package.json` | `recharts` の依存関係追加 |

### 8.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/components/UserProfileView.tsx` | ダッシュボード機能とは独立 |
| `src/components/ProfileEditForm.tsx` | ダッシュボード機能とは独立 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/hooks/useUserProfile.ts` | 変更不要 |
| `src/hooks/useUser.ts` | 変更不要 |
| `app/profile/page.tsx` | 変更不要 |
| `app/users/[id]/page.tsx` | 変更不要 |
| `app/layout.tsx` | 変更不要 |

## 9. 実装上の注意事項

### 9.1 recharts の導入

- `recharts` パッケージ（最新安定版）を `package.json` の `dependencies` に追加
- `recharts` は React 18 をサポートしていることを確認
- `'use client'` ディレクティブが必要（rechartsはクライアントサイドでのみ動作）

```json
{
  "dependencies": {
    "recharts": "^2.15.0"
  }
}
```

### 9.2 モックデータの設計

Route Handler で返すモックデータは以下のルールで生成する:

- `dailyActivity`: 直近30日分を生成。各日の `count` は 0〜10 のランダム値（seed固定で再現性確保）
- `monthlyActiveDays`: 当月の `dailyActivity` のうち `count > 0` の日数を動的に計算
- `totalPosts`: 固定値（例: 142）
- ユーザーIDが `"not-found"` の場合は 404 を返す（テスト用）

### 9.3 認証について

- 既存の `app/profile/page.tsx` と同様に、`getCurrentUserId()` をプレースホルダーとして実装
- 将来的に認証基盤が導入された際に差し替え可能な構造にしておく

### 9.4 エラーハンドリング

- API呼び出し失敗時: エラーメッセージを画面に表示
- 統計データが空の場合: 「統計データがありません」と表示
- グラフデータが空の場合: 「活動データがありません」とグラフエリアに表示

### 9.5 アクセシビリティ

- StatCardに `role="region"` と `aria-label` を付与
- ActivityChartに代替テキストとして統計サマリーを `aria-label` で提供
- グラフの色はWCAG AAレベルのコントラスト比を確保

### 9.6 パフォーマンス

- `recharts` はバンドルサイズが大きいため、`ActivityChart` コンポーネントを `React.lazy` + `Suspense` で遅延読み込みすることを検討（本Issueではオプション）
- 統計データのキャッシュは今後の課題（本Issueではリクエスト毎に取得）

## 10. テスト方針

### 10.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `StatCard` | `src/components/__tests__/StatCard.test.tsx` | タイトル・値・単位の表示確認 / propsの変更による再描画 |
| `ActivityChart` | `src/components/__tests__/ActivityChart.test.tsx` | グラフの描画確認（rechartsのモック） / データが空の場合の表示 |
| `useUserStats` | `src/hooks/__tests__/useUserStats.test.ts` | 統計データ取得の正常系 / エラーハンドリング / ローディング状態 |
| ダッシュボードページ | `app/dashboard/__tests__/page.test.tsx` | StatCard表示確認 / ActivityChart表示確認 / ローディング状態 / エラー状態 |

### 10.2 テスト方法

- `recharts` のコンポーネントはSVGを描画するため、テストではモック化してProps渡しを検証する
- `useUserStats` のテストでは `getUserStats` APIをモック化する
- 既存テスト（`useUserProfile.test.ts`, `ProfileEditForm.test.tsx` 等）への影響がないことを確認する

### 10.3 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-55/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ダッシュボード画面（デスクトップ） | `dashboard-desktop.png` |
| 2 | ダッシュボード画面（モバイル） | `dashboard-mobile.png` |
| 3 | ローディング状態 | `dashboard-loading.png` |
| 4 | エラー状態 | `dashboard-error.png` |
| 5 | StatCard表示 | `statcard-display.png` |
| 6 | ActivityChartホバー時ツールチップ | `activity-chart-tooltip.png` |

## 11. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 2 | `src/api/client.ts` | API | 変更 | 順序1 |
| 3 | `app/api/users/[id]/stats/route.ts` | Route Handler | 新規 | 順序1 |
| 4 | `src/hooks/useUserStats.ts` | Hook | 新規 | 順序1, 2 |
| 5 | `src/components/StatCard.tsx` + CSS | コンポーネント | 新規 | なし |
| 6 | `src/components/ActivityChart.tsx` + CSS | コンポーネント | 新規 | 順序1（型依存） |
| 7 | `app/dashboard/page.tsx` | ページ | 新規 | 順序4, 5, 6 |
| 8 | `package.json` | 設定 | 変更 | なし |
| 9 | テスト追加 | テスト | 新規 | 順序1-7 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5 と 順序6 は互いに独立しているため並列実装可能

## 12. 依存関係図

```
src/types/user.ts（変更: UserStats, DailyActivity 型追加）
  ├─→ src/api/client.ts（変更: getUserStats 追加）
  │     ↓
  │   src/hooks/useUserStats.ts（新規）
  │     ↓
  ├─→ src/components/StatCard.tsx + CSS（新規）
  ├─→ src/components/ActivityChart.tsx + CSS（新規）
  │     ↓
  └─→ app/dashboard/page.tsx（新規: 全コンポーネント統合）

app/api/users/[id]/stats/route.ts（新規: モックAPI）

package.json（変更: recharts 追加）
```
