# 設計書: Issue #44 イベント新規登録画面の実装

## 1. 概要

イベントを新規登録するフォーム画面を実装する。`EventForm` コンポーネントは `initialData?` Props を持ち、編集画面（#39-6）で再利用可能な設計とする。

### 1.1 背景

親 Issue #39 のイベント管理機能の一環として、イベント新規登録画面を追加する。既存の `ProfileEditForm` コンポーネントのパターンを踏襲し、一貫性のあるフォーム実装を行う。

### 1.2 ゴール

- イベントを新規登録できるフォーム画面を `/events/new` に提供する
- `EventForm` コンポーネントを編集画面（#39-6）で再利用可能な設計にする
- バリデーションルールに基づいた入力チェックを実装する

### 1.3 依存関係

- **#39-1**: 型定義・API クライアント（`Event` 型、`CreateEventInput` 型、`createEvent` 関数が事前に定義されている前提）
- **並行作業可能**: #39-3, #39-4

## 2. 既存コードの分析

### 2.1 踏襲するパターン: `ProfileEditForm`

既存の `ProfileEditForm.tsx` を参考に、以下のパターンを踏襲する:

| パターン | 詳細 |
|----------|------|
| `'use client'` ディレクティブ | クライアントコンポーネントとして実装 |
| `useState` による各フィールドの状態管理 | 各入力フィールドに対応する state |
| `FormErrors` インターフェース | フィールド名をキーとするエラーオブジェクト |
| `validate()` 関数 | submit 時にバリデーションを実行し `FormErrors` を返す |
| `isSaving` / `saveError` 状態 | 保存中の UI 制御とエラーハンドリング |
| CSS Modules によるスタイリング | `*.module.css` ファイルによるスコープ付きスタイル |

### 2.2 既存の型定義（#39-1 で追加予定）

```typescript
// src/types/event.ts（#39-1 で作成される想定）
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

export interface CreateEventInput {
  title: string;
  description?: string;
  eventDate: string;
  location?: string;
  locationUrl?: string;
  organizer?: string;
}
```

### 2.3 既存の API 関数（#39-1 で追加予定）

```typescript
// src/api/client.ts に追加される想定
export async function createEvent(data: CreateEventInput): Promise<Event>;
```

## 3. URL 設計

| パス | 用途 | メソッド |
|------|------|----------|
| `/events/new` | イベント新規登録画面 | GET（画面表示） |
| `POST /api/events` | イベント作成 API（バックエンド） | POST |

### 3.1 画面遷移フロー

```
[イベント一覧 /events] → [新規登録 /events/new] → 保存成功 → [イベント一覧 /events]
                                                  → キャンセル → [イベント一覧 /events]（※ router.back() ではなく router.push）
```

## 4. コンポーネント設計

### 4.1 コンポーネント構成図

```
app/events/new/page.tsx              ← イベント新規登録ページ（新規）
app/events/new/__tests__/page.test.tsx ← ページテスト（新規）

src/components/
  EventForm.tsx                       ← イベント登録/編集フォーム（新規）
  EventForm.module.css                ← スタイル（新規）
  __tests__/EventForm.test.tsx        ← コンポーネントテスト（新規）
```

### 4.2 `EventForm` コンポーネント

#### Props インターフェース

```typescript
interface EventFormProps {
  onSave: (data: CreateEventInput) => Promise<void>;
  onCancel: () => void;
  initialData?: Event;  // 編集画面（#39-6）での再利用用
}
```

- `initialData` が渡された場合、各フィールドの初期値として使用する（編集モード）
- `initialData` が渡されない場合、全フィールドを空で初期化する（新規登録モード）
- フォームタイトルは `initialData` の有無で切り替え:「イベント新規登録」/「イベント編集」

#### FormErrors インターフェース

```typescript
interface FormErrors {
  title?: string;
  description?: string;
  eventDate?: string;
  location?: string;
  locationUrl?: string;
  organizer?: string;
}
```

#### State 一覧

| State 変数 | 型 | 初期値 | 説明 |
|-----------|-----|-------|------|
| `title` | `string` | `initialData?.title \|\| ''` | タイトル |
| `description` | `string` | `initialData?.description \|\| ''` | 説明 |
| `eventDate` | `string` | `initialData?.eventDate \|\| ''` | 開催日時（`datetime-local` 入力用） |
| `location` | `string` | `initialData?.location \|\| ''` | 場所 |
| `locationUrl` | `string` | `initialData?.locationUrl \|\| ''` | 場所URL |
| `organizer` | `string` | `initialData?.organizer \|\| ''` | 主催者 |
| `errors` | `FormErrors` | `{}` | バリデーションエラー |
| `isSaving` | `boolean` | `false` | 保存中フラグ |
| `saveError` | `string \| null` | `null` | 保存エラーメッセージ |

#### バリデーションルール（`validate()` 関数）

| フィールド | ルール | エラーメッセージ |
|-----------|--------|-----------------|
| タイトル (`title`) | 必須（空文字トリム後チェック） | `'タイトルは必須です'` |
| タイトル (`title`) | 最大100文字 | `'タイトルは100文字以内で入力してください'` |
| 説明 (`description`) | 最大1000文字 | `'説明は1000文字以内で入力してください'` |
| 開催日時 (`eventDate`) | 必須 | `'開催日時は必須です'` |
| 場所 (`location`) | 最大200文字 | `'場所は200文字以内で入力してください'` |
| 場所URL (`locationUrl`) | 任意。入力時は `https://` で始まること | `'URLは https:// で始めてください'` |
| 主催者 (`organizer`) | 最大100文字 | `'主催者は100文字以内で入力してください'` |

#### `validate()` 関数の実装方針

```typescript
const validate = (): FormErrors => {
  const newErrors: FormErrors = {};

  if (!title.trim()) {
    newErrors.title = 'タイトルは必須です';
  } else if (title.length > 100) {
    newErrors.title = 'タイトルは100文字以内で入力してください';
  }

  if (description.length > 1000) {
    newErrors.description = '説明は1000文字以内で入力してください';
  }

  if (!eventDate) {
    newErrors.eventDate = '開催日時は必須です';
  }

  if (location.length > 200) {
    newErrors.location = '場所は200文字以内で入力してください';
  }

  if (locationUrl && !locationUrl.startsWith('https://')) {
    newErrors.locationUrl = 'URLは https:// で始めてください';
  }

  if (organizer.length > 100) {
    newErrors.organizer = '主催者は100文字以内で入力してください';
  }

  return newErrors;
};
```

#### `handleSubmit` 関数の実装方針

`ProfileEditForm` と同パターン:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  const validationErrors = validate();
  setErrors(validationErrors);
  if (Object.keys(validationErrors).length > 0) return;

  setIsSaving(true);
  setSaveError(null);
  try {
    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      eventDate,
      location: location.trim() || undefined,
      locationUrl: locationUrl.trim() || undefined,
      organizer: organizer.trim() || undefined,
    });
  } catch (err) {
    setSaveError(
      err instanceof Error ? err.message : '保存に失敗しました'
    );
  } finally {
    setIsSaving(false);
  }
};
```

#### UI レイアウト

```
┌──────────────────────────────────────┐
│ イベント新規登録                        │ ← h2 タイトル（initialData 有無で切替）
│                                        │
│ タイトル *                              │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← input[type="text"], maxLength=100
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ 説明                                    │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← textarea, maxLength=1000
│ │                                    │ │
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ 開催日時 *                              │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← input[type="datetime-local"]
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ 場所                                    │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← input[type="text"], maxLength=200
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ 場所URL                                 │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← input[type="url"], placeholder="https://..."
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ 主催者                                   │
│ ┌──────────────────────────────────┐ │
│ │                                    │ │ ← input[type="text"], maxLength=100
│ └──────────────────────────────────┘ │
│ (エラーメッセージ)                       │
│                                        │
│ (保存エラーメッセージ)                    │
│                                        │
│  [保存]  [キャンセル]                    │
└──────────────────────────────────────┘
```

#### 入力フィールド HTML 属性一覧

| フィールド | id | type | maxLength | required (HTML) | placeholder |
|-----------|-----|------|-----------|-----------------|-------------|
| タイトル | `title` | `text` | `100` | - | - |
| 説明 | `description` | textarea | `1000` | - | - |
| 開催日時 | `eventDate` | `datetime-local` | - | - | - |
| 場所 | `location` | `text` | `200` | - | - |
| 場所URL | `locationUrl` | `url` | - | - | `https://example.com` |
| 主催者 | `organizer` | `text` | `100` | - | - |

> **注**: HTML の `required` 属性は使用せず、JavaScript 側の `validate()` 関数でバリデーションを制御する（`ProfileEditForm` と同パターン）。

### 4.3 `app/events/new/page.tsx`（イベント新規登録ページ）

```typescript
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { EventForm } from '../../../src/components/EventForm';
import { createEvent } from '../../../src/api/client';
import { CreateEventInput } from '../../../src/types/event';

export default function NewEventPage() {
  const router = useRouter();

  const handleSave = async (data: CreateEventInput) => {
    await createEvent(data);
    router.push('/events');
  };

  const handleCancel = () => {
    router.push('/events');
  };

  return (
    <EventForm
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
```

**ポイント**:
- `createEvent` API 呼び出しの成否は `EventForm` 内の `handleSubmit` で try-catch される
- 保存成功後 `router.push('/events')` でイベント一覧へ遷移
- キャンセル時も `router.push('/events')` でイベント一覧へ遷移

## 5. スタイル設計

### 5.1 `EventForm.module.css`

`ProfileEditForm.module.css` と同じスタイル構造を踏襲する:

| CSS クラス | 用途 | 対応する ProfileEditForm のクラス |
|-----------|------|--------------------------------|
| `.form` | フォーム全体のレイアウト（max-width: 600px, margin: 0 auto） | `.form` |
| `.title` | フォームタイトル | `.title` |
| `.field` | 各入力フィールドのラッパー | `.field` |
| `.fieldError` | バリデーションエラーメッセージ | `.fieldError` |
| `.actions` | ボタングループ | `.actions` |
| `.saveButton` | 保存ボタン | `.saveButton` |
| `.cancelButton` | キャンセルボタン | `.cancelButton` |
| `.errorMessage` | 保存エラーメッセージ | `.errorMessage` |

> 既存の `ProfileEditForm.module.css` と同一のスタイル定義を使用する。将来的に共通化する場合は別途リファクタリングする。

## 6. API 呼び出しフロー

```
[新規登録フロー]
  app/events/new/page.tsx
    → EventForm (onSave)
      → createEvent(data)
        → POST /api/events
          → 成功: router.push('/events')
          → 失敗: saveError 表示（フォーム維持）
```

## 7. 状態管理

### 7.1 画面の状態遷移

```
[/events/new ページ]
  フォーム表示（空フォーム） → 入力 → 送信
    → バリデーションエラー → フォーム表示（エラー付き）
    → 保存中（isSaving=true） → 保存成功 → /events へ遷移
                               → 保存失敗 → フォーム表示（saveError 付き）
```

### 7.2 状態一覧

| 状態 | 管理場所 | 説明 |
|------|---------|------|
| 各フィールド値 | `EventForm` | `useState` で各フィールドの入力値を管理 |
| `errors` | `EventForm` | バリデーションエラー |
| `isSaving` | `EventForm` | 保存処理中フラグ |
| `saveError` | `EventForm` | API 保存エラーメッセージ |

## 8. ファイル変更一覧

### 8.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/components/EventForm.tsx` | コンポーネント | イベント登録/編集フォーム |
| `src/components/EventForm.module.css` | スタイル | フォームのスタイル |
| `app/events/new/page.tsx` | ページ | イベント新規登録ページ |
| `src/components/__tests__/EventForm.test.tsx` | テスト | EventForm のユニットテスト |
| `app/events/new/__tests__/page.test.tsx` | テスト | NewEventPage のユニットテスト |

### 8.2 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/event.ts` | #39-1 で作成済みの想定。本 Issue では変更不要 |
| `src/api/client.ts` | #39-1 で `createEvent` が追加済みの想定。本 Issue では変更不要 |

## 9. テスト設計

### 9.1 `EventForm.test.tsx`

`ProfileEditForm.test.tsx` のテストパターンを踏襲する。

| # | テストケース | 検証内容 |
|---|-------------|---------|
| 1 | 新規登録時にフォームが空で表示される | `initialData` なしの場合、全フィールドが空 |
| 2 | initialData がある場合に初期値が表示される | 編集モードでの初期値表示 |
| 3 | タイトルが空の場合にバリデーションエラーが表示される | `'タイトルは必須です'` が表示、`onSave` 未呼出 |
| 4 | タイトルが100文字超の場合にバリデーションエラーが表示される | `'タイトルは100文字以内で入力してください'` が表示 |
| 5 | 説明が1000文字超の場合にバリデーションエラーが表示される | `'説明は1000文字以内で入力してください'` が表示 |
| 6 | 開催日時が空の場合にバリデーションエラーが表示される | `'開催日時は必須です'` が表示 |
| 7 | 場所が200文字超の場合にバリデーションエラーが表示される | `'場所は200文字以内で入力してください'` が表示 |
| 8 | 場所URLが `https://` で始まらない場合にバリデーションエラーが表示される | `'URLは https:// で始めてください'` が表示 |
| 9 | 主催者が100文字超の場合にバリデーションエラーが表示される | `'主催者は100文字以内で入力してください'` が表示 |
| 10 | 正しい値で保存ボタンを押すと onSave が呼ばれる | `onSave` が `CreateEventInput` 形式で呼出 |
| 11 | 保存失敗時にエラーメッセージが表示される | `saveError` が表示される |
| 12 | キャンセルボタンで onCancel が呼ばれる | `onCancel` が 1 回呼出 |
| 13 | 保存中はボタンが無効化される | `isSaving` 中に保存/キャンセルボタンが `disabled` |
| 14 | initialData がある場合にフォームタイトルが「イベント編集」になる | 編集モードのタイトル表示確認 |

#### テストのモックデータ

```typescript
const mockEvent: Event = {
  id: 'event-1',
  title: 'テストイベント',
  description: 'イベントの説明です',
  eventDate: '2025-06-15T10:00',
  location: '東京都渋谷区',
  locationUrl: 'https://example.com/venue',
  organizer: 'テスト主催者',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};
```

### 9.2 `app/events/new/__tests__/page.test.tsx`

| # | テストケース | 検証内容 |
|---|-------------|---------|
| 1 | フォームが表示される | `EventForm` が正しくレンダリングされる |
| 2 | 保存成功後にイベント一覧へ遷移する | `createEvent` 呼出後、`router.push('/events')` が呼ばれる |
| 3 | 保存失敗時にフォームが維持される | `createEvent` が reject してもページ遷移しない |
| 4 | キャンセルでイベント一覧へ遷移する | キャンセルボタン押下で `router.push('/events')` が呼ばれる |

#### モック設定

```typescript
// next/navigation のモック
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// API クライアントのモック
jest.mock('../../../../src/api/client');
```

## 10. 実装上の注意事項

### 10.1 編集画面（#39-6）での再利用

- `EventForm` は `initialData` の有無で新規/編集を切り替える設計
- 編集画面では以下のように使用する想定:

```typescript
// app/events/[id]/edit/page.tsx（#39-6 で実装予定）
<EventForm
  initialData={event}
  onSave={handleUpdate}
  onCancel={handleCancel}
/>
```

### 10.2 日時入力について

- `datetime-local` タイプの input を使用する
- ブラウザネイティブの日時ピッカーを活用する
- `eventDate` は ISO 8601 形式の文字列として管理する（`2025-06-15T10:00` 形式）

### 10.3 UI テキストの日本語統一

すべての UI テキストは日本語で統一する:

| 要素 | テキスト |
|------|---------|
| フォームタイトル（新規） | `イベント新規登録` |
| フォームタイトル（編集） | `イベント編集` |
| ラベル | `タイトル *`, `説明`, `開催日時 *`, `場所`, `場所URL`, `主催者` |
| 保存ボタン | `保存` / `保存中...` |
| キャンセルボタン | `キャンセル` |
| 保存失敗メッセージ | `保存に失敗しました` |

### 10.4 エラーハンドリング

- バリデーションエラーは各フィールドの直下に赤文字で表示
- API 保存エラーはフォーム下部にエラーメッセージボックスとして表示
- エラー発生時もフォームの入力内容は維持する

## 11. 実装順序

1. **`src/components/EventForm.tsx`** — フォームコンポーネント
2. **`src/components/EventForm.module.css`** — スタイル
3. **`app/events/new/page.tsx`** — 新規登録ページ
4. **`src/components/__tests__/EventForm.test.tsx`** — EventForm テスト
5. **`app/events/new/__tests__/page.test.tsx`** — ページテスト
