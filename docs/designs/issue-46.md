# 設計書: Issue #46 イベント削除機能とナビゲーション追加

## 1. 概要

イベントの削除機能（確認ダイアログ付き）と、レイアウトへのナビゲーションリンク追加を実装する。

### 1.1 背景

親 Issue #39 のイベント管理機能の一環として、イベントの削除機能を追加する。現在、一覧画面（`EventCard`）および詳細画面（`/events/[id]`）からイベントを削除する手段がない。また、`app/layout.tsx` にナビゲーションが存在せず、ページ間の遷移手段が不足している。

### 1.2 ゴール

- 一覧画面（`EventCard`）からイベントを削除できるようにする
- 詳細画面（`/events/[id]`）からイベントを削除できるようにする
- 削除前に確認ダイアログ（`window.confirm`）を表示する
- 削除成功後、イベント一覧画面（`/events`）へ遷移する
- レイアウトにヘッダーナビゲーション（「イベント一覧」リンク）を追加する

### 1.3 依存関係

- **#39-3（Issue #42）**: イベント一覧画面・`EventCard` コンポーネント
- **#39-4（Issue #44）**: イベント新規登録画面・`EventForm` コンポーネント
- **#39-5（想定）**: イベント詳細画面（`/events/[id]`）

## 2. 既存コードの分析

### 2.1 前提（依存 Issue で提供される想定）

#### Event 型定義（`src/types/event.ts`）

```typescript
export interface Event {
  id: string;
  title: string;
  description?: string;
  eventDate: string; // ISO 8601 形式
  location?: string;
  locationUrl?: string;
  organizer?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### API 関数（`src/api/client.ts`）

依存 Issue で以下が追加済みの想定:

```typescript
export async function getEvents(): Promise<Event[]>;
export async function getEvent(id: string): Promise<Event>;
export async function createEvent(data: CreateEventInput): Promise<Event>;
```

本 Issue で `deleteEvent` 関数を追加する。

#### EventCard コンポーネント（`src/components/EventCard.tsx`）

#39-3 で作成済みの想定:

```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
}
```

本 Issue で `onDelete` コールバックを追加する。

#### イベント詳細ページ（`app/events/[id]/page.tsx`）

#39-5 で作成済みの想定。本 Issue で削除ボタンと `onDelete` ハンドラを追加する。

### 2.2 現在の `app/layout.tsx`

```typescript
import React from 'react';

export const metadata = {
  title: 'Sample App',
  description: 'Next.js + TypeScript サンプルアプリケーション',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
```

現在、ナビゲーションは存在しない。本 Issue でヘッダーナビゲーションを追加する。

### 2.3 参照パターン

#### 削除 API パターン（`src/api/client.ts` 既存関数に準拠）

既存の API 関数は以下の共通パターンを持つ:

- `fetch` で API エンドポイントにリクエスト
- `!res.ok` の場合 `throw new Error(...)` でエラーをスロー
- 戻り値は `res.json()` の Promise

削除 API は戻り値が不要なため `Promise<void>` とする。

#### 確認ダイアログパターン

Issue 要件に基づき `window.confirm()` を使用する。ブラウザネイティブの確認ダイアログにより追加の UI コンポーネント実装は不要。

## 3. コンポーネント設計

### 3.1 変更対象ファイル一覧

```
src/api/client.ts                              ← 変更（deleteEvent 関数を追加）
src/components/EventCard.tsx                   ← 変更（削除ボタン追加）
src/components/EventCard.module.css            ← 変更（削除ボタンスタイル追加）
app/events/[id]/page.tsx                       ← 変更（削除処理の実装）
app/layout.tsx                                 ← 変更（ナビゲーションリンク追加）

src/components/__tests__/EventCard.test.tsx    ← 変更（削除テスト追加）
app/events/[id]/__tests__/page.test.tsx        ← 変更（削除テスト追加）
app/layout.test.tsx                            ← 新規（ナビゲーションテスト）
```

### 3.2 `EventCard` コンポーネントの変更

#### 変更前の Props

```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
}
```

#### 変更後の Props

```typescript
interface EventCardProps {
  event: Event;
  onClick?: () => void;
  onDelete?: (event: Event) => void;
}
```

#### 変更内容

カード内に削除ボタンを追加する。削除ボタンクリック時にイベント伝播を停止し（カードの `onClick` が発火しないようにする）、`onDelete` コールバックを呼び出す。

```typescript
import React from 'react';
import { Event } from '../types/event';
import styles from './EventCard.module.css';

interface EventCardProps {
  event: Event;
  onClick?: () => void;
  onDelete?: (event: Event) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation(); // カードの onClick を防止
    if (window.confirm('このイベントを削除しますか？')) {
      onDelete?.(event);
    }
  };

  return (
    <div className={styles.card} onClick={onClick}>
      <h3 className={styles.title}>{event.title}</h3>
      <p className={styles.date}>
        {new Date(event.date).toLocaleDateString('ja-JP')}
      </p>
      <p className={styles.location}>{event.location}</p>
      {onDelete && (
        <button
          className={styles.deleteButton}
          onClick={handleDelete}
          type="button"
        >
          削除
        </button>
      )}
    </div>
  );
};
```

**設計意図**:

- `onDelete` が未指定の場合、削除ボタンを非表示にする（既存の使用箇所への影響を最小限にする）
- `e.stopPropagation()` でカードクリックイベントの伝播を停止し、削除ボタンクリック時にカード遷移が発生しないようにする
- `window.confirm('このイベントを削除しますか？')` で確認ダイアログを表示し、ユーザーが「OK」を押した場合のみ `onDelete` を呼び出す
- `onDelete` に `event` オブジェクトを渡し、呼び出し元が `event.id` を使って削除 API を呼び出せるようにする

### 3.3 `EventCard.module.css` の追加スタイル

```css
/* 既存スタイルの末尾に追加 */
.deleteButton {
  margin-top: 12px;
  padding: 4px 12px;
  background: #e00;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.deleteButton:hover {
  background: #c00;
}
```

### 3.4 `app/events/[id]/page.tsx` の変更

イベント詳細ページに削除ボタンと削除処理を追加する。

#### 変更内容

```typescript
'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEvent } from '../../../src/hooks/useEvent';
import { deleteEvent } from '../../../src/api/client';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { event, loading, error } = useEvent(id);

  const handleDelete = async () => {
    if (!window.confirm('このイベントを削除しますか？')) return;
    try {
      await deleteEvent(id);
      router.push('/events');
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました: {error.message}</div>;
  if (!event) return <div>イベントが見つかりません</div>;

  return (
    <div>
      <h1>{event.title}</h1>
      <p>日時: {new Date(event.eventDate).toLocaleDateString('ja-JP')}</p>
      {event.location && <p>場所: {event.location}</p>}
      {event.description && <p>{event.description}</p>}
      {event.organizer && <p>主催者: {event.organizer}</p>}
      <button onClick={handleDelete}>削除</button>
    </div>
  );
}
```

**設計意図**:

- `window.confirm('このイベントを削除しますか？')` で確認後、`deleteEvent(id)` を呼び出す
- 削除成功時は `router.push('/events')` でイベント一覧に遷移する
- 削除失敗時は `alert()` でエラーメッセージを表示する（ページ遷移は行わない）
- 既存の loading / error パターンを踏襲する

### 3.5 `app/layout.tsx` の変更

ヘッダーナビゲーションを追加する。

#### 変更後のコード

```typescript
import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Sample App',
  description: 'Next.js + TypeScript サンプルアプリケーション',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header style={{ padding: '12px 24px', borderBottom: '1px solid #ddd' }}>
          <nav>
            <Link href="/events" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}>
              イベント一覧
            </Link>
          </nav>
        </header>
        <main style={{ padding: '24px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
```

**設計意図**:

- Server Component のまま維持する（`Link` コンポーネントは Server Component で使用可能）
- `next/link` の `Link` コンポーネントを使用し、クライアントサイドナビゲーションを実現する
- インラインスタイルで最小限のスタイリングを行う（既存の CSS Modules パターンに合わせて将来的にモジュール化可能）
- `<header>` + `<nav>` のセマンティック HTML 構造
- `<main>` タグでコンテンツエリアをラップし、レイアウトを整理する

## 4. API 設計

### 4.1 追加する API 関数

```typescript
// src/api/client.ts に追加
export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/events/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
}
```

**確認ポイント**:

- 既存の API 関数と同じエラーハンドリングパターンを踏襲
- `DELETE` メソッドを使用
- 戻り値は `void`（削除後のレスポンスボディは不要）
- `Content-Type` ヘッダーは不要（リクエストボディなし）

### 4.2 API 呼び出しフロー

```
[一覧画面からの削除]
  app/events/page.tsx
    → EventCard (onDelete)
      → window.confirm('このイベントを削除しますか？')
        → OK: deleteEvent(event.id) → DELETE /api/events/:id
          → 成功: イベント一覧を再取得（ページリロードまたは state 更新）
          → 失敗: エラーハンドリング
        → キャンセル: 何もしない

[詳細画面からの削除]
  app/events/[id]/page.tsx
    → 削除ボタン (handleDelete)
      → window.confirm('このイベントを削除しますか？')
        → OK: deleteEvent(id) → DELETE /api/events/:id
          → 成功: router.push('/events')
          → 失敗: alert(エラーメッセージ)
        → キャンセル: 何もしない
```

## 5. 一覧画面での削除処理の統合

### 5.1 `app/events/page.tsx` の変更

一覧画面で `EventCard` の `onDelete` を処理するため、`app/events/page.tsx` にも変更が必要。

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useEvents } from '../../src/hooks/useEvents';
import { deleteEvent } from '../../src/api/client';
import { EventCard } from '../../src/components/EventCard';
import { Event } from '../../src/types/event';

export default function EventsPage() {
  const { events, loading, error, refetch } = useEvents();
  const router = useRouter();

  const handleDelete = async (event: Event) => {
    try {
      await deleteEvent(event.id);
      refetch(); // 一覧を再取得
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

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
                onDelete={handleDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**注意**: `useEvents` Hook に `refetch` 関数が存在しない場合は、以下のいずれかの方法で対応する:

1. **（推奨）`useEvents` に `refetch` を追加**: `useEvents` Hook の戻り値に `refetch` 関数を追加し、削除後に一覧を再取得する
2. **`router.refresh()` を使用**: Next.js App Router の `router.refresh()` を呼び出してページをリフレッシュする
3. **ローカル state から削除**: `events` state から削除対象を filter で除外する

本設計では方法 1 を想定するが、`useEvents` の実装に依存する。

### 5.2 `useEvents` Hook への `refetch` 追加（必要に応じて）

```typescript
// src/hooks/useEvents.ts に refetch を追加
export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = () => {
    setLoading(true);
    setError(null);
    getEvents()
      .then(setEvents)
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const refetch = () => {
    fetchEvents();
  };

  return { events, loading, error, refetch };
}
```

## 6. 状態管理

### 6.1 画面の状態遷移

```
[一覧画面 /events — 削除フロー]
  イベント一覧表示
    → 削除ボタンクリック
      → window.confirm 表示
        → OK: deleteEvent() 呼び出し → 成功: refetch() → 一覧再表示
                                      → 失敗: alert(エラー)
        → キャンセル: 何もしない

[詳細画面 /events/[id] — 削除フロー]
  イベント詳細表示
    → 削除ボタンクリック
      → window.confirm 表示
        → OK: deleteEvent() 呼び出し → 成功: router.push('/events')
                                      → 失敗: alert(エラー)
        → キャンセル: 何もしない
```

### 6.2 状態一覧（追加分）

| 状態 | 場所 | 説明 |
|------|------|------|
| `window.confirm` の結果 | ブラウザネイティブ | 削除確認（OK/キャンセル） |
| `deleteEvent` の pending | `handleDelete` 内の `await` | 削除 API 呼び出し中 |

## 7. ファイル変更一覧

### 7.1 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/api/client.ts` | `deleteEvent(id)` 関数を追加 |
| `src/components/EventCard.tsx` | `onDelete` prop 追加、削除ボタン追加 |
| `src/components/EventCard.module.css` | `.deleteButton` スタイル追加 |
| `app/events/[id]/page.tsx` | 削除ボタンと `handleDelete` ハンドラ追加 |
| `app/events/page.tsx` | `EventCard` に `onDelete` を渡す処理追加 |
| `app/layout.tsx` | ヘッダーナビゲーション追加 |
| `src/hooks/useEvents.ts` | `refetch` 関数を追加（必要に応じて） |

### 7.2 変更テストファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/components/__tests__/EventCard.test.tsx` | 削除ボタンのテスト追加 |
| `app/events/[id]/__tests__/page.test.tsx` | 詳細画面の削除テスト追加 |
| `app/events/__tests__/page.test.tsx` | 一覧画面の削除テスト追加 |

### 7.3 新規テストファイル

| ファイルパス | 説明 |
|-------------|------|
| `app/__tests__/layout.test.tsx` | ナビゲーションのテスト |

### 7.4 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/event.ts` | 型定義の変更不要 |
| `src/components/EventForm.tsx` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |

## 8. テスト設計

### 8.1 `EventCard` 削除テスト追加（`src/components/__tests__/EventCard.test.tsx`）

既存テストに以下を追加:

```typescript
describe('EventCard - 削除機能', () => {
  it('onDelete が指定されている場合、削除ボタンが表示される', () => {
    const onDelete = jest.fn();
    render(<EventCard event={mockEvent} onDelete={onDelete} />);
    expect(screen.getByText('削除')).toBeInTheDocument();
  });

  it('onDelete が未指定の場合、削除ボタンが表示されない', () => {
    render(<EventCard event={mockEvent} />);
    expect(screen.queryByText('削除')).not.toBeInTheDocument();
  });

  it('削除ボタンクリックで window.confirm が呼ばれる', () => {
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => true);
    render(<EventCard event={mockEvent} onDelete={onDelete} />);

    fireEvent.click(screen.getByText('削除'));
    expect(window.confirm).toHaveBeenCalledWith('このイベントを削除しますか？');
  });

  it('window.confirm で OK を押すと onDelete が呼ばれる', () => {
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => true);
    render(<EventCard event={mockEvent} onDelete={onDelete} />);

    fireEvent.click(screen.getByText('削除'));
    expect(onDelete).toHaveBeenCalledWith(mockEvent);
  });

  it('window.confirm でキャンセルを押すと onDelete が呼ばれない', () => {
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => false);
    render(<EventCard event={mockEvent} onDelete={onDelete} />);

    fireEvent.click(screen.getByText('削除'));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('削除ボタンクリック時にカードの onClick が発火しない', () => {
    const onClick = jest.fn();
    const onDelete = jest.fn();
    window.confirm = jest.fn(() => true);
    render(<EventCard event={mockEvent} onClick={onClick} onDelete={onDelete} />);

    fireEvent.click(screen.getByText('削除'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

### 8.2 イベント詳細画面の削除テスト追加（`app/events/[id]/__tests__/page.test.tsx`）

既存テストに以下を追加:

```typescript
describe('EventDetailPage - 削除機能', () => {
  it('削除ボタンが表示される', async () => {
    mockGetEvent.mockResolvedValue(mockEvent);
    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('削除')).toBeInTheDocument();
    });
  });

  it('削除ボタンクリックで window.confirm が呼ばれる', async () => {
    mockGetEvent.mockResolvedValue(mockEvent);
    window.confirm = jest.fn(() => false);
    render(<EventDetailPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('削除'));
    });
    expect(window.confirm).toHaveBeenCalledWith('このイベントを削除しますか？');
  });

  it('削除確認で OK を押すと deleteEvent が呼ばれ /events に遷移する', async () => {
    mockGetEvent.mockResolvedValue(mockEvent);
    mockDeleteEvent.mockResolvedValue(undefined);
    window.confirm = jest.fn(() => true);
    render(<EventDetailPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('削除'));
    });

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith('event-1');
      expect(mockPush).toHaveBeenCalledWith('/events');
    });
  });

  it('削除確認でキャンセルを押すと deleteEvent が呼ばれない', async () => {
    mockGetEvent.mockResolvedValue(mockEvent);
    window.confirm = jest.fn(() => false);
    render(<EventDetailPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('削除'));
    });
    expect(mockDeleteEvent).not.toHaveBeenCalled();
  });

  it('削除失敗時に alert でエラーメッセージが表示される', async () => {
    mockGetEvent.mockResolvedValue(mockEvent);
    mockDeleteEvent.mockRejectedValue(new Error('削除エラー'));
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
    render(<EventDetailPage />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('削除'));
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('削除エラー');
    });
  });
});
```

### 8.3 ナビゲーションテスト（`app/__tests__/layout.test.tsx`）

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../layout';

// next/link のモック
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

describe('RootLayout', () => {
  it('ナビゲーションに「イベント一覧」リンクが表示される', () => {
    render(
      <RootLayout>
        <div>テストコンテンツ</div>
      </RootLayout>
    );
    const link = screen.getByText('イベント一覧');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/events');
  });

  it('children が正しくレンダリングされる', () => {
    render(
      <RootLayout>
        <div>テストコンテンツ</div>
      </RootLayout>
    );
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument();
  });
});
```

### 8.4 一覧画面の削除テスト追加（`app/events/__tests__/page.test.tsx`）

既存テストに以下を追加:

```typescript
describe('EventsPage - 削除機能', () => {
  it('各カードに削除ボタンが表示される', async () => {
    mockGetEvents.mockResolvedValue(mockEvents);
    render(<EventsPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByText('削除');
      expect(deleteButtons).toHaveLength(mockEvents.length);
    });
  });

  it('削除成功後にイベント一覧が再取得される', async () => {
    mockGetEvents.mockResolvedValue(mockEvents);
    mockDeleteEvent.mockResolvedValue(undefined);
    window.confirm = jest.fn(() => true);
    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText('イベント1')).toBeInTheDocument();
    });

    // 最初のイベントの削除ボタンをクリック
    const deleteButtons = screen.getAllByText('削除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith('event-1');
      // getEvents が再呼び出しされることを検証
      expect(mockGetEvents).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 8.5 テスト実行コマンド

```bash
npm test
```

## 9. 実装上の注意事項

### 9.1 依存 Issue との整合性

- `EventCard` の既存 Props インターフェースに `onDelete` を追加する際、既存の使用箇所に影響が無いことを確認する（`onDelete` はオプショナルなため破壊的変更にはならない）
- `app/events/[id]/page.tsx` の実装は #39-5 の内容に依存する。#39-5 の実装が想定と異なる場合は適宜調整する
- `useEvents` Hook に `refetch` が存在しない場合は、`router.refresh()` または ローカル state からの削除で代替する

### 9.2 イベント伝播の制御

- `EventCard` 内の削除ボタンクリック時に `e.stopPropagation()` を必ず呼び出す
- これにより、削除ボタンクリック時にカード全体の `onClick`（詳細画面への遷移）が発火しない

### 9.3 確認ダイアログのテスト

- `window.confirm` は jest でモックする: `window.confirm = jest.fn(() => true/false)`
- テスト後の cleanup で元の `window.confirm` を復元することを検討する

### 9.4 ナビゲーションの拡張性

- 現時点では「イベント一覧」リンクのみだが、将来的に他のリンク（「プロフィール」等）を追加しやすい構造にする
- `<nav>` タグ内にリンクを配置し、セマンティックな HTML 構造を維持する

### 9.5 エラーハンドリング

- 一覧画面での削除失敗時: `alert()` でエラーメッセージを表示し、一覧の状態は変更しない
- 詳細画面での削除失敗時: `alert()` でエラーメッセージを表示し、ページ遷移は行わない
- 将来的にはトースト通知等に置き換えることを検討するが、本 Issue では `alert()` で最小限の実装とする

## 10. 実装順序

1. **`src/api/client.ts`** — `deleteEvent` 関数を追加
2. **`src/hooks/useEvents.ts`** — `refetch` 関数を追加（必要に応じて）
3. **`src/components/EventCard.module.css`** — `.deleteButton` スタイル追加
4. **`src/components/EventCard.tsx`** — `onDelete` prop・削除ボタン追加
5. **`app/events/[id]/page.tsx`** — 削除処理の実装
6. **`app/events/page.tsx`** — 削除処理の統合
7. **`app/layout.tsx`** — ナビゲーションリンク追加
8. **テスト作成・修正** — 全テストファイルの更新

### 依存関係図

```
src/api/client.ts（変更: deleteEvent 追加）           ── 順序 1
src/hooks/useEvents.ts（変更: refetch 追加）          ── 順序 2
  ↓
src/components/EventCard.module.css（変更）            ── 順序 3
src/components/EventCard.tsx（変更）                   ── 順序 4
  ↓
app/events/[id]/page.tsx（変更）                       ── 順序 5
app/events/page.tsx（変更）                            ── 順序 6
  ↓（独立）
app/layout.tsx（変更）                                 ── 順序 7（独立して実装可能）
  ↓
テスト作成                                             ── 順序 8
```

**並列実装可能なグループ**:
- 順序 5 と 順序 6 は互いに独立しているため並列実装可能
- 順序 7 は他の全変更と独立しているため、いつでも実装可能

## 11. 受け入れ条件チェックリスト

- [ ] 一覧画面（`EventCard`）に削除ボタンが表示される
- [ ] 詳細画面（`/events/[id]`）に削除ボタンが表示される
- [ ] 一覧画面・詳細画面の両方から削除が可能
- [ ] 削除前に確認ダイアログ（「このイベントを削除しますか？」）が表示される
- [ ] 確認ダイアログでキャンセルした場合、削除は行われない
- [ ] 削除成功後、一覧画面（`/events`）に遷移する（詳細画面から）/ 一覧が再取得される（一覧画面から）
- [ ] 削除失敗時にエラーメッセージが表示される
- [ ] レイアウトに「イベント一覧」へのナビゲーションリンクが表示される
- [ ] ナビゲーションリンクが `/events` に遷移する
- [ ] テストがすべてパスする
