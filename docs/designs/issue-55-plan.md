# 実装計画: Issue #55 ダッシュボード統計表示機能の追加

## 1. 実装概要

設計書 `docs/designs/issue-55.md` に基づき、ダッシュボードページにユーザーの活動統計（月間アクティブ日数・累計投稿数・直近30日間の活動グラフ）を表示する機能を実装する。

新規ライブラリ `recharts` を導入し、棒グラフによる活動可視化を行う。バックエンドはRoute Handler（モックデータ）で対応する。

## 2. 変更ファイル一覧と実装順序

依存関係に基づき、以下の順序で実装する。下流のファイルが上流のファイルに依存するため、番号順に実装すること。

| 順序 | ファイルパス | 種別 | 新規/変更 | 依存先 |
|------|-------------|------|-----------|--------|
| 1 | `package.json` | 設定 | 変更 | なし |
| 2 | `src/types/user.ts` | 型定義 | 変更 | なし |
| 3a | `src/api/client.ts` | API | 変更 | 順序2 |
| 3b | `app/api/users/[id]/stats/route.ts` | Route Handler | 新規 | 順序2 |
| 4 | `src/hooks/useUserStats.ts` | Hook | 新規 | 順序2, 3a |
| 5a | `src/components/StatCard.tsx` + `StatCard.module.css` | コンポーネント | 新規 | なし |
| 5b | `src/components/ActivityChart.tsx` + `ActivityChart.module.css` | コンポーネント | 新規 | 順序2（型依存） |
| 6 | `app/dashboard/page.tsx` | ページ | 新規 | 順序4, 5a, 5b |
| 7a | `src/hooks/__tests__/useUserStats.test.ts` | テスト | 新規 | 順序4 |
| 7b | `src/components/__tests__/StatCard.test.tsx` | テスト | 新規 | 順序5a |
| 7c | `src/components/__tests__/ActivityChart.test.tsx` | テスト | 新規 | 順序5b |
| 7d | `app/dashboard/__tests__/page.test.tsx` | テスト | 新規 | 順序6 |

### 並列実装可能なグループ

- 順序 3a と 3b は互いに独立しているため並列実装可能
- 順序 5a と 5b は互いに独立しているため並列実装可能
- 順序 7a〜7d はすべて互いに独立しているため並列実装可能

### 変更なしのファイル

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

## 3. 各ファイルの変更内容

### 3.1 `package.json`（変更）— 順序1

**変更内容**: `recharts` パッケージを `dependencies` に追加する。

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "recharts": "^2.15.0"
  }
}
```

**実装後の作業**: `npm install` を実行して `package-lock.json` を更新する。

**確認ポイント**:
- `recharts` は React 18 をサポートしていることを確認
- `devDependencies` ではなく `dependencies` に追加する（ランタイムで必要）

---

### 3.2 `src/types/user.ts`（変更）— 順序2

**変更内容**: 既存の `User` / `UserProfile` 型はそのまま維持し、末尾に `DailyActivity` と `UserStats` 型を追加する。

```typescript
// 既存コード（変更なし）
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

// ↓ ここから新規追加 ↓

export interface DailyActivity {
  date: string;    // "2026-03-15" 形式（ISO 8601 日付）
  count: number;   // その日の活動数
}

export interface UserStats {
  monthlyActiveDays: number;      // 月間アクティブ日数（当月のログイン日数）
  totalPosts: number;             // 累計投稿数
  dailyActivity: DailyActivity[]; // 直近30日間の日別データ
}
```

**確認ポイント**:
- 既存の `User` / `UserProfile` 型のエクスポートに影響がないこと
- 既存テスト（`useUserProfile.test.ts` 等）が引き続きパスすること

---

### 3.3a `src/api/client.ts`（変更）— 順序3a

**変更内容**: import文に `UserStats` を追加し、末尾に `getUserStats` 関数を追加する。

```typescript
// import文の変更
import { User, UserProfile, UserStats } from '../types/user';

// 既存関数はすべてそのまま維持

// ↓ 末尾に追加 ↓
export async function getUserStats(id: string): Promise<UserStats> {
  const res = await fetch(`${API_BASE}/users/${id}/stats`);
  if (!res.ok) throw new Error(`Failed to fetch user stats: ${res.status}`);
  return res.json();
}
```

**確認ポイント**:
- 既存の `getUser`, `getUserProfile`, `updateUser`, `updateUserProfile` に影響がないこと
- エラーハンドリングのパターンは既存関数と統一（`throw new Error` + ステータスコード）

---

### 3.3b `app/api/users/[id]/stats/route.ts`（新規）— 順序3b

**目的**: モックデータを返すRoute Handler。直近30日分の活動データをseed固定で生成する。

```typescript
import { NextResponse } from 'next/server';

// seed固定の疑似乱数生成器（再現性確保）
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // バリデーション: IDが空の場合
  if (!id || id.trim() === '') {
    return NextResponse.json(
      { error: 'Invalid user ID' },
      { status: 400 }
    );
  }

  // テスト用: "not-found" の場合は404
  if (id === 'not-found') {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // 直近30日分のdailyActivityを生成
  const random = seededRandom(42);
  const dailyActivity: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const count = Math.floor(random() * 11); // 0〜10
    dailyActivity.push({ date: dateStr, count });
  }

  // 当月のアクティブ日数を計算
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthlyActiveDays = dailyActivity.filter((d) => {
    const date = new Date(d.date);
    return (
      date.getMonth() === currentMonth &&
      date.getFullYear() === currentYear &&
      d.count > 0
    );
  }).length;

  return NextResponse.json({
    monthlyActiveDays,
    totalPosts: 142,
    dailyActivity,
  });
}
```

**確認ポイント**:
- seed固定（`42`）により、同一リクエストで同一レスポンスが返ること
- `id === 'not-found'` で404を返す（テスト用）
- `dailyActivity` は日付の昇順（古い日 → 新しい日）で返す
- `monthlyActiveDays` は当月分のみカウント

---

### 3.4 `src/hooks/useUserStats.ts`（新規）— 順序4

**目的**: 統計データの取得を管理するカスタムHook。既存の `useUserProfile` と同じパターンを踏襲する。

```typescript
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

**確認ポイント**:
- `useUserProfile` と同じ `useState` + `useEffect` パターンを使用
- `id` が変更された場合に再取得する（`useEffect` の依存配列に `id` を指定）
- `useUserProfile` と異なり `updateProfile` のような更新関数は不要（統計データは読み取り専用）

---

### 3.5a `src/components/StatCard.module.css`（新規）— 順序5a

**目的**: 統計カードのスタイル。

```css
.card {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 24px;
}

.title {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 8px 0;
}

.valueContainer {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.value {
  font-size: 36px;
  font-weight: bold;
  margin: 0;
  color: #111827;
}

.unit {
  font-size: 16px;
  color: #6b7280;
}
```

### 3.5a（続き） `src/components/StatCard.tsx`（新規）— 順序5a

**目的**: 単一の統計値をカード形式で表示する汎用コンポーネント。

```typescript
import React from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  title: string;   // カードのタイトル（例: "月間アクティブ日数"）
  value: number;   // 統計値（例: 18）
  unit: string;    // 単位（例: "日", "件"）
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, unit }) => {
  return (
    <div className={styles.card} role="region" aria-label={`${title}: ${value}${unit}`}>
      <p className={styles.title}>{title}</p>
      <div className={styles.valueContainer}>
        <span className={styles.value}>{value}</span>
        <span className={styles.unit}>{unit}</span>
      </div>
    </div>
  );
};
```

**確認ポイント**:
- `role="region"` と `aria-label` でアクセシビリティ対応
- propsのみに依存するpresentationalコンポーネント（状態を持たない）

---

### 3.5b `src/components/ActivityChart.module.css`（新規）— 順序5b

**目的**: 活動グラフのスタイル。

```css
.container {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.06);
  padding: 24px;
}

.title {
  font-size: 16px;
  font-weight: bold;
  color: #111827;
  margin: 0 0 16px 0;
}

.emptyMessage {
  text-align: center;
  color: #6b7280;
  padding: 40px 0;
}

@media (max-width: 768px) {
  .container {
    padding: 16px;
  }
}
```

### 3.5b（続き） `src/components/ActivityChart.tsx`（新規）— 順序5b

**目的**: 直近30日間の活動データを棒グラフで表示するコンポーネント。

```typescript
'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DailyActivity } from '../types/user';
import styles from './ActivityChart.module.css';

interface ActivityChartProps {
  data: DailyActivity[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>直近30日間の活動</h2>
        <p className={styles.emptyMessage}>活動データがありません</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  const totalActivity = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div
      className={styles.container}
      role="img"
      aria-label={`直近30日間の活動グラフ。合計活動数: ${totalActivity}`}
    >
      <h2 className={styles.title}>直近30日間の活動</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#4F46E5" name="活動数" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
```

**確認ポイント**:
- `'use client'` ディレクティブが必要（rechartsはクライアントサイドのみ動作）
- データが空の場合は「活動データがありません」と表示
- `aria-label` で合計活動数をスクリーンリーダーに提供
- recharts の `ResponsiveContainer` でレスポンシブ対応
- X軸は `M/d` 形式（例: `3/15`）で日付を表示
- 棒の色は `#4F46E5`（インディゴ系）

---

### 3.6 `app/dashboard/page.tsx`（新規）— 順序6

**目的**: ダッシュボードページ。統計データを取得し、StatCard・ActivityChartを統合表示する。

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

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  } as React.CSSProperties,
  heading: {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '24px',
  } as React.CSSProperties,
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '24px',
  } as React.CSSProperties,
};

// レスポンシブ対応: CSS Module を使わずインラインで記述
// モバイル対応は ActivityChart 内部の ResponsiveContainer が担当

export default function DashboardPage() {
  const userId = getCurrentUserId();
  const { stats, loading, error } = useUserStats(userId);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!stats) return <div>統計データが見つかりません</div>;

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>ダッシュボード</h1>
      <div style={styles.statsGrid}>
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

**確認ポイント**:
- `'use client'` ディレクティブ（`useUserStats` Hook使用のため）
- `getCurrentUserId()` は `app/profile/page.tsx` と同じプレースホルダーパターン
- StatCard 2枚をグリッド（2列）で配置し、その下にActivityChart
- loading / error / データなしの3つの状態ハンドリング

---

## 4. 依存関係図

```
package.json（変更: recharts 追加）                          ── 順序 1

src/types/user.ts（変更: DailyActivity, UserStats 型追加）   ── 順序 2
  ├─→ src/api/client.ts（変更: getUserStats 追加）           ── 順序 3a
  │     ↓
  │   src/hooks/useUserStats.ts（新規）                      ── 順序 4
  │     ↓
  ├─→ src/components/StatCard.tsx + CSS（新規）              ── 順序 5a
  ├─→ src/components/ActivityChart.tsx + CSS（新規）          ── 順序 5b
  │     ↓
  └─→ app/dashboard/page.tsx（新規: 全コンポーネント統合）     ── 順序 6

app/api/users/[id]/stats/route.ts（新規: モックAPI）         ── 順序 3b（3aと並列可）

テスト（順序 7a〜7d）                                         ── 順序 7（すべて並列可）
```

## 5. テスト方針

### 5.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useUserStats` | `src/hooks/__tests__/useUserStats.test.ts` | 統計データ取得の正常系（データが返る）/ 異常系（エラー状態）/ ローディング状態 / ID変更時の再取得 |
| `StatCard` | `src/components/__tests__/StatCard.test.tsx` | タイトル・値・単位の表示確認 / aria-label の内容確認 |
| `ActivityChart` | `src/components/__tests__/ActivityChart.test.tsx` | rechartsコンポーネントのモック化してProps渡しを検証 / データが空の場合に「活動データがありません」表示 / データありの場合にグラフタイトル表示 |
| ダッシュボードページ | `app/dashboard/__tests__/page.test.tsx` | ローディング中に「読み込み中...」表示 / 正常時にStatCard×2とActivityChart表示 / APIエラー時にエラーメッセージ表示 / データなし時のメッセージ表示 |

### 5.2 テストの実装方針

#### `useUserStats` テスト

既存の `useUserProfile.test.ts` と同じパターンで実装する。

```typescript
// src/hooks/__tests__/useUserStats.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useUserStats } from '../useUserStats';
import { getUserStats } from '../../api/client';
import { UserStats } from '../../types/user';

jest.mock('../../api/client');

const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;

const mockStats: UserStats = {
  monthlyActiveDays: 18,
  totalPosts: 142,
  dailyActivity: [
    { date: '2026-03-30', count: 3 },
    { date: '2026-03-31', count: 5 },
    { date: '2026-04-01', count: 2 },
  ],
};

describe('useUserStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('統計データを正常に取得できる', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    const { result } = renderHook(() => useUserStats('user-1'));

    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBeNull();
    expect(mockGetUserStats).toHaveBeenCalledWith('user-1');
  });

  it('APIエラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch user stats: 500');
    mockGetUserStats.mockRejectedValue(error);
    const { result } = renderHook(() => useUserStats('user-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.stats).toBeNull();
  });

  it('IDが変更された場合に再取得する', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useUserStats(id),
      { initialProps: { id: 'user-1' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const anotherStats = { ...mockStats, totalPosts: 200 };
    mockGetUserStats.mockResolvedValue(anotherStats);
    rerender({ id: 'user-2' });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetUserStats).toHaveBeenCalledWith('user-2');
    expect(result.current.stats).toEqual(anotherStats);
  });
});
```

#### `StatCard` テスト

```typescript
// src/components/__tests__/StatCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('タイトル・値・単位が正しく表示される', () => {
    render(<StatCard title="月間アクティブ日数" value={18} unit="日" />);

    expect(screen.getByText('月間アクティブ日数')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('日')).toBeInTheDocument();
  });

  it('aria-labelが正しく設定される', () => {
    render(<StatCard title="累計投稿数" value={142} unit="件" />);

    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      '累計投稿数: 142件'
    );
  });
});
```

#### `ActivityChart` テスト

rechartsはSVGを描画するため、テストではモック化してProps渡しを検証する。

```typescript
// src/components/__tests__/ActivityChart.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ActivityChart } from '../ActivityChart';

// rechartsのモック
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}));

describe('ActivityChart', () => {
  it('データが空の場合に「活動データがありません」と表示される', () => {
    render(<ActivityChart data={[]} />);
    expect(screen.getByText('活動データがありません')).toBeInTheDocument();
  });

  it('データがある場合にグラフタイトルとチャートが表示される', () => {
    const data = [
      { date: '2026-03-30', count: 3 },
      { date: '2026-03-31', count: 5 },
    ];
    render(<ActivityChart data={data} />);

    expect(screen.getByText('直近30日間の活動')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('aria-labelに合計活動数が含まれる', () => {
    const data = [
      { date: '2026-03-30', count: 3 },
      { date: '2026-03-31', count: 5 },
    ];
    render(<ActivityChart data={data} />);

    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      '直近30日間の活動グラフ。合計活動数: 8'
    );
  });
});
```

#### ダッシュボードページテスト

```typescript
// app/dashboard/__tests__/page.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../page';
import { getUserStats } from '../../../src/api/client';

jest.mock('../../../src/api/client');

// rechartsのモック
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
}));

const mockGetUserStats = getUserStats as jest.MockedFunction<typeof getUserStats>;

const mockStats = {
  monthlyActiveDays: 18,
  totalPosts: 142,
  dailyActivity: [
    { date: '2026-03-30', count: 3 },
    { date: '2026-03-31', count: 5 },
  ],
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockGetUserStats.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('統計データが正常に表示される', async () => {
    mockGetUserStats.mockResolvedValue(mockStats);
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('ダッシュボード')).toBeInTheDocument();
    });

    expect(screen.getByText('月間アクティブ日数')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('累計投稿数')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('直近30日間の活動')).toBeInTheDocument();
  });

  it('APIエラー時にエラーメッセージが表示される', async () => {
    mockGetUserStats.mockRejectedValue(new Error('Fetch failed'));
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });
});
```

### 5.3 テスト実行コマンド

```bash
npm test
```

### 5.4 既存テストへの影響

以下の既存テストに影響がないことを確認する:

- `src/hooks/__tests__/useUserProfile.test.ts` — `src/types/user.ts` への型追加のみのため影響なし
- `src/components/__tests__/ProfileEditForm.test.tsx` — 変更なし
- `src/components/__tests__/UserProfileView.test.tsx` — 変更なし
- `app/profile/__tests__/page.test.tsx` — 変更なし
- `app/users/[id]/__tests__/page.test.tsx` — 変更なし

### 5.5 テストエビデンス

テスト完了時に、以下のエビデンス（スクリーンショット）を `docs/evidence/issue-55/` ディレクトリに保存する。

| # | エビデンス | ファイル名 |
|---|-----------|-----------|
| 1 | ダッシュボード画面（デスクトップ） | `dashboard-desktop.png` |
| 2 | ダッシュボード画面（モバイル） | `dashboard-mobile.png` |
| 3 | ローディング状態 | `dashboard-loading.png` |
| 4 | エラー状態 | `dashboard-error.png` |
| 5 | StatCard表示 | `statcard-display.png` |
| 6 | ActivityChartホバー時ツールチップ | `activity-chart-tooltip.png` |

## 6. 実装チェックリスト

- [ ] `package.json` に `recharts` 依存関係を追加 & `npm install`
- [ ] `src/types/user.ts` に `DailyActivity`, `UserStats` 型を追加
- [ ] `src/api/client.ts` に `getUserStats` 関数を追加
- [ ] `app/api/users/[id]/stats/route.ts` を新規作成（モックAPI）
- [ ] `src/hooks/useUserStats.ts` を新規作成
- [ ] `src/components/StatCard.module.css` を新規作成
- [ ] `src/components/StatCard.tsx` を新規作成
- [ ] `src/components/ActivityChart.module.css` を新規作成
- [ ] `src/components/ActivityChart.tsx` を新規作成
- [ ] `app/dashboard/page.tsx` を新規作成
- [ ] `src/hooks/__tests__/useUserStats.test.ts` を新規作成
- [ ] `src/components/__tests__/StatCard.test.tsx` を新規作成
- [ ] `src/components/__tests__/ActivityChart.test.tsx` を新規作成
- [ ] `app/dashboard/__tests__/page.test.tsx` を新規作成
- [ ] 全テスト実行 (`npm test`) で既存テスト含め全パス確認
- [ ] テストエビデンスを `docs/evidence/issue-55/` に保存
