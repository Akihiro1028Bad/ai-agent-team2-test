# 設計書: Issue #42 イベント一覧画面の実装

## 1. 概要

イベント一覧を表示するページ（`/events`）と、各イベントを表示する `EventCard` コンポーネントを実装する。

### 1.1 背景

親Issue #39 にて、イベント管理機能の基盤（型定義・APIクライアント・カスタムHook）が #39-2 で整備される。本Issue（#39-3）では、その基盤を利用してイベント一覧画面を構築する。

### 1.2 ゴール

- イベント一覧をカード形式で表示するページを提供する
- 各カードクリックでイベント詳細ページ（`/events/[id]`）へ遷移する
- 「新規登録」ボタンからイベント新規作成ページ（`/events/new`）へ遷移する
- loading / error / データなしの各状態を適切に表示する

### 1.3 並行作業

本Issueは #39-4, #39-5 と並行作業可能である。

## 2. 依存関係

### 2.1 前提（#39-2 で提供される想定）

本Issueは #39-2（イベント管理の型定義・API・Hook）に依存する。以下のリソースが #39-2 で実装済みであることを前提とする。

#### Event 型定義（`src/types/event.ts`）

```typescript
export interface Event {
  id: string;
  title: string;
  date: Date;
  location: string;
  description?: string;
  createdAt: Date;
}
```

#### API関数（`src/api/client.ts` に追加）

```typescript
export async function getEvents(): Promise<Event[]> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return res.json();
}
```

#### カスタムHook（`src/hooks/useEvents.ts`）

```typescript
export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEvents()
      .then(setEvents)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { events, loading, error };
}
```

> **注意**: 上記は想定される形であり、#39-2 の実装内容に応じて調整が必要な場合がある。

## 3. 既存コードの分析

### 3.1 参照パターン: `UserCard` コンポーネント

```typescript
// src/components/UserCard.tsx
interface UserCardProps {
  user: User;
  onClick?: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  return (
    <div className="user-card" onClick={() => onClick?.(user)}>
      <img src={user.avatarUrl || '/default-avatar.png'} alt={user.name} />
      <h3>{user.name}</h3>
      <p>{user.email}</p>
    </div>
  );
};
```

`EventCard` は `UserCard` のパターンを踏襲しつつ、以下の点で異なる:
- CSS Modules によるスタイリング（`UserCard` はインラインクラス名のみ）
- イベント固有の情報（タイトル、日時、場所）を表示

### 3.2 参照パターン: 既存ページの状態管理

```typescript
// app/profile/page.tsx のパターン
if (loading) return <div>読み込み中...</div>;
if (error) return <div>エラーが発生しました: {error.message}</div>;
if (!profile) return <div>プロフィールが見つかりません</div>;
```

イベント一覧ページでも同様のパターンを採用する。

### 3.3 スタイリング方針

既存の CSS Modules（`UserProfileView.module.css`, `ProfileEditForm.module.css`）と同じデザイントークン（色、サイズ、間隔）を使用する。

- プライマリカラー: `#0070f3`
- ボーダー: `1px solid #ddd`
- ボーダーラディウス: `6px`
- フォントサイズ: 12px〜24px

## 4. URL設計

| パス | 用途 | 備考 |
|------|------|------|
| `/events` | イベント一覧表示 | 本Issueで実装 |
| `/events/new` | イベント新規作成 | 遷移先のみ（画面実装は別Issue） |
| `/events/[id]` | イベント詳細表示 | 遷移先のみ（画面実装は別Issue） |

## 5. コンポーネント設計

### 5.1 コンポーネント構成図

```
app/events/page.tsx                      ← イベント一覧ページ（新規）
app/events/__tests__/page.test.tsx       ← ページテスト（新規）

src/components/
  EventCard.tsx                          ← イベントカードコンポーネント（新規）
  EventCard.module.css                   ← スタイル（新規）
  __tests__/EventCard.test.tsx           ← コンポーネントテスト（新規）
```

### 5.2 各コンポーネントの責務

#### `EventCard`（新規）

**目的**: 個別のイベント情報をカード形式で表示する presentational コンポーネント。

**Props**:

```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
}
```

**表示内容**:
- タイトル（`event.title`）
- 日時（`event.date` を `toLocaleDateString('ja-JP')` でフォーマット）
- 場所（`event.location`）

**動作**:
- カード全体がクリッカブル
- `onClick` が指定されている場合、クリック時にコールバックを実行

**設計意図**:
- `UserCard` パターンに準拠し、コードベースの一貫性を保つ
- `onClick` の型を `() => void` とすることで、呼び出し元がルーティング制御を担う（`UserCard` の `(user: User) => void` とは異なるが、一覧ページ側で `event.id` を利用して遷移するため、Event オブジェクトを渡す必要がない）

#### `app/events/page.tsx`（新規）

**目的**: イベント一覧ページ。`'use client'` ディレクティブを使用する Client Component。

**動作**:
1. `useEvents()` フックでイベント一覧を取得
2. loading 中は「読み込み中...」を表示
3. error 時は「エラーが発生しました: {error.message}」を表示
4. データが空の場合は「イベントがありません」を表示
5. データがある場合は `EventCard` をリスト表示
6. 「新規登録」ボタンを表示し、クリックで `/events/new` へ遷移（`useRouter()`）
7. 各カードクリックで `/events/[id]` へ遷移（`useRouter()`）

## 6. 詳細実装設計

### 6.1 `src/components/EventCard.tsx`（新規）

```typescript
import React from 'react';
import { Event } from '../types/event';
import styles from './EventCard.module.css';

interface EventCardProps {
  event: Event;
  onClick?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  return (
    <div className={styles.card} onClick={onClick}>
      <h3 className={styles.title}>{event.title}</h3>
      <p className={styles.date}>
        {new Date(event.date).toLocaleDateString('ja-JP')}
      </p>
      <p className={styles.location}>{event.location}</p>
    </div>
  );
};
```

**確認ポイント**:
- `UserCard` パターン（React.FC + Props インターフェース）を踏襲
- `event.date` は `Date` 型だがAPIレスポンスでは文字列の場合があるため、`new Date()` でラップ
- CSS Modules でスタイリング（`UserCard` の改善版）

### 6.2 `src/components/EventCard.module.css`（新規）

```css
.card {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.2s;
}

.card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.title {
  font-size: 18px;
  font-weight: bold;
  margin: 0 0 8px 0;
}

.date {
  font-size: 14px;
  color: #666;
  margin: 0 0 4px 0;
}

.location {
  font-size: 14px;
  color: #888;
  margin: 0;
}
```

**確認ポイント**:
- 既存の CSS Modules（`UserProfileView.module.css`）と同じデザイントークンを使用
- ホバー時にシャドウを追加しクリッカブルであることを視覚的に示す

### 6.3 `app/events/page.tsx`（新規）

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEvents } from '../../src/hooks/useEvents';
import { EventCard } from '../../src/components/EventCard';

export default function EventsPage() {
  const { events, loading, error } = useEvents();
  const router = useRouter();

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;

  return (
    <div>
      <h1>イベント一覧</h1>
      <button onClick={() => router.push('/events/new')}>新規登録</button>
      {events.length === 0 ? (
        <p>イベントがありません</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {events.map((event) => (
            <li key={event.id} style={{ marginBottom: '12px' }}>
              <EventCard
                event={event}
                onClick={() => router.push(`/events/${event.id}`)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**確認ポイント**:
- `'use client'` ディレクティブ（`useRouter`, `useEvents` 使用のため）
- 既存ページ（`app/profile/page.tsx`, `app/users/[id]/page.tsx`）と同じ loading/error パターン
- `useRouter()` で遷移制御（Next.js App Router の `next/navigation` を使用）
- 空一覧時は「イベントがありません」メッセージを表示
- 各カードの `onClick` で `/events/[id]` へ遷移

## 7. 状態管理

### 7.1 画面の状態遷移

```
[/events ページ]
  Loading → イベント一覧表示（データあり）
         → 空一覧表示（「イベントがありません」）
         → エラー表示
```

### 7.2 状態一覧

| 状態 | 説明 | 表示内容 |
|------|------|----------|
| `loading === true` | イベント一覧取得中 | 「読み込み中...」 |
| `error !== null` | API呼び出しエラー | 「エラーが発生しました: {message}」 |
| `events.length === 0` | データなし | 「イベントがありません」 |
| `events.length > 0` | データあり | `EventCard` のリスト + 「新規登録」ボタン |

## 8. ファイル変更一覧

### 8.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/components/EventCard.tsx` | コンポーネント | イベントカード表示 |
| `src/components/EventCard.module.css` | スタイル | イベントカードのスタイル |
| `app/events/page.tsx` | ページ | イベント一覧画面 |
| `src/components/__tests__/EventCard.test.tsx` | テスト | EventCard のユニットテスト |
| `app/events/__tests__/page.test.tsx` | テスト | イベント一覧ページの結合テスト |

### 8.2 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/event.ts` | #39-2 で作成済み（変更不要） |
| `src/api/client.ts` | #39-2 で `getEvents` 追加済み（変更不要） |
| `src/hooks/useEvents.ts` | #39-2 で作成済み（変更不要） |
| `src/components/UserCard.tsx` | スコープ外 |

## 9. テスト設計

### 9.1 `src/components/__tests__/EventCard.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventCard } from '../EventCard';
import { Event } from '../../types/event';

const mockEvent: Event = {
  id: 'event-1',
  title: 'テストイベント',
  date: new Date('2025-04-01'),
  location: '東京都渋谷区',
  description: 'イベントの説明文',
  createdAt: new Date('2025-01-01'),
};

describe('EventCard', () => {
  it('タイトルが表示される', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('テストイベント')).toBeInTheDocument();
  });

  it('日時が ja-JP フォーマットで表示される', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('2025/4/1')).toBeInTheDocument();
  });

  it('場所が表示される', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.getByText('東京都渋谷区')).toBeInTheDocument();
  });

  it('クリック時に onClick が呼ばれる', () => {
    const handleClick = jest.fn();
    render(<EventCard event={mockEvent} onClick={handleClick} />);

    fireEvent.click(screen.getByText('テストイベント'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('onClick が未指定の場合でもエラーにならない', () => {
    render(<EventCard event={mockEvent} />);
    expect(() => {
      fireEvent.click(screen.getByText('テストイベント'));
    }).not.toThrow();
  });
});
```

### 9.2 `app/events/__tests__/page.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventsPage from '../page';
import { getEvents } from '../../../src/api/client';

// next/navigation のモック
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../../../src/api/client');

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;

const mockEvents = [
  {
    id: 'event-1',
    title: 'イベント1',
    date: new Date('2025-04-01'),
    location: '東京',
    createdAt: new Date('2025-01-01'),
  },
  {
    id: 'event-2',
    title: 'イベント2',
    date: new Date('2025-05-01'),
    location: '大阪',
    createdAt: new Date('2025-02-01'),
  },
];

describe('EventsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ローディング中は「読み込み中...」が表示される', () => {
    mockGetEvents.mockReturnValue(new Promise(() => {}));
    render(<EventsPage />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('イベント一覧が正常に表示される', async () => {
    mockGetEvents.mockResolvedValue(mockEvents);
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('イベント1')).toBeInTheDocument();
    });
    expect(screen.getByText('イベント2')).toBeInTheDocument();
  });

  it('API エラー時にエラーメッセージが表示される', async () => {
    mockGetEvents.mockRejectedValue(new Error('Fetch failed'));
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
    });
  });

  it('イベントが0件の場合は「イベントがありません」が表示される', async () => {
    mockGetEvents.mockResolvedValue([]);
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('イベントがありません')).toBeInTheDocument();
    });
  });

  it('新規登録ボタンクリックで /events/new に遷移する', async () => {
    mockGetEvents.mockResolvedValue(mockEvents);
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('新規登録')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新規登録'));
    expect(mockPush).toHaveBeenCalledWith('/events/new');
  });

  it('カードクリックで /events/[id] に遷移する', async () => {
    mockGetEvents.mockResolvedValue(mockEvents);
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('イベント1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('イベント1'));
    expect(mockPush).toHaveBeenCalledWith('/events/event-1');
  });
});
```

### 9.3 テスト実行コマンド

```bash
npm test
```

## 10. 実装上の注意事項

### 10.1 #39-2 との依存関係

- 本Issueの実装は #39-2 のマージ後に開始すること
- #39-2 で提供される `Event` 型、`getEvents()` API関数、`useEvents()` Hook の実際のインターフェースに合わせて調整が必要な場合がある
- 特に `Event` 型のフィールド名やオプショナル属性が想定と異なる場合は適宜修正する

### 10.2 日時フォーマット

- `event.date` は APIレスポンスでは JSON 文字列（ISO 8601）として返る可能性があるため、`new Date(event.date)` でラップしてから `toLocaleDateString('ja-JP')` を呼び出す
- テスト環境のロケール設定により `toLocaleDateString` の出力が異なる可能性があるため、テスト時は注意が必要

### 10.3 遷移先ページの未実装

- `/events/new` および `/events/[id]` は本Issueのスコープ外（#39-4, #39-5 で実装予定）
- 本Issue時点では遷移先のページが存在しないが、ボタン/カードの遷移ロジック自体は実装する
- テストでは `useRouter().push` のモックで遷移先の検証を行う

### 10.4 アクセシビリティ

- `EventCard` のクリッカブルな `div` にはキーボードアクセシビリティ（`role="button"`, `tabIndex`, `onKeyDown`）の追加を検討するが、本Issueでは `UserCard` パターンに合わせて最小限の実装とする

## 11. 実装順序

1. **`src/components/EventCard.module.css`** — スタイル定義
2. **`src/components/EventCard.tsx`** — イベントカードコンポーネント
3. **`app/events/page.tsx`** — イベント一覧ページ
4. **`src/components/__tests__/EventCard.test.tsx`** — EventCard テスト
5. **`app/events/__tests__/page.test.tsx`** — ページテスト

### 依存関係図

```
src/types/event.ts（#39-2 で作成済み）
src/api/client.ts（#39-2 で getEvents 追加済み）
src/hooks/useEvents.ts（#39-2 で作成済み）
  ↓
src/components/EventCard.module.css（新規）     ── 順序 1
src/components/EventCard.tsx（新規）            ── 順序 2
  ↓
app/events/page.tsx（新規）                     ── 順序 3
  ↓
テスト作成                                      ── 順序 4, 5
```

## 12. 受け入れ条件チェックリスト

- [ ] `/events` にアクセスするとイベント一覧画面が表示される
- [ ] 新規登録ボタンが `/events/new` に遷移する
- [ ] 各カードクリックで `/events/[id]` に遷移する
- [ ] loading 状態が正しく表示される（「読み込み中...」）
- [ ] error 状態が正しく表示される（「エラーが発生しました: {message}」）
- [ ] データなし状態が正しく表示される（「イベントがありません」）
- [ ] テストがすべてパスする
