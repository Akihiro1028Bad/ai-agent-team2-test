# 設計書: Issue #41 イベント用カスタムフックの実装 (#39-2)

## 1. 概要

イベントのCRUD操作をラップするカスタムフック `useEvents` / `useEvent` を実装する。既存の `useUser` / `useUserProfile` パターンに準拠し、一貫性のあるAPI呼び出しと状態管理を提供する。

### 1.1 背景

親Issue #39 のサブタスクとして、イベント機能のフロントエンド実装を段階的に進めている。本Issueでは、依存先 #39-1（Event型・APIクライアント関数の実装）で追加される型定義・API関数を利用して、Reactカスタムフックを提供する。

### 1.2 ゴール

- イベント一覧取得用フック `useEvents` の実装
- イベント個別取得・更新・削除用フック `useEvent` の実装
- 既存パターンと同等のテストカバレッジの確保

### 1.3 前提条件（依存関係）

本Issueは **#39-1** の完了を前提とする。#39-1 で以下が追加される想定：

| 必要なもの | 想定パス | 説明 |
|---|---|---|
| `Event` 型定義 | `src/types/event.ts` | イベントのインターフェース定義 |
| `getEvents()` | `src/api/client.ts` | イベント一覧取得 |
| `getEvent(id)` | `src/api/client.ts` | イベント個別取得 |
| `updateEvent(id, data)` | `src/api/client.ts` | イベント更新 |
| `deleteEvent(id)` | `src/api/client.ts` | イベント削除 |

## 2. 要件（ヒアリング結果）

過去のやりとりで確認した設計判断（デフォルト確定済み）：

| # | 項目 | 決定事項 | 理由 |
|---|------|----------|------|
| Q1 | `useEvents` の `refetch` の挙動 | シンプルな再取得関数（`loading: true` → `getEvents()` → ステート更新 → `loading: false`） | 既存パターンにはないが、一覧取得のユースケースとして必要 |
| Q2 | `useEvent` の `deleteEvent` 後の状態 | `event` ステートを `null` に設定 | フック内で完結させ、呼び出し元は `null` を検知して画面遷移等を行う |
| Q3 | `useEvents` のフィルタリング引数 | 引数なし（全件取得） | シンプルに保ち、将来的なフィルタ拡張は別途対応 |

## 3. 既存コードの分析

### 3.1 準拠すべき既存パターン

#### `useUser`（取得のみフック）

```typescript
// src/hooks/useUser.ts
export function useUser(id: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    getUser(id)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  return { user, loading, error };
}
```

#### `useUserProfile`（取得 + 更新フック）

```typescript
// src/hooks/useUserProfile.ts
export function useUserProfile(id: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getUserProfile(id)
      .then(setProfile)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const updateProfile = async (data: Partial<UserProfile>) => {
    const updated = await updateUserProfile(id, data);
    setProfile(updated);
    return updated;
  };

  return { profile, loading, error, updateProfile };
}
```

#### テストパターン（`useUserProfile.test.ts`）

- `jest.mock('../../api/client')` でAPIモジュール全体をモック
- `renderHook` + `waitFor` で非同期の初回取得をテスト
- `act` で更新操作をラップ
- テストケース: 正常取得 / エラー / 更新成功 / 更新失敗 / ID変更時再取得の5パターン

### 3.2 既存パターンとの差分

| 観点 | `useUser` / `useUserProfile` | `useEvents` / `useEvent` |
|---|---|---|
| データ取得 | 単一IDで取得 | `useEvents`: 引数なし一覧取得 / `useEvent`: IDで個別取得 |
| 再取得 | なし | `useEvents`: `refetch()` を提供 |
| 更新操作 | `useUserProfile`: `updateProfile` | `useEvent`: `updateEvent` + `deleteEvent` |
| 削除操作 | なし | `useEvent`: `deleteEvent` 後に `event` を `null` に設定 |

## 4. 想定される Event 型

#39-1 で定義される `Event` 型は以下のような構造を想定：

```typescript
// src/types/event.ts（#39-1 で追加予定）
export interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;          // ISO 8601 形式
  location?: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

> ※ 実際の型定義は #39-1 の実装に従う。フック側は `Event` 型をインポートして使用するため、フィールド構成に依存しない設計とする。

## 5. カスタムフック設計

### 5.1 `useEvents`（新規: `src/hooks/useEvents.ts`）

**目的**: イベント一覧の取得と再取得機能を提供する。

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Event } from '../types/event';
import { getEvents } from '../api/client';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    setError(null);
    getEvents()
      .then(setEvents)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refetch = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch };
}
```

**設計ポイント**:
- 既存 `useUser` の `useState` + `useEffect` パターンを踏襲
- `refetch` は `fetchEvents` を再呼び出しするシンプルな関数
- `useCallback` で `fetchEvents` をメモ化し、不要な再レンダリングを防止
- `useEffect` 内で `setError(null)` をリセットし、再取得時にエラー状態をクリア（`useUserProfile` パターン準拠）
- 初期値は空配列 `[]`（`useUser` の `null` とは異なり、一覧なので空配列が適切）

**戻り値**:

| プロパティ | 型 | 説明 |
|---|---|---|
| `events` | `Event[]` | イベント一覧（初期値: `[]`） |
| `loading` | `boolean` | 取得中フラグ（初期値: `true`） |
| `error` | `Error \| null` | エラー情報（初期値: `null`） |
| `refetch` | `() => void` | データ再取得をトリガーする関数 |

### 5.2 `useEvent`（新規: `src/hooks/useEvent.ts`）

**目的**: イベント個別の取得・更新・削除機能を提供する。

```typescript
import { useState, useEffect } from 'react';
import { Event } from '../types/event';
import {
  getEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
} from '../api/client';

export function useEvent(id: string) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEvent(id)
      .then(setEvent)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);

  const updateEvent = async (data: Partial<Event>) => {
    const updated = await apiUpdateEvent(id, data);
    setEvent(updated);
    return updated;
  };

  const deleteEvent = async () => {
    await apiDeleteEvent(id);
    setEvent(null);
  };

  return { event, loading, error, updateEvent, deleteEvent };
}
```

**設計ポイント**:
- 既存 `useUserProfile` パターンを忠実に踏襲
- `useEffect` の依存配列に `id` を含め、ID変更時に自動再取得
- `updateEvent`: API呼び出し後にローカルステートを更新（`useUserProfile.updateProfile` と同一パターン）
- `deleteEvent`: API呼び出し後に `event` を `null` に設定（Q2の決定事項）
- API関数名と衝突するため、インポート時にエイリアス（`apiUpdateEvent` / `apiDeleteEvent`）を使用

**戻り値**:

| プロパティ | 型 | 説明 |
|---|---|---|
| `event` | `Event \| null` | イベントデータ（初期値: `null`） |
| `loading` | `boolean` | 取得中フラグ（初期値: `true`） |
| `error` | `Error \| null` | エラー情報（初期値: `null`） |
| `updateEvent` | `(data: Partial<Event>) => Promise<Event>` | イベント更新関数 |
| `deleteEvent` | `() => Promise<void>` | イベント削除関数 |

## 6. テスト設計

### 6.1 `useEvents.test.ts`（新規: `src/hooks/__tests__/useEvents.test.ts`）

既存 `useUserProfile.test.ts` のパターンに準拠。

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEvents } from '../useEvents';
import { getEvents } from '../../api/client';
import { Event } from '../../types/event';

jest.mock('../../api/client');

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;

const mockEvents: Event[] = [
  {
    id: 'event-1',
    title: 'テストイベント1',
    description: '説明文1',
    date: '2026-04-01T10:00:00Z',
    location: '東京',
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 'event-2',
    title: 'テストイベント2',
    date: '2026-05-01T10:00:00Z',
    createdAt: new Date('2026-02-01'),
  },
];
```

**テストケース**:

| # | テスト名 | テスト内容 |
|---|----------|-----------|
| 1 | イベント一覧を正常に取得できる | `mockGetEvents.mockResolvedValue(mockEvents)` → `renderHook` → `waitFor` で `loading: false` を待ち、`events` が `mockEvents` と一致することを確認 |
| 2 | APIエラー時にエラー状態が設定される | `mockGetEvents.mockRejectedValue(error)` → `waitFor` で `loading: false` を待ち、`error` が設定されていることを確認 |
| 3 | ローディング状態が正しく管理される | `renderHook` 直後に `loading: true`、`events: []` であることを確認 |
| 4 | `refetch` でデータを再取得できる | 初回取得後、`mockGetEvents` を新しいデータで再設定 → `act(() => result.current.refetch())` → `waitFor` で新しいデータが反映されることを確認 |

### 6.2 `useEvent.test.ts`（新規: `src/hooks/__tests__/useEvent.test.ts`）

既存 `useUserProfile.test.ts` の5テストケースパターンに準拠し、`deleteEvent` テストを追加。

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';
import { useEvent } from '../useEvent';
import {
  getEvent,
  updateEvent as apiUpdateEvent,
  deleteEvent as apiDeleteEvent,
} from '../../api/client';
import { Event } from '../../types/event';

jest.mock('../../api/client');

const mockGetEvent = getEvent as jest.MockedFunction<typeof getEvent>;
const mockUpdateEvent = apiUpdateEvent as jest.MockedFunction<typeof apiUpdateEvent>;
const mockDeleteEvent = apiDeleteEvent as jest.MockedFunction<typeof apiDeleteEvent>;

const mockEvent: Event = {
  id: 'event-1',
  title: 'テストイベント',
  description: '説明文',
  date: '2026-04-01T10:00:00Z',
  location: '東京',
  createdAt: new Date('2026-01-01'),
};
```

**テストケース**:

| # | テスト名 | テスト内容 | 準拠元 |
|---|----------|-----------|--------|
| 1 | イベントを正常に取得できる | `mockGetEvent.mockResolvedValue(mockEvent)` → 初回取得を確認 | `useUserProfile`: プロフィール正常取得 |
| 2 | APIエラー時にエラー状態が設定される | `mockGetEvent.mockRejectedValue(error)` → エラー状態を確認 | `useUserProfile`: APIエラー |
| 3 | `updateEvent` でイベントを更新できる | `mockUpdateEvent.mockResolvedValue(updatedEvent)` → `act` で更新 → ローカルステートが更新されることを確認 | `useUserProfile`: `updateProfile` 成功 |
| 4 | `updateEvent` 失敗時にエラーがスローされる | `mockUpdateEvent.mockRejectedValue(error)` → `rejects.toThrow` を確認 | `useUserProfile`: `updateProfile` 失敗 |
| 5 | IDが変更された場合に再取得する | `rerender({ id: 'event-2' })` → 新しいIDで `getEvent` が呼ばれることを確認 | `useUserProfile`: ID変更時再取得 |
| 6 | `deleteEvent` でイベントを削除できる | `mockDeleteEvent.mockResolvedValue(undefined)` → `act` で削除 → `event` が `null` になることを確認 | 新規（既存パターンにない） |
| 7 | `deleteEvent` 失敗時にエラーがスローされる | `mockDeleteEvent.mockRejectedValue(error)` → `rejects.toThrow` を確認 → `event` が変更されていないことを確認 | 新規（既存パターンにない） |

## 7. ファイル変更一覧

### 7.1 新規作成ファイル

| 順序 | ファイルパス | 種別 | 依存先 |
|------|-------------|------|--------|
| 1 | `src/hooks/useEvents.ts` | Hook | `src/types/event.ts`, `src/api/client.ts`（#39-1 で追加） |
| 2 | `src/hooks/useEvent.ts` | Hook | `src/types/event.ts`, `src/api/client.ts`（#39-1 で追加） |
| 3 | `src/hooks/__tests__/useEvents.test.ts` | テスト | `src/hooks/useEvents.ts` |
| 4 | `src/hooks/__tests__/useEvent.test.ts` | テスト | `src/hooks/useEvent.ts` |

### 7.2 変更なしのファイル

| ファイルパス | 理由 |
|-------------|------|
| `src/api/client.ts` | イベント用API関数は #39-1 で追加済みの想定。本Issueでは変更不要 |
| `src/types/event.ts` | Event型定義は #39-1 で追加済みの想定。本Issueでは変更不要 |
| `src/hooks/useUser.ts` | 変更不要 |
| `src/hooks/useUserProfile.ts` | 変更不要 |

## 8. 依存関係図

```
src/types/event.ts（#39-1 で追加済み）
src/api/client.ts（#39-1 でイベント用API関数追加済み）
  ↓
src/hooks/useEvents.ts（新規）  ── 順序 1
src/hooks/useEvent.ts（新規）   ── 順序 2
  ↓
src/hooks/__tests__/useEvents.test.ts（新規）  ── 順序 3
src/hooks/__tests__/useEvent.test.ts（新規）   ── 順序 4
```

- 順序 1 と 2 は互いに独立しているため並列実装可能
- 順序 3 と 4 は互いに独立しているため並列実装可能

## 9. 実装上の注意事項

### 9.1 命名規則

- API関数とフック内関数の名前衝突を避けるため、`useEvent` 内ではインポート時にエイリアスを使用する
  - `updateEvent as apiUpdateEvent`
  - `deleteEvent as apiDeleteEvent`

### 9.2 エラーハンドリング

- `useEffect` 内の取得処理: エラーを `catch` して `error` ステートに設定（既存パターン踏襲）
- `updateEvent` / `deleteEvent`: エラーをスローし、呼び出し元で `try/catch` によるハンドリングを可能にする（`useUserProfile.updateProfile` と同一方針）

### 9.3 状態リセット

- `useEvent`: `useEffect` 内で再取得前に `setError(null)` を呼び出し、前回のエラー状態をクリアする（`useUserProfile` パターン準拠）
- `useEvents`: 同様に `fetchEvents` 内で `setError(null)` をリセット

### 9.4 #39-1 の実装に合わせた調整

- #39-1 の実際の `Event` 型定義に応じて、テスト内のモックデータを調整する
- API関数のシグネチャ（引数・戻り値）が想定と異なる場合は、フックの実装を合わせる

## 10. 実装チェックリスト

- [ ] #39-1（Event型・APIクライアント関数の実装）が完了していることを確認
- [ ] `src/hooks/useEvents.ts` を新規作成
- [ ] `src/hooks/useEvent.ts` を新規作成
- [ ] `src/hooks/__tests__/useEvents.test.ts` を新規作成
- [ ] `src/hooks/__tests__/useEvent.test.ts` を新規作成
- [ ] テストがすべてパスする（`npm test`）
- [ ] 既存の `useUserProfile` と同等以上のテストカバレッジ
