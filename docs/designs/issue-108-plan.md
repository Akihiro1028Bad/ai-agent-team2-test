# 実装計画: Issue #108 通知設定の履歴表示機能

## 1. 概要

設計書 `docs/designs/issue-108.md` に基づき、通知設定ページに変更履歴セクションを追加する。
ユーザーが過去の設定変更（最新5件）を確認できるようにする。フロントエンドのみの実装（バックエンドはモック）。

## 2. 変更ファイル一覧と実装順序

### Phase 1: 型定義の追加（依存なし）

| # | ファイル | 操作 |
|---|---------|------|
| 1-1 | `src/types/notification.ts` | 変更（末尾に追記） |

### Phase 2: API層（Phase 1 に依存、互いに独立 → 並列実装可能）

| # | ファイル | 操作 |
|---|---------|------|
| 2-1 | `src/api/notificationClient.ts` | 変更（関数追加） |
| 2-2 | `app/api/notifications/history/route.ts` | 新規作成 |

### Phase 3: Hook・コンポーネント（Phase 2 に依存、互いに独立 → 並列実装可能）

| # | ファイル | 操作 |
|---|---------|------|
| 3-1 | `src/hooks/useNotificationHistory.ts` | 新規作成 |
| 3-2 | `src/components/NotificationHistory.tsx` | 新規作成 |
| 3-3 | `src/components/NotificationHistory.module.css` | 新規作成 |

### Phase 4: ページ統合（Phase 3 に依存）

| # | ファイル | 操作 |
|---|---------|------|
| 4-1 | `app/settings/notifications/page.tsx` | 変更 |

### Phase 5: テスト（Phase 4 完了後、互いに独立 → 並列実装可能）

| # | ファイル | 操作 |
|---|---------|------|
| 5-1 | `src/hooks/__tests__/useNotificationHistory.test.ts` | 新規作成 |
| 5-2 | `src/components/__tests__/NotificationHistory.test.tsx` | 新規作成 |

---

## 3. 各ファイルの変更内容

### 3.1 `src/types/notification.ts`（変更）

既存の型定義ファイルの末尾に以下を追加。既存の `NotificationFrequency`, `NotificationSettings`, `FREQUENCY_LABELS`, `DEFAULT_NOTIFICATION_SETTINGS` は一切変更しない。

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

---

### 3.2 `src/api/notificationClient.ts`（変更）

**変更箇所**:
- import文に `NotificationHistoryEntry` を追加
- `getNotificationHistory` 関数を末尾に追加
- 既存の `getNotificationSettings`, `updateNotificationSettings` は変更なし

```typescript
import { NotificationSettings, NotificationHistoryEntry } from '../types/notification';
// ↑ 既存の import に NotificationHistoryEntry を追加

// ... 既存コードそのまま ...

/**
 * 通知設定の変更履歴を取得する
 */
export async function getNotificationHistory(): Promise<NotificationHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/notifications/history`);
  if (!res.ok) throw new Error(`Failed to fetch notification history: ${res.status}`);
  return res.json();
}
```

---

### 3.3 `app/api/notifications/history/route.ts`（新規）

既存の `app/api/notifications/settings/route.ts` と同じパターン（NextResponse.json でモックデータ返却）。5件のサンプルデータを時系列降順で用意し、3種類のフィールド（emailEnabled, pushEnabled, frequency）を網羅する。

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

---

### 3.4 `src/hooks/useNotificationHistory.ts`（新規）

既存の `useNotificationSettings.ts` と完全に同じパターン（useState + useEffect + API呼び出し）。読み取り専用のため save 関数は不要。

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

---

### 3.5 `src/components/NotificationHistory.tsx`（新規）

ヘルパー関数 `formatHistoryValue` と `formatDateTime` はテスト可能にするため named export する。

```typescript
'use client';

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
export function formatHistoryValue(field: NotificationSettingField, value: string): string {
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
 * 外部ライブラリ不使用（設計書の指示通り）
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

export const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  history,
  loading,
  error,
}) => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>変更履歴</h2>

      {loading && <div>読み込み中...</div>}

      {error && (
        <div className={styles.errorMessage}>履歴の取得に失敗しました</div>
      )}

      {!loading && !error && history.length === 0 && (
        <div className={styles.emptyMessage}>変更履歴はありません</div>
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
};
```

**表示状態の分岐**:
- `loading === true`: 「読み込み中...」
- `error !== null`: 「履歴の取得に失敗しました」（エラーメッセージスタイル）
- `history.length === 0`: 「変更履歴はありません」
- それ以外: 履歴リスト表示

---

### 3.6 `src/components/NotificationHistory.module.css`（新規）

設計書のスタイル仕様をそのまま適用。既存の `NotificationSettingsForm.module.css` と同様の命名規約。

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

### 3.7 `app/settings/notifications/page.tsx`（変更）

**変更点**:
1. `useNotificationHistory` のインポート追加
2. `NotificationHistory` コンポーネントのインポート追加
3. `useNotificationHistory()` の呼び出し追加
4. JSXを `<>...</>` (Fragment) で囲み、`<NotificationHistory>` を追加

**重要**: 履歴取得エラーは設定フォームの表示をブロックしない（独立した状態管理）

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

---

### 3.8 `src/hooks/__tests__/useNotificationHistory.test.ts`（新規）

既存の `useNotificationSettings.test.ts` と同じパターン（jest.mock + renderHook + waitFor）で作成。

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

---

### 3.9 `src/components/__tests__/NotificationHistory.test.tsx`（新規）

既存の `NotificationSettingsForm.test.tsx` と同じパターン（render + screen）で作成。ヘルパー関数のユニットテストも含める。

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { NotificationHistory, formatHistoryValue, formatDateTime } from '../NotificationHistory';
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

  it('boolean値（emailEnabled/pushEnabled）がON/OFFで表示される', () => {
    render(<NotificationHistory history={mockHistory} loading={false} error={null} />);

    const items = screen.getAllByRole('listitem');
    // emailEnabled: true → false → ON → OFF
    expect(items[0]).toHaveTextContent('ON');
    expect(items[0]).toHaveTextContent('OFF');
    // pushEnabled: false → true → OFF → ON
    expect(items[2]).toHaveTextContent('OFF');
    expect(items[2]).toHaveTextContent('ON');
  });

  it('frequency値が日本語ラベルで表示される', () => {
    render(<NotificationHistory history={mockHistory} loading={false} error={null} />);

    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('即時');
    expect(items[1]).toHaveTextContent('日次ダイジェスト');
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
    // 1件目が最新（emailEnabled）、3件目が最古（pushEnabled）
    expect(items[0]).toHaveTextContent('メール通知');
    expect(items[1]).toHaveTextContent('通知頻度');
    expect(items[2]).toHaveTextContent('プッシュ通知');
  });
});

describe('formatHistoryValue', () => {
  it('emailEnabled の true を ON に変換する', () => {
    expect(formatHistoryValue('emailEnabled', 'true')).toBe('ON');
  });

  it('emailEnabled の false を OFF に変換する', () => {
    expect(formatHistoryValue('emailEnabled', 'false')).toBe('OFF');
  });

  it('pushEnabled の true を ON に変換する', () => {
    expect(formatHistoryValue('pushEnabled', 'true')).toBe('ON');
  });

  it('pushEnabled の false を OFF に変換する', () => {
    expect(formatHistoryValue('pushEnabled', 'false')).toBe('OFF');
  });

  it('frequency の immediate を 即時 に変換する', () => {
    expect(formatHistoryValue('frequency', 'immediate')).toBe('即時');
  });

  it('frequency の daily を 日次ダイジェスト に変換する', () => {
    expect(formatHistoryValue('frequency', 'daily')).toBe('日次ダイジェスト');
  });

  it('frequency の weekly を 週次ダイジェスト に変換する', () => {
    expect(formatHistoryValue('frequency', 'weekly')).toBe('週次ダイジェスト');
  });
});

describe('formatDateTime', () => {
  it('ISO 8601文字列をYYYY/MM/DD HH:mm形式に変換する', () => {
    const result = formatDateTime('2026-04-02T00:00:00Z');
    // タイムゾーンに依存するためフォーマット形式のみ検証
    expect(result).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });
});
```

---

## 4. 依存関係図

```
Phase 1: src/types/notification.ts（型追加）
    │
    ├─── Phase 2-1: src/api/notificationClient.ts（API関数追加）  ─┐
    │                                                              │ 並列可
    ├─── Phase 2-2: app/api/notifications/history/route.ts（モック）─┘
    │
    ├─── Phase 3-1: src/hooks/useNotificationHistory.ts（Hook）    ─┐
    │                                                              │ 並列可
    ├─── Phase 3-2: src/components/NotificationHistory.tsx + CSS   ─┘
    │
    └─── Phase 4:   app/settings/notifications/page.tsx（ページ統合）
              │
              ├── Phase 5-1: useNotificationHistory.test.ts        ─┐
              │                                                     │ 並列可
              └── Phase 5-2: NotificationHistory.test.tsx           ─┘
```

## 5. 変更しないファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/components/NotificationSettingsForm.tsx` | 設定フォーム自体に変更なし |
| `src/components/NotificationSettingsForm.module.css` | スタイル変更なし |
| `src/hooks/useNotificationSettings.ts` | 設定取得・更新ロジックに変更なし |
| `app/api/notifications/settings/route.ts` | 既存の設定APIに変更なし |
| `src/components/__tests__/NotificationSettingsForm.test.tsx` | 既存テストに影響なし |
| `src/hooks/__tests__/useNotificationSettings.test.ts` | 既存テストに影響なし |
| `package.json` | 追加パッケージなし |

## 6. テスト方針

### 6.1 テストツール・パターン

- **テストフレームワーク**: Jest（既存 `jest.config.js` をそのまま使用）
- **テストユーティリティ**: `@testing-library/react`（`renderHook`, `render`, `screen`, `waitFor`）
- **モック手法**: `jest.mock('../../api/notificationClient')` でAPIクライアントモジュール全体をモック
- **パターン準拠**: 既存の `useNotificationSettings.test.ts` / `NotificationSettingsForm.test.tsx` と同一パターン

### 6.2 テストケース一覧

#### `useNotificationHistory` テスト（4件）

| # | テストケース | 検証内容 |
|---|-------------|----------|
| 1 | 履歴データを正常に取得できる | `history` にデータ設定、`error` が null、API呼び出し1回 |
| 2 | ローディング状態が正しく管理される | 初期 `loading=true` → 取得後 `loading=false` |
| 3 | APIエラー時にエラー状態が設定される | `error` にエラーオブジェクトが設定される |
| 4 | 取得データが空配列の場合も正しく処理される | `history` が空配列、`error` が null |

#### `NotificationHistory` コンポーネントテスト（7件）

| # | テストケース | 検証内容 |
|---|-------------|----------|
| 1 | 履歴データが正しく表示される | リスト件数の検証 |
| 2 | boolean値がON/OFFで表示される | `true` → `ON`, `false` → `OFF` |
| 3 | frequency値が日本語ラベルで表示される | `immediate` → `即時` 等 |
| 4 | ローディング中に「読み込み中...」が表示される | loading=true 時の表示 |
| 5 | エラー時に「履歴の取得に失敗しました」が表示される | error 設定時の表示 |
| 6 | 履歴が空の場合に「変更履歴はありません」が表示される | history=[] 時の表示 |
| 7 | 複数件の履歴が時系列順に表示される | リスト内の順序検証 |

#### `formatHistoryValue` ユニットテスト（7件）

| # | テストケース |
|---|-------------|
| 1-2 | emailEnabled の true/false → ON/OFF |
| 3-4 | pushEnabled の true/false → ON/OFF |
| 5-7 | frequency の immediate/daily/weekly → 日本語ラベル |

#### `formatDateTime` ユニットテスト（1件）

| # | テストケース |
|---|-------------|
| 1 | ISO 8601文字列が YYYY/MM/DD HH:mm 形式に変換される |

### 6.3 テスト実行コマンド

```bash
# 全テスト実行
npm test

# 新規テストのみ実行
npm test -- --testPathPattern="useNotificationHistory|NotificationHistory"
```

### 6.4 既存テストへの影響

既存テストへの影響はなし。新規ファイルの追加と既存ファイルへの追記のみで、既存の関数・コンポーネントのインターフェースは変更しない。

## 7. 実装上の注意事項

1. **既存コンポーネントとの分離**: `NotificationSettingsForm` には一切手を加えない。履歴表示は独立した `NotificationHistory` コンポーネントとして実装し、ページレベルで組み合わせる。
2. **日時フォーマット**: 外部ライブラリは使用せず、`Date` オブジェクトのメソッドでカスタムフォーマットする。
3. **エラーハンドリング**: 履歴取得エラーは設定表示をブロックしない。設定フォームと履歴の取得は独立して行い、片方がエラーでも他方は正常に表示する。
4. **パッケージ追加**: 不要。既存の依存関係のみで実装可能。
5. **テストパターン**: 既存の `useNotificationSettings.test.ts` と `NotificationSettingsForm.test.tsx` のパターンに完全準拠。
6. **ヘルパー関数のエクスポート**: `formatHistoryValue` と `formatDateTime` は named export してテスト可能にする。
