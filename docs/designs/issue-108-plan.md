# 実装計画: Issue #108 通知設定の履歴表示機能

## 1. 概要

設計書 `docs/designs/issue-108.md` に基づき、通知設定ページに変更履歴セクションを追加する。
フロントエンドのみの実装（バックエンドはモック）。

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義の追加（依存なし）

#### 1-1. `src/types/notification.ts`（変更）

既存の型定義ファイルの末尾に以下を追加:

```typescript
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

**変更箇所**: ファイル末尾への追記のみ。既存の `NotificationFrequency`, `NotificationSettings`, `FREQUENCY_LABELS`, `DEFAULT_NOTIFICATION_SETTINGS` は一切変更しない。

---

### Phase 2: APIクライアント・APIルート（Phase 1 に依存、互いに独立 → 並列実装可能）

#### 2-1. `src/api/notificationClient.ts`（変更）

既存の `updateNotificationSettings` 関数の後に以下を追加:

```typescript
import { NotificationSettings, NotificationHistoryEntry } from '../types/notification';
// ↑ 既存の import に NotificationHistoryEntry を追加

/**
 * 通知設定の変更履歴を取得する
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/notifications/history`);
  if (!res.ok) throw new Error(`Failed to fetch notification history: ${res.status}`);
  return res.json();
}
```

**変更箇所**:
- import文に `NotificationHistoryEntry` を追加
- `getNotificationHistory` 関数を末尾に追加
- 既存の `getNotificationSettings`, `updateNotificationSettings` は変更なし

#### 2-2. `app/api/notifications/history/route.ts`（新規作成）

既存の `app/api/notifications/settings/route.ts` と同じパターンでモック API を作成:

```typescript
import { NextResponse } from 'next/server';
import { NotificationHistoryEntry } from '../../../../src/types/notification';

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
    changedAt: '2026-03-28T09:00:00Z',
    field: 'pushEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
  {
    id: '4',
    changedAt: '2026-03-25T14:20:00Z',
    field: 'frequency',
    oldValue: 'weekly',
    newValue: 'immediate',
  },
  {
    id: '5',
    changedAt: '2026-03-20T11:00:00Z',
    field: 'emailEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
];

export async function GET() {
  return NextResponse.json(mockHistory);
}
```

**ポイント**: 既存の `settings/route.ts` と同じパターン（NextResponse.json でモックデータ返却）。5件のサンプルデータを用意。

---

### Phase 3: Hook・コンポーネント（Phase 2 に依存、互いに独立 → 並列実装可能）

#### 3-1. `src/hooks/useNotificationHistory.ts`（新規作成）

既存の `useNotificationSettings.ts` と同じパターンで実装:

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

**パターン**: `useNotificationSettings` の取得部分と完全に同じパターン（useState + useEffect + API呼び出し）。saveは不要（読み取り専用）。

#### 3-2. `src/components/NotificationHistory.tsx`（新規作成）

```typescript
import React from 'react';
import {
  NotificationHistoryEntry,
  NotificationSettingField,
  NotificationFrequency,
  FREQUENCY_LABELS,
  SETTING_FIELD_LABELS,
} from '../types/notification';
import styles from './NotificationHistory.module.css';

interface NotificationHistoryProps {
  history: NotificationHistoryEntry[];
  loading: boolean;
  error: Error | null;
}

/**
 * boolean系フィールドの値を ON/OFF に、frequency を日本語ラベルに変換
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
 * ISO 8601 文字列を YYYY/MM/DD HH:mm 形式に変換
 */
function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export function NotificationHistory({
  history,
  loading,
  error,
}: NotificationHistoryProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>変更履歴</h2>

      {loading && <p>読み込み中...</p>}

      {error && (
        <p className={styles.errorMessage}>履歴の取得に失敗しました</p>
      )}

      {!loading && !error && history.length === 0 && (
        <p className={styles.emptyMessage}>変更履歴はありません</p>
      )}

      {!loading && !error && history.length > 0 && (
        <ul className={styles.historyList}>
          {history.map((entry) => (
            <li key={entry.id} className={styles.historyItem}>
              <div className={styles.changedAt}>
                {formatDateTime(entry.changedAt)}
              </div>
              <div className={styles.changeDetail}>
                {SETTING_FIELD_LABELS[entry.field]}:{' '}
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
    </div>
  );
}
```

#### 3-3. `src/components/NotificationHistory.module.css`（新規作成）

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

---

### Phase 4: ページ統合（Phase 3 に依存）

#### 4-1. `app/settings/notifications/page.tsx`（変更）

現在の実装に `useNotificationHistory` と `NotificationHistory` を統合:

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

**変更箇所**:
- `useNotificationHistory` の import を追加
- `NotificationHistory` コンポーネントの import を追加
- Hook の呼び出しを追加
- JSX の return を `<>...</>` で囲み `<NotificationHistory>` を追加
- **重要**: 履歴取得エラーは設定フォームの表示をブロックしない（独立した状態管理）

---

### Phase 5: テスト（Phase 4 に依存）

#### 5-1. `src/hooks/__tests__/useNotificationHistory.test.ts`（新規作成）

既存の `useNotificationSettings.test.ts` と同じパターンで作成:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useNotificationHistory } from '../useNotificationHistory';
import { getNotificationHistory } from '../../api/notificationClient';
import { NotificationHistoryEntry } from '../../types/notification';

jest.mock('../../api/notificationClient');

const mockGetNotificationHistory = getNotificationHistory as jest.MockedFunction<typeof getNotificationHistory>;

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
];

describe('useNotificationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('履歴データを正常に取得できる', async () => {
    mockGetNotificationHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual(mockHistory);
    expect(result.current.error).toBeNull();
    expect(mockGetNotificationHistory).toHaveBeenCalledTimes(1);
  });

  it('ローディング状態が正しく管理される', async () => {
    mockGetNotificationHistory.mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useNotificationHistory());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('APIエラー時にエラー状態が設定される', async () => {
    const error = new Error('Failed to fetch notification history: 500');
    mockGetNotificationHistory.mockRejectedValue(error);

    const { result } = renderHook(() => useNotificationHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.history).toEqual([]);
  });

  it('取得データが空配列の場合も正しく処理される', async () => {
    mockGetNotificationHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useNotificationHistory());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
```

**テストケース**:
| # | テストケース | 検証内容 |
|---|-------------|---------|
| 1 | 履歴データを正常に取得できる | `history` に取得データが設定される、`error` が null |
| 2 | ローディング状態が正しく管理される | 初期 `loading=true` → 取得後 `loading=false` |
| 3 | APIエラー時にエラー状態が設定される | `error` にエラーオブジェクトが設定される |
| 4 | 取得データが空配列の場合も正しく処理される | `history` が空配列、`error` が null |

#### 5-2. `src/components/__tests__/NotificationHistory.test.tsx`（新規作成）

既存の `NotificationSettingsForm.test.tsx` と同じパターンで作成:

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationHistory } from '../NotificationHistory';
import { NotificationHistoryEntry } from '../../types/notification';

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
    changedAt: '2026-03-28T09:00:00Z',
    field: 'pushEnabled',
    oldValue: 'false',
    newValue: 'true',
  },
];

describe('NotificationHistory', () => {
  it('履歴データが正しく表示される（変更日時・フィールド名・変更前後の値）', () => {
    render(<NotificationHistory history={mockHistory} loading={false} error={null} />);

    expect(screen.getByText('変更履歴')).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });

  it('boolean値（emailEnabled）がON/OFFで表示される', () => {
    const history: NotificationHistoryEntry[] = [
      {
        id: '1',
        changedAt: '2026-04-02T10:30:00Z',
        field: 'emailEnabled',
        oldValue: 'true',
        newValue: 'false',
      },
    ];
    render(<NotificationHistory history={history} loading={false} error={null} />);

    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('boolean値（pushEnabled）がON/OFFで表示される', () => {
    const history: NotificationHistoryEntry[] = [
      {
        id: '1',
        changedAt: '2026-03-28T09:00:00Z',
        field: 'pushEnabled',
        oldValue: 'false',
        newValue: 'true',
      },
    ];
    render(<NotificationHistory history={history} loading={false} error={null} />);

    expect(screen.getByText('OFF')).toBeInTheDocument();
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('frequency値が日本語ラベルで表示される', () => {
    const history: NotificationHistoryEntry[] = [
      {
        id: '1',
        changedAt: '2026-04-01T15:00:00Z',
        field: 'frequency',
        oldValue: 'immediate',
        newValue: 'daily',
      },
    ];
    render(<NotificationHistory history={history} loading={false} error={null} />);

    expect(screen.getByText('即時')).toBeInTheDocument();
    expect(screen.getByText('日次ダイジェスト')).toBeInTheDocument();
  });

  it('ローディング中に「読み込み中...」が表示される', () => {
    render(<NotificationHistory history={[]} loading={true} error={null} />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('エラー時に「履歴の取得に失敗しました」が表示される', () => {
    const error = new Error('API Error');
    render(<NotificationHistory history={[]} loading={false} error={error} />);

    expect(screen.getByText('履歴の取得に失敗しました')).toBeInTheDocument();
  });

  it('履歴が空の場合に「変更履歴はありません」が表示される', () => {
    render(<NotificationHistory history={[]} loading={false} error={null} />);

    expect(screen.getByText('変更履歴はありません')).toBeInTheDocument();
  });

  it('複数件の履歴が時系列順に表示される', () => {
    render(<NotificationHistory history={mockHistory} loading={false} error={null} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
  });
});
```

**テストケース**:
| # | テストケース | 検証内容 |
|---|-------------|---------|
| 1 | 履歴データが正しく表示される | 変更日時・フィールド名・変更前後の値が表示される |
| 2 | boolean値（emailEnabled）がON/OFFで表示される | `true` → `ON`, `false` → `OFF` |
| 3 | boolean値（pushEnabled）がON/OFFで表示される | `false` → `OFF`, `true` → `ON` |
| 4 | frequency値が日本語ラベルで表示される | `immediate` → `即時`, `daily` → `日次ダイジェスト` |
| 5 | ローディング中に「読み込み中...」が表示される | loading=true 時の表示 |
| 6 | エラー時に「履歴の取得に失敗しました」が表示される | error が設定されている時の表示 |
| 7 | 履歴が空の場合に「変更履歴はありません」が表示される | history=[] 時の表示 |
| 8 | 複数件の履歴が時系列順に表示される | リスト内の順序が正しい |

---

## 3. 依存関係図

```
Phase 1: src/types/notification.ts（型追加）
    │
    ├─── Phase 2-1: src/api/notificationClient.ts（API関数追加）
    │         │
    │         └─── Phase 3-1: src/hooks/useNotificationHistory.ts（Hook新規）
    │                   │
    ├─── Phase 2-2: app/api/notifications/history/route.ts（モックAPI新規）
    │                   │
    ├─── Phase 3-2: src/components/NotificationHistory.tsx（コンポーネント新規）
    │    Phase 3-3: src/components/NotificationHistory.module.css（スタイル新規）
    │                   │
    └──────────────── Phase 4: app/settings/notifications/page.tsx（ページ統合）
                        │
                      Phase 5: テスト追加
                        ├── src/hooks/__tests__/useNotificationHistory.test.ts
                        └── src/components/__tests__/NotificationHistory.test.tsx
```

## 4. 並列実装可能なグループ

| グループ | ファイル | 前提条件 |
|---------|--------|---------|
| A | Phase 2-1 + Phase 2-2 | Phase 1 完了後 |
| B | Phase 3-1 + Phase 3-2 + Phase 3-3 | Phase 2 完了後 |
| C | Phase 5-1 + Phase 5-2 | Phase 4 完了後 |

## 5. 変更しないファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/components/NotificationSettingsForm.tsx` | 設定フォーム自体に変更なし |
| `src/components/NotificationSettingsForm.module.css` | スタイル変更なし |
| `src/hooks/useNotificationSettings.ts` | 設定取得・更新ロジックに変更なし |
| `app/api/notifications/settings/route.ts` | 既存の設定APIに変更なし |
| `src/components/__tests__/NotificationSettingsForm.test.tsx` | 既存テストに影響なし |
| `src/hooks/__tests__/useNotificationSettings.test.ts` | 既存テストに影響なし |

## 6. 実装上の注意事項

1. **既存コンポーネントとの分離**: `NotificationSettingsForm` には一切手を加えない。履歴表示は独立した `NotificationHistory` コンポーネントとして実装し、ページレベルで組み合わせる。
2. **日時フォーマット**: 外部ライブラリは使用せず、`Date` オブジェクトのメソッドでカスタムフォーマットする。
3. **エラーハンドリング**: 履歴取得エラーは設定表示をブロックしない。設定フォームと履歴の取得は独立して行う。
4. **パッケージ追加**: 不要。既存の依存関係のみで実装可能。
5. **テストパターン**: 既存の `useNotificationSettings.test.ts` と `NotificationSettingsForm.test.tsx` のパターンに完全準拠（jest.mock, renderHook, render + screen）。

## 7. テスト実行コマンド

```bash
# 全テスト実行
npm test

# 新規テストのみ実行
npm test -- --testPathPattern="useNotificationHistory|NotificationHistory"
```
