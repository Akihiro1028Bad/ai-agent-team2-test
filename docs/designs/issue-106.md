# 設計書: Issue #106 通知設定のプレビュー機能追加

## 1. 概要

通知設定フォーム（`NotificationSettingsForm`）に、現在の設定でどのような通知が届くかをリアルタイムでプレビュー表示するセクションを追加する。

- 現在の設定に基づくプレビューメッセージ表示（例: 「メール通知: ON、即時配信」）
- 設定変更時にリアルタイムでプレビュー更新
- カスタムhook（`useNotificationPreview`）でプレビューロジックを分離
- テストの追加

### 1.1 背景

通知設定画面（Issue #57 で実装済み）では、ユーザーがメール通知・プッシュ通知の ON/OFF と通知頻度を設定できる。しかし、現在の設定がどのような通知体験になるかが直感的にわかりにくい。設定内容をリアルタイムにプレビュー表示することで、ユーザーの設定理解を向上させる。

### 1.2 スコープ

- **対象**: カスタムhook（`useNotificationPreview`）の新規作成、型定義の拡張（`NotificationPreview`）、既存コンポーネント（`NotificationSettingsForm.tsx`）への統合、テストの追加・修正
- **対象外**: 通知配信基盤、API変更（プレビューはフロントエンドのみの表示機能）

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | Issue種別 | feature-m（機能追加・小〜中規模） |
| 2 | 変更規模 | 5〜8ファイル程度 |
| 3 | プレビュー表示内容 | 各通知チャネルの ON/OFF 状態 + 通知頻度の組み合わせ |
| 4 | プレビュー更新タイミング | 設定変更時にリアルタイム更新（保存不要） |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **型定義** | `src/types/notification.ts` | `NotificationSettings`, `NotificationFrequency`, `FREQUENCY_LABELS` 定義済み | ⚠️ 変更（`NotificationPreview` 型を追加） |
| **コンポーネント** | `src/components/NotificationSettingsForm.tsx` | 通知設定フォーム実装済み | ⚠️ 変更（プレビューセクション追加） |
| **CSS** | `src/components/NotificationSettingsForm.module.css` | フォームスタイル実装済み | ⚠️ 変更（プレビューセクションのスタイル追加） |
| **テスト** | `src/components/__tests__/NotificationSettingsForm.test.tsx` | フォームのユニットテスト実装済み（13件） | ⚠️ 変更（プレビュー関連テスト追加） |
| **Hook** | `src/hooks/useNotificationSettings.ts` | 設定取得・更新ロジック | ✅ 変更なし |
| **ページ** | `app/settings/notifications/page.tsx` | 通知設定ページ | ✅ 変更なし |
| **APIクライアント** | `src/api/notificationClient.ts` | 通知設定API関数 | ✅ 変更なし |

### 2.2 既存の NotificationSettingsForm の構造

現在のフォームは以下の内部状態を管理している：

| 状態 | 型 | 説明 |
|------|-----|------|
| `emailEnabled` | `boolean` | メール通知 ON/OFF |
| `pushEnabled` | `boolean` | プッシュ通知 ON/OFF |
| `frequency` | `NotificationFrequency` | 通知頻度 |
| `isSaving` | `boolean` | 保存中フラグ |
| `saveError` | `string \| null` | 保存エラー |
| `saveSuccess` | `boolean` | 保存成功フラグ |

プレビュー機能は `emailEnabled`, `pushEnabled`, `frequency` の3つの状態からリアルタイムに生成する。

### 2.3 既存の FREQUENCY_LABELS

```typescript
export const FREQUENCY_LABELS: Record<NotificationFrequency, string> = {
  immediate: '即時',
  daily: '日次ダイジェスト',
  weekly: '週次ダイジェスト',
};
```

プレビューメッセージ生成時にこの定数を活用する。

## 3. 機能設計

### 3.1 プレビューセクションの UI

プレビューセクションは、フォームの設定項目（通知頻度）の下、エラー/成功メッセージ・保存ボタンの上に配置する。

```
┌──────────────────────────────────────────┐
│  通知設定                                 │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ メール通知                [Switch] │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ プッシュ通知              [Switch] │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 通知頻度         [Select: 即時 ▼] │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 通知プレビュー                     │  │  ← 新規追加
│  │                                    │  │
│  │  • メール通知: ON、即時配信        │  │
│  │  • プッシュ通知: ON、即時配信      │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  {エラー/成功メッセージ}                 │
│  [保存]                                  │
└──────────────────────────────────────────┘
```

### 3.2 プレビューメッセージの仕様

プレビューは `NotificationPreviewItem` の配列として生成し、各通知チャネルごとに1行のメッセージを表示する。

#### メッセージ生成ルール

| チャネル | 状態 | プレビューメッセージ |
|---------|------|---------------------|
| メール通知 | ON | `メール通知: ON、{頻度ラベル}配信` |
| メール通知 | OFF | `メール通知: OFF` |
| プッシュ通知 | ON | `プッシュ通知: ON、{頻度ラベル}配信` |
| プッシュ通知 | OFF | `プッシュ通知: OFF` |

- `{頻度ラベル}` は `FREQUENCY_LABELS` から取得（例: `即時`, `日次ダイジェスト`, `週次ダイジェスト`）
- 全通知 OFF の場合はサマリーメッセージ: `すべての通知がオフになっています`

#### プレビューメッセージ例

**設定: メール ON、プッシュ ON、頻度: 即時**
```
• メール通知: ON、即時配信
• プッシュ通知: ON、即時配信
```

**設定: メール ON、プッシュ OFF、頻度: 日次ダイジェスト**
```
• メール通知: ON、日次ダイジェスト配信
• プッシュ通知: OFF
```

**設定: メール OFF、プッシュ OFF**
```
すべての通知がオフになっています
```

### 3.3 リアルタイム更新

プレビューはフォームの内部状態（`emailEnabled`, `pushEnabled`, `frequency`）から `useMemo` で即座に算出する。保存操作は不要で、チェックボックスやセレクトの変更が直ちにプレビューに反映される。

## 4. 型定義

### 4.1 変更ファイル: `src/types/notification.ts`

既存の型定義に以下を追加する。

```typescript
/**
 * 通知プレビューの各項目
 */
export interface NotificationPreviewItem {
  /** チャネル名（例: "メール通知"） */
  channel: string;
  /** 有効/無効 */
  enabled: boolean;
  /** プレビューメッセージ（例: "メール通知: ON、即時配信"） */
  message: string;
}

/**
 * 通知プレビュー全体
 */
export interface NotificationPreview {
  /** 各チャネルのプレビュー */
  items: NotificationPreviewItem[];
  /** サマリーメッセージ（全通知OFF時に表示） */
  summary: string | null;
}
```

## 5. Hook 設計

### 5.1 新規Hook: `useNotificationPreview`

```
src/hooks/useNotificationPreview.ts ← 新規
```

**責務**: 通知設定の値からプレビュー表示用のデータを生成する。純粋な変換ロジックであり、API通信は行わない。

```typescript
import { useMemo } from 'react';
import {
  NotificationFrequency,
  NotificationPreview,
  NotificationPreviewItem,
  FREQUENCY_LABELS,
} from '../types/notification';

interface UseNotificationPreviewParams {
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: NotificationFrequency;
}

export function useNotificationPreview({
  emailEnabled,
  pushEnabled,
  frequency,
}: UseNotificationPreviewParams): NotificationPreview {
  return useMemo(() => {
    const frequencyLabel = FREQUENCY_LABELS[frequency];

    const items: NotificationPreviewItem[] = [
      {
        channel: 'メール通知',
        enabled: emailEnabled,
        message: emailEnabled
          ? `メール通知: ON、${frequencyLabel}配信`
          : 'メール通知: OFF',
      },
      {
        channel: 'プッシュ通知',
        enabled: pushEnabled,
        message: pushEnabled
          ? `プッシュ通知: ON、${frequencyLabel}配信`
          : 'プッシュ通知: OFF',
      },
    ];

    const allDisabled = !emailEnabled && !pushEnabled;
    const summary = allDisabled ? 'すべての通知がオフになっています' : null;

    return { items, summary };
  }, [emailEnabled, pushEnabled, frequency]);
}
```

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `emailEnabled` | `boolean` | メール通知の ON/OFF |
| `pushEnabled` | `boolean` | プッシュ通知の ON/OFF |
| `frequency` | `NotificationFrequency` | 通知頻度 |

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `items` | `NotificationPreviewItem[]` | 各チャネルのプレビュー情報 |
| `summary` | `string \| null` | 全通知 OFF 時のサマリーメッセージ |

**設計方針**:
- `useMemo` で入力値の変更時のみ再計算（パフォーマンス最適化）
- 純粋関数的なロジックで副作用なし
- `FREQUENCY_LABELS` 定数を再利用してラベル重複を回避

## 6. コンポーネント設計

### 6.1 変更: `NotificationSettingsForm.tsx`

既存フォームにプレビューセクションを追加する。

#### 変更概要

1. `useNotificationPreview` hook のインポート追加
2. hook 呼び出し追加
3. プレビューセクションの JSX 追加（通知頻度セクションの後、エラー/成功メッセージの前に配置）

#### 変更後のコンポーネント構造

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { NotificationSettings, NotificationFrequency, FREQUENCY_LABELS } from '../types/notification';
import { useNotificationPreview } from '../hooks/useNotificationPreview';
import styles from './NotificationSettingsForm.module.css';

// ... 既存の Props 定義（変更なし）

export const NotificationSettingsForm: React.FC<NotificationSettingsFormProps> = ({
  settings,
  onSave,
}) => {
  // ... 既存の状態管理（変更なし）

  // プレビュー hook の呼び出し（追加）
  const preview = useNotificationPreview({ emailEnabled, pushEnabled, frequency });

  // ... 既存の handleSubmit（変更なし）

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>通知設定</h2>

      {/* ... 既存のメール通知・プッシュ通知・通知頻度セクション（変更なし） */}

      {/* プレビューセクション（新規追加） */}
      <div className={styles.previewSection} data-testid="notification-preview">
        <h3 className={styles.previewTitle}>通知プレビュー</h3>
        {preview.summary ? (
          <p className={styles.previewSummary}>{preview.summary}</p>
        ) : (
          <ul className={styles.previewList}>
            {preview.items.map((item) => (
              <li key={item.channel} className={styles.previewItem}>
                {item.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ... 既存のエラー・成功メッセージ、保存ボタン（変更なし） */}
    </form>
  );
};
```

**Props の変更**: なし（既存のPropsインターフェースは変更不要）

### 6.2 変更: `NotificationSettingsForm.module.css`

プレビューセクション用のスタイルを追加する。

```css
/* === プレビューセクション（追加） === */

.previewSection {
  margin-top: 24px;
  padding: 16px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
}

.previewTitle {
  font-size: 14px;
  font-weight: bold;
  margin: 0 0 12px 0;
  color: #495057;
}

.previewList {
  list-style: disc;
  padding-left: 20px;
  margin: 0;
}

.previewItem {
  font-size: 13px;
  color: #495057;
  padding: 4px 0;
}

.previewSummary {
  font-size: 13px;
  color: #868e96;
  margin: 0;
  font-style: italic;
}
```

## 7. 状態管理

### 7.1 データフロー

```
フォーム内部状態 (emailEnabled, pushEnabled, frequency)
  ↓ （リアルタイム）
useNotificationPreview hook
  ↓ （useMemo で算出）
NotificationPreview { items, summary }
  ↓
プレビューセクション JSX 描画
```

### 7.2 状態一覧（追加分のみ）

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `preview` | `useNotificationPreview()` の返却値 | プレビューデータ（`useMemo` で算出、状態変数ではない） |

**重要**: プレビューは `useState` ではなく `useMemo` で算出するため、新たな状態変数は追加しない。既存のフォーム内部状態（`emailEnabled`, `pushEnabled`, `frequency`）の変更がそのままプレビュー更新をトリガーする。

## 8. ファイル変更一覧

### 8.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/hooks/useNotificationPreview.ts` | Hook | プレビューロジック |
| `src/hooks/__tests__/useNotificationPreview.test.ts` | テスト | Hook のユニットテスト |

### 8.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `src/types/notification.ts` | `NotificationPreviewItem`, `NotificationPreview` 型を追加 |
| `src/components/NotificationSettingsForm.tsx` | `useNotificationPreview` 呼び出し、プレビューセクション JSX 追加 |
| `src/components/NotificationSettingsForm.module.css` | プレビューセクションのスタイル追加 |
| `src/components/__tests__/NotificationSettingsForm.test.tsx` | プレビュー関連テストケース追加 |

### 8.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/hooks/useNotificationSettings.ts` | プレビューはフロントエンド表示のみ、設定取得・保存ロジックに変更不要 |
| `src/api/notificationClient.ts` | API通信に変更不要 |
| `app/api/notifications/settings/route.ts` | サーバー側の変更不要 |
| `app/settings/notifications/page.tsx` | ページコンポーネントに変更不要（プレビューはフォーム内で完結） |

## 9. テスト方針

### 9.1 テストツール・パターン

既存テスト（`NotificationSettingsForm.test.tsx` / `useNotificationSettings.test.ts`）のパターンに準拠する。

- **テストフレームワーク**: Jest + ts-jest
- **テスト環境**: jsdom
- **テストライブラリ**: `@testing-library/react` / `@testing-library/user-event`
- **Hook テスト**: `renderHook` を使用

### 9.2 `src/hooks/__tests__/useNotificationPreview.test.ts`（新規）

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 全通知 ON・即時の場合のプレビュー | メール通知・プッシュ通知ともに「ON、即時配信」メッセージが返ること |
| 2 | メール OFF・プッシュ ON の場合 | メール通知は「OFF」、プッシュ通知は「ON、{頻度}配信」が返ること |
| 3 | メール ON・プッシュ OFF の場合 | メール通知は「ON、{頻度}配信」、プッシュ通知は「OFF」が返ること |
| 4 | 全通知 OFF の場合 | `summary` に「すべての通知がオフになっています」が返ること |
| 5 | 頻度が daily の場合 | ラベルが「日次ダイジェスト配信」になること |
| 6 | 頻度が weekly の場合 | ラベルが「週次ダイジェスト配信」になること |
| 7 | パラメータ変更時に再計算されること | 入力値変更後に新しいプレビューが返ること |

### 9.3 `src/components/__tests__/NotificationSettingsForm.test.tsx`（追加テストケース）

既存テストに以下を追加する。

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | プレビューセクションが表示される | `data-testid="notification-preview"` が存在すること |
| 2 | 初期設定でプレビューメッセージが正しい | 「メール通知: ON、即時配信」「プッシュ通知: ON、即時配信」が表示されること |
| 3 | メール通知 OFF 時にプレビューが更新される | チェックボックスを OFF にすると「メール通知: OFF」に変わること |
| 4 | プッシュ通知 OFF 時にプレビューが更新される | チェックボックスを OFF にすると「プッシュ通知: OFF」に変わること |
| 5 | 通知頻度変更時にプレビューが更新される | 頻度を「daily」に変更すると「日次ダイジェスト配信」に変わること |
| 6 | 全通知 OFF 時にサマリーメッセージが表示される | 全チェックボックスを OFF にすると「すべての通知がオフになっています」が表示されること |

### 9.4 テスト実行コマンド

```bash
npm test
```

## 10. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `src/types/notification.ts` | 型定義 | 変更 | なし |
| 2 | `src/hooks/useNotificationPreview.ts` | Hook | 新規 | 順序1 |
| 3 | `src/components/NotificationSettingsForm.module.css` | スタイル | 変更 | なし |
| 4 | `src/components/NotificationSettingsForm.tsx` | コンポーネント | 変更 | 順序1, 2, 3 |
| 5 | `src/hooks/__tests__/useNotificationPreview.test.ts` | テスト | 新規 | 順序1, 2 |
| 6 | `src/components/__tests__/NotificationSettingsForm.test.tsx` | テスト | 変更 | 順序1-4 |

**並列実装可能なグループ**:
- 順序2 と 順序3 は互いに独立しているため並列実装可能
- 順序5 と 順序6 は互いに独立しているため並列実装可能

## 11. 依存関係図

```
src/types/notification.ts（変更: NotificationPreview 型追加）
  │
  ├─→ src/hooks/useNotificationPreview.ts（新規: プレビューロジック）
  │     │
  │     ├─→ src/components/NotificationSettingsForm.tsx（変更: プレビュー統合）
  │     │     │
  │     │     └─→ src/components/NotificationSettingsForm.module.css（変更: スタイル追加）
  │     │
  │     └─→ src/hooks/__tests__/useNotificationPreview.test.ts（新規: Hook テスト）
  │
  └─→ src/components/__tests__/NotificationSettingsForm.test.tsx（変更: テスト追加）
```

## 12. 実装上の注意事項

### 12.1 既存機能への影響最小化

- プレビューセクションは既存のフォーム要素と保存ボタンの間に挿入する
- 既存の状態管理やイベントハンドラには変更を加えない
- 既存テスト（13件）が引き続きパスすることを確認する

### 12.2 パフォーマンス

- `useMemo` を使用してプレビューの不要な再計算を防止する
- プレビューは純粋な計算のみで、API通信や副作用を伴わない

### 12.3 既存パターンとの一貫性

| 項目 | 既存パターン（参照元） | 新規追加での適用 |
|------|----------------------|-----------------|
| Hook | `useNotificationSettings.ts`: カスタムhookでロジック分離 | `useNotificationPreview.ts` で同パターン |
| 型定義 | `notification.ts`: 通知関連の型を集約 | 同ファイルに `NotificationPreview` 型を追加 |
| CSS | `NotificationSettingsForm.module.css`: CSS Modules | 同ファイルにプレビュー用スタイルを追加 |
| テスト | `NotificationSettingsForm.test.tsx`: `render` + `screen` + `userEvent` | 同パターンでプレビューテストを追加 |

### 12.4 アクセシビリティ

- プレビューセクションに `data-testid` を付与してテスタビリティを確保
- プレビューリストは `<ul>` + `<li>` でセマンティックにマークアップ
- 適切な見出し（`<h3>`）でセクションを区切る
