# 設計書: Issue #121 型定義・モックデータの整備

## 1. 概要

レビュー機能全体の土台となる型定義（`Product`・`Review`）とモック商品データを整備する。

- `Product` 型: 商品の基本情報（id, name, price, description）
- `Review` 型: レビュー情報（id, productId, nickname, rating, comment, createdAt）
- モック商品データ: 開発・テスト用の商品データ 3〜5 件

### 1.1 背景

Issue #118 のレビュー機能実装にあたり、後続の子 Issue（#118-2, #118-3, #118-4）すべてが共通して利用する型定義とモックデータが必要である。起点となる本 Issue を最初に完了させることで、後続 Issue が安定したインターフェースに依存できる状態を作る。

### 1.2 スコープ

- **対象**: `src/types/product.ts`, `src/types/review.ts`, `src/data/products.ts` の新規作成
- **対象外**: コンポーネント実装・API クライアント・テストコード・既存ファイルの変更

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | Issue 種別 | `type:feature-m`（新規ファイル 3 件、小〜中規模の機能追加） |
| 2 | 対象ファイル数 | 3 件（1〜10 ファイルの範囲内） |
| 3 | テストコード | 本 Issue のスコープ外（後続 Issue で対応） |

## 2. 既存コードの分析

### 2.1 現在の型定義ファイル構成

| ファイル | 内容 |
|---------|------|
| `src/types/user.ts` | `User` インターフェース・`UserProfile` インターフェース |
| `src/types/notification.ts` | `NotificationFrequency` 型・`NotificationSettings` インターフェース・定数 |
| `src/types/css-modules.d.ts` | CSS Modules の型宣言 |

### 2.2 既存の型定義パターン

```typescript
// 既存パターン（src/types/user.ts）
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: Date | string;
}

export interface UserProfile extends User {
  bio?: string;
  location?: string;
  website?: string;
}
```

```typescript
// 既存パターン（src/types/notification.ts）
export type NotificationFrequency = 'immediate' | 'daily' | 'weekly';

export interface NotificationSettings {
  emailEnabled: boolean;
  pushEnabled: boolean;
  frequency: NotificationFrequency;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  pushEnabled: true,
  frequency: 'immediate',
};
```

### 2.3 データディレクトリの状況

現在 `src/data/` ディレクトリは存在しない。本 Issue で新規作成する。

## 3. 型定義設計

### 3.1 `Product` 型（`src/types/product.ts`）

**責務**: 商品の基本情報を表す型

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | `string` | ✅ | 商品の一意識別子 |
| `name` | `string` | ✅ | 商品名 |
| `price` | `number` | ✅ | 商品価格（円単位） |
| `description` | `string` | ✅ | 商品説明 |

**型定義**:

```typescript
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}
```

### 3.2 `Review` 型（`src/types/review.ts`）

**責務**: 商品レビューの情報を表す型

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | `string` | ✅ | レビューの一意識別子 |
| `productId` | `string` | ✅ | レビュー対象の商品 ID（`Product.id` に対応） |
| `nickname` | `string` | ✅ | 投稿者のニックネーム |
| `rating` | `number` | ✅ | 評価（1〜5 の整数） |
| `comment` | `string` | ✅ | レビューコメント |
| `createdAt` | `string` | ✅ | 投稿日時（ISO 8601 形式の文字列） |

**型定義**:

```typescript
export interface Review {
  id: string;
  productId: string;
  nickname: string;
  rating: number;
  comment: string;
  createdAt: string;
}
```

**設計上の注意事項**:

- `rating` は 1〜5 の整数を想定するが、TypeScript の型レベルでは `number` とする（バリデーションは利用側で行う）
- `createdAt` は既存の `User.createdAt` が `Date | string` であるのに対し、モックデータとの親和性を考慮して `string`（ISO 8601）で統一する

## 4. モックデータ設計

### 4.1 `products` モックデータ（`src/data/products.ts`）

**責務**: 開発・テスト用の商品データを提供する

**データ件数**: 5 件（多様なユースケースをカバーできる最小限の件数）

**データ構造**:

```typescript
import { Product } from '../types/product';

export const products: Product[] = [
  {
    id: 'product-1',
    name: 'ワイヤレスイヤホン Pro',
    price: 12800,
    description:
      '高音質ノイズキャンセリング搭載のワイヤレスイヤホン。最大30時間再生可能。',
  },
  {
    id: 'product-2',
    name: 'メカニカルキーボード',
    price: 8500,
    description:
      'Cherry MX 赤軸採用の静音メカニカルキーボード。テンキーレスコンパクト設計。',
  },
  {
    id: 'product-3',
    name: 'ポータブル充電器 20000mAh',
    price: 4980,
    description:
      '大容量 20000mAh のモバイルバッテリー。USB-C PD 65W 対応でノートPCも充電可能。',
  },
  {
    id: 'product-4',
    name: 'スマートウォッチ Lite',
    price: 19800,
    description:
      '健康管理・通知確認が可能なスマートウォッチ。防水IPX5対応、最大7日間バッテリー持続。',
  },
  {
    id: 'product-5',
    name: 'USBハブ 7ポート',
    price: 3200,
    description:
      'USB-A × 4、USB-C × 2、SD カードスロット × 1 を備えた 7 ポートUSBハブ。',
  },
];
```

**データ設計方針**:

- `id` は `product-{連番}` 形式で統一し、可読性と一意性を確保する
- 商品ジャンルは電子機器・周辺機器で統一し、現実感のあるデータにする
- `price` は日本円（整数）で設定する
- `description` は 1〜2 文程度の自然な説明文にする

## 5. ファイル変更一覧

### 5.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/types/product.ts` | 型定義 | `Product` インターフェース |
| `src/types/review.ts` | 型定義 | `Review` インターフェース |
| `src/data/products.ts` | モックデータ | `Product[]` 型の商品データ 5 件 |

### 5.2 変更ファイル

なし（本 Issue で既存ファイルの変更は行わない）

### 5.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | スコープ外 |
| `src/types/notification.ts` | スコープ外 |
| `src/types/css-modules.d.ts` | スコープ外 |
| `src/api/` 配下 | スコープ外（後続 Issue で実装） |
| `src/components/` 配下 | スコープ外（後続 Issue で実装） |
| `src/hooks/` 配下 | スコープ外（後続 Issue で実装） |
| `app/` 配下 | スコープ外（後続 Issue で実装） |

## 6. 依存関係

### 6.1 本 Issue の依存関係

```
【前提】なし（起点）
    ↓
src/types/product.ts（新規: Product 型定義）
src/types/review.ts（新規: Review 型定義）
    ↓（import）
src/data/products.ts（新規: モック商品データ）
    ↓（依存）
#118-2, #118-3, #118-4（後続 Issue すべて）
```

### 6.2 後続 Issue への提供インターフェース

| 提供物 | 利用想定 |
|--------|----------|
| `Product` 型（`src/types/product.ts`） | 商品一覧表示・商品詳細・レビュー投稿フォームの型として利用 |
| `Review` 型（`src/types/review.ts`） | レビュー一覧表示・レビュー投稿フォームの型として利用 |
| `products` データ（`src/data/products.ts`） | 商品一覧・商品詳細ページでのモックデータとして利用 |

## 7. 実装上の注意事項

### 7.1 型定義の命名規則

既存の型定義ファイル（`src/types/user.ts`, `src/types/notification.ts`）に合わせ、以下の規則を遵守する。

- `interface` を使用する（`type` エイリアスではなく）
- `export` でエクスポートする
- ファイル名は型名を小文字にしたケバブケース（例: `product.ts`, `review.ts`）

### 7.2 `createdAt` の型選択根拠

`Review.createdAt` を `string`（ISO 8601）とした理由:
- モックデータでは `"2024-01-15T10:30:00.000Z"` のような文字列で記述するため、`Date` 型より扱いやすい
- 既存の `User.createdAt` が `Date | string` というユニオン型であるのに対し、シンプルに `string` で統一することで一貫性を持たせる

### 7.3 `src/data/` ディレクトリの新規作成

現在 `src/data/` ディレクトリは存在しないため、`src/data/products.ts` ファイルを作成する際にディレクトリも合わせて新規作成する。

## 8. 実装順序

| 順序 | ファイル | 種別 | 依存先 |
|------|----------|------|--------|
| 1 | `src/types/product.ts` | 型定義 | なし |
| 2 | `src/types/review.ts` | 型定義 | なし |
| 3 | `src/data/products.ts` | モックデータ | 順序 1（`Product` 型） |

**並列実装可能なグループ**:
- 順序 1（`product.ts`）と 順序 2（`review.ts`）は互いに独立しているため並列実装可能
