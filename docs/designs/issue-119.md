# 設計書: Issue #119 ダークモード切り替えボタンの追加

## 1. 概要

ヘッダーコンポーネントを新規作成し、その右上にダークモード/ライトモードを切り替えるトグルボタンを配置する。

- ヘッダー右上にトグルボタンを配置
- クリックでダーク/ライトモードを切り替え
- ユーザーの選択を `localStorage` に保存し、次回訪問時に復元
- CSS Modules でスタイリング（Tailwind CSS は使用しない）

### 1.1 背景

現在のアプリケーションにはヘッダーが存在せず、ダークモード機能も未実装である。ユーザーが好みに合わせて表示モードを切り替えられるようにするため、ヘッダーコンポーネントとダークモード切り替え機能を新規追加する。

### 1.2 スコープ

- **対象**: フロントエンド（Next.js/TypeScript）— ヘッダーコンポーネント、ダークモードトグルコンポーネント、カスタムフック、`app/layout.tsx` の修正
- **対象外**: E2E テスト（`[e2e-test]` プレフィックスはタイトルのみ、実装は通常のユニットテストのみ）
- **スタイル**: CSS Modules（`*.module.css`）で実装、Tailwind CSS は使用しない

### 1.3 ヒアリング結果サマリ

| # | 項目 | 決定事項 |
|---|------|----------|
| 1 | スタイリング方法 | CSS Modules（`*.module.css`）で実装、Tailwind CSS は不要 |
| 2 | E2E テスト | スコープ外。通常のユニットテストのみ |
| 3 | ヘッダーの扱い | `src/components/Header.tsx` として新規作成し、`app/layout.tsx` に組み込む |
| 4 | ダークモード切り替えボタンの配置 | ヘッダーコンポーネント内の右上 |
| 5 | 状態永続化 | `localStorage` に保存し、次回訪問時に復元 |

## 2. 既存コードの分析

### 2.1 現在の実装状況

| 区分 | ファイル | 状況 | 変更要否 |
|------|----------|------|----------|
| **レイアウト** | `app/layout.tsx` | ヘッダーなし、`<body>{children}</body>` のみ | ⚠️ 変更（Header コンポーネントを追加） |
| **コンポーネント** | `src/components/` | ユーザー関連コンポーネントのみ | ✅ 変更なし（新規ファイルを追加） |
| **Hook** | `src/hooks/` | ユーザー・通知設定関連のみ | ✅ 変更なし（新規ファイルを追加） |
| **型定義** | `src/types/` | `user.ts`, `notification.ts` のみ | ✅ 変更なし |

### 2.2 既存のコンポーネントパターン

```typescript
// 既存パターン（src/components/ProfileEditForm.tsx）
'use client';

import React, { useState } from 'react';
import styles from './ProfileEditForm.module.css';

export const ProfileEditForm: React.FC<Props> = ({ ... }) => {
  const [state, setState] = useState(...);
  // ...
  return <div className={styles.container}>...</div>;
};
```

### 2.3 既存のHookパターン

```typescript
// 既存パターン（src/hooks/useNotificationSettings.ts）
import { useState, useEffect } from 'react';

export function useNotificationSettings() {
  const [settings, setSettings] = useState(DEFAULT_VALUE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初期化処理
  }, []);

  return { settings, loading, ... };
}
```

### 2.4 既存のCSSモジュールパターン

```css
/* 既存パターン（src/components/ProfileEditForm.module.css） */
.form {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
}

.saveButton {
  padding: 8px 24px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
```

## 3. 機能設計

### 3.1 ダークモードの仕様

#### モード切り替え方式

`<html>` 要素に `data-theme="dark"` / `data-theme="light"` 属性を付与することでテーマを切り替える。CSS 変数（カスタムプロパティ）を使用して色を管理する。

```
[data-theme="light"] {
  --bg-color: #ffffff;
  --text-color: #333333;
  --header-bg: #f8f9fa;
  --border-color: #dddddd;
}

[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --header-bg: #16213e;
  --border-color: #444444;
}
```

#### localStorage の保存キー

```
localStorage.getItem('theme')   // 'dark' | 'light'
localStorage.setItem('theme', 'dark')
```

#### 初期値の決定ロジック

```
1. localStorage に保存済みの値がある → その値を使用
2. localStorage に値がない → システムの設定（prefers-color-scheme）を参照
3. システム設定も取得できない → 'light' をデフォルトとする
```

### 3.2 UI構成

#### ヘッダーレイアウト

```
┌─────────────────────────────────────────────────────┐
│  [アプリ名 or ロゴ]               [🌙 / ☀️ トグル] │
└─────────────────────────────────────────────────────┘
```

#### ダークモードトグルボタン

```
ライトモード時: [🌙 ダークモード] → クリックでダークモードに切り替え
ダークモード時: [☀️ ライトモード] → クリックでライトモードに切り替え
```

### 3.3 ユーザー操作フロー

```
[初回訪問 / ページ読み込み]
  ↓
[useDarkMode フックが localStorage を読み込み]
  ↓
  ├─ 保存済みテーマあり → 保存済みのテーマを適用
  └─ 保存済みテーマなし → OS設定 or 'light' を適用
  ↓
[ヘッダーのトグルボタンを表示]
  ↓
[ユーザーがトグルボタンをクリック]
  ↓
[テーマを切り替え（light ↔ dark）]
  ↓
[html 要素の data-theme 属性を更新]
  ↓
[localStorage に新しいテーマを保存]
  ↓
[画面全体のカラーテーマが切り替わる]
```

## 4. Hook設計

### 4.1 新規Hook: `useDarkMode`

```
src/hooks/useDarkMode.ts ← 新規
```

**責務**: ダークモードの状態管理・localStorage への永続化・`<html>` 要素への適用

**シグネチャ**:

```typescript
export function useDarkMode(): {
  isDark: boolean;
  toggle: () => void;
}
```

**返却値**:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `isDark` | `boolean` | 現在ダークモードかどうか |
| `toggle` | `() => void` | テーマを切り替える関数 |

**実装詳細**:

```typescript
'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'theme';

function getInitialTheme(): boolean {
  // サーバーサイドレンダリング時は false を返す
  if (typeof window === 'undefined') return false;

  // localStorage から保存済みテーマを取得
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') return true;
  if (saved === 'light') return false;

  // localStorage に値がない場合は OS の設定を参照
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    // クライアントサイドでのみ初期値を設定
    setIsDark(getInitialTheme());
  }, []);

  useEffect(() => {
    // data-theme 属性の更新と localStorage への保存
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle };
}
```

**注意事項**: SSR（サーバーサイドレンダリング）対応のため、`typeof window === 'undefined'` を確認してから `localStorage` や `window.matchMedia` にアクセスする。

## 5. コンポーネント設計

### 5.1 新規コンポーネント: `DarkModeToggle`

```
src/components/DarkModeToggle.tsx        ← 新規
src/components/DarkModeToggle.module.css ← 新規
```

**責務**: ダークモード切り替えボタンの表示と操作

**Props**:

```typescript
interface DarkModeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}
```

**UIコンポーネント構成**:

```typescript
<button
  className={styles.toggleButton}
  onClick={onToggle}
  aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
  title={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
>
  <span className={styles.icon}>{isDark ? '☀️' : '🌙'}</span>
  <span className={styles.label}>{isDark ? 'ライトモード' : 'ダークモード'}</span>
</button>
```

**CSSクラス一覧** (`DarkModeToggle.module.css`):

| クラス名 | 説明 |
|---------|------|
| `.toggleButton` | トグルボタン全体のスタイル（背景・ボーダー・カーソル） |
| `.icon` | アイコン（絵文字）のスタイル |
| `.label` | ボタンラベルのスタイル（モバイル時は非表示） |

**アクセシビリティ**:
- `aria-label` にモード切り替えの説明を設定する
- キーボード操作（Enter / Space キー）でクリックと同じ動作をする（`<button>` 要素なので自動対応）

### 5.2 新規コンポーネント: `Header`

```
src/components/Header.tsx        ← 新規
src/components/Header.module.css ← 新規
```

**責務**: アプリ全体のヘッダーUI。`useDarkMode` フックを利用し `DarkModeToggle` を右上に配置する。

**Props**: なし（ヘッダーは独立したコンポーネントで、状態は内部の `useDarkMode` フックで管理）

**UIコンポーネント構成**:

```typescript
'use client';

import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { DarkModeToggle } from './DarkModeToggle';
import styles from './Header.module.css';

export const Header: React.FC = () => {
  const { isDark, toggle } = useDarkMode();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>Sample App</div>
        <div className={styles.actions}>
          <DarkModeToggle isDark={isDark} onToggle={toggle} />
        </div>
      </div>
    </header>
  );
};
```

**CSSクラス一覧** (`Header.module.css`):

| クラス名 | 説明 |
|---------|------|
| `.header` | ヘッダー要素のスタイル（背景色は CSS 変数 `var(--header-bg)` を使用） |
| `.inner` | 内部コンテナ（最大幅・padding・flexbox で左右配置） |
| `.logo` | アプリ名/ロゴのスタイル |
| `.actions` | 右側のアクションエリア（DarkModeToggle を含む） |

## 6. レイアウト変更設計

### 6.1 変更ファイル: `app/layout.tsx`

`Header` コンポーネントを `<body>` 内の先頭に追加する。

```typescript
// 変更前
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

// 変更後
import React from 'react';
import { Header } from '../src/components/Header';

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
        <Header />
        {children}
      </body>
    </html>
  );
}
```

**注意事項**: `Header` コンポーネント内で `'use client'` を使用するため、`app/layout.tsx` 自体は Server Component のままで問題ない。

## 7. CSS変数設計

### 7.1 グローバルCSSへの追加

ダークモード対応のために `app/globals.css`（または `app/layout.tsx` に `<style>` タグ）に CSS 変数を定義する。

既存のグローバル CSS ファイルがない場合は新規作成する。

```css
/* app/globals.css ← 新規作成 or 既存に追記 */

/* ライトモード（デフォルト）*/
:root,
[data-theme="light"] {
  --bg-color: #ffffff;
  --text-color: #333333;
  --header-bg: #f8f9fa;
  --header-border: #eeeeee;
  --border-color: #dddddd;
  --button-bg: #f0f0f0;
  --button-color: #333333;
  --button-hover-bg: #e0e0e0;
}

/* ダークモード */
[data-theme="dark"] {
  --bg-color: #1a1a2e;
  --text-color: #e0e0e0;
  --header-bg: #16213e;
  --header-border: #2a2a4a;
  --border-color: #444444;
  --button-bg: #2a2a4a;
  --button-color: #e0e0e0;
  --button-hover-bg: #3a3a5a;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

## 8. 状態管理

### 8.1 状態一覧

| 状態 | 管理場所 | 説明 |
|------|----------|------|
| `isDark` | `useDarkMode()` | 現在のテーマ（ダーク: true / ライト: false） |

### 8.2 コンポーネント間のデータフロー

```
useDarkMode（フック）
  ├─ isDark, toggle を返す
  └─ Header（コンポーネント）
       └─ DarkModeToggle（コンポーネント）
            ├─ Props: isDark, onToggle
            └─ クリック → onToggle() → toggle() → isDark 更新
                                                  → useEffect → data-theme 更新
                                                              → localStorage 保存
```

### 8.3 SSR対応

Next.js の SSR では `localStorage` や `window` にアクセスできないため、以下の対策を取る。

- `useDarkMode` フック内で `typeof window === 'undefined'` をチェック
- `useEffect` 内でのみ `localStorage` / `window.matchMedia` にアクセスする
- 初期値は `false`（ライトモード）に設定し、クライアントサイドで `useEffect` が実行された後に正しい値を設定する

## 9. ファイル変更一覧

### 9.1 新規作成ファイル

| ファイルパス | 種別 | 説明 |
|-------------|------|------|
| `src/hooks/useDarkMode.ts` | Hook | ダークモードの状態管理・localStorage 永続化 |
| `src/components/DarkModeToggle.tsx` | コンポーネント | ダークモード切り替えトグルボタン |
| `src/components/DarkModeToggle.module.css` | スタイル | DarkModeToggle のスタイル |
| `src/components/Header.tsx` | コンポーネント | ヘッダーコンポーネント |
| `src/components/Header.module.css` | スタイル | Header のスタイル |
| `app/globals.css` | グローバルCSS | CSS変数（ライト/ダークテーマ）の定義 |
| `src/hooks/__tests__/useDarkMode.test.ts` | テスト | useDarkMode のユニットテスト |
| `src/components/__tests__/DarkModeToggle.test.tsx` | テスト | DarkModeToggle のユニットテスト |
| `src/components/__tests__/Header.test.tsx` | テスト | Header のユニットテスト |

### 9.2 変更ファイル

| ファイルパス | 変更内容 |
|-------------|----------|
| `app/layout.tsx` | `Header` コンポーネントのインポートと `<body>` 内への配置 |

### 9.3 変更なし

| ファイルパス | 理由 |
|-------------|------|
| `src/types/user.ts` | スコープ外 |
| `src/types/notification.ts` | スコープ外 |
| `src/api/client.ts` | スコープ外 |
| `src/api/notificationClient.ts` | スコープ外 |
| `src/hooks/useUserProfile.ts` | スコープ外 |
| `src/hooks/useNotificationSettings.ts` | スコープ外 |
| `src/components/UserCard.tsx` | スコープ外 |
| `src/components/UserProfileView.tsx` | スコープ外 |
| `src/components/ProfileEditForm.tsx` | スコープ外 |
| `src/components/NotificationSettingsForm.tsx` | スコープ外 |
| `app/profile/page.tsx` | スコープ外 |
| `app/settings/notifications/page.tsx` | スコープ外 |

## 10. テスト方針

### 10.1 ユニットテスト

| テスト対象 | テストファイル | テスト内容 |
|-----------|---------------|-----------|
| `useDarkMode` | `src/hooks/__tests__/useDarkMode.test.ts` | 初期値 / localStorage 読み込み / テーマ切り替え / localStorage 保存 / data-theme 属性更新 / OS設定参照 |
| `DarkModeToggle` | `src/components/__tests__/DarkModeToggle.test.tsx` | ライトモード時の表示 / ダークモード時の表示 / クリック時に onToggle が呼ばれること / aria-label の確認 |
| `Header` | `src/components/__tests__/Header.test.tsx` | ヘッダーが表示されること / DarkModeToggle が含まれること |

### 10.2 テストケース詳細

#### `useDarkMode.test.ts`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | 初期値（localStorage なし、OS設定なし） | `isDark` が `false` であること |
| 2 | localStorage に 'dark' が保存されている場合 | `isDark` が `true` であること |
| 3 | localStorage に 'light' が保存されている場合 | `isDark` が `false` であること |
| 4 | OS設定がダークモードの場合（localStorage なし） | `isDark` が `true` であること |
| 5 | `toggle` を呼び出した場合 | `isDark` が反転すること |
| 6 | `toggle` 後に localStorage に保存されること | `localStorage.setItem` が正しいキー・値で呼ばれること |
| 7 | `toggle` 後に `data-theme` 属性が更新されること | `document.documentElement.getAttribute('data-theme')` が正しい値になること |

#### `DarkModeToggle.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ライトモード時のボタン表示 | 🌙 アイコンと「ダークモード」ラベルが表示されること |
| 2 | ダークモード時のボタン表示 | ☀️ アイコンと「ライトモード」ラベルが表示されること |
| 3 | ライトモード時の aria-label | `aria-label` が「ダークモードに切り替え」であること |
| 4 | ダークモード時の aria-label | `aria-label` が「ライトモードに切り替え」であること |
| 5 | クリック時の動作 | `onToggle` が1回呼ばれること |

#### `Header.test.tsx`

| # | テストケース | 確認内容 |
|---|-------------|----------|
| 1 | ヘッダーのレンダリング | `<header>` 要素が表示されること |
| 2 | アプリ名の表示 | 「Sample App」が表示されること |
| 3 | DarkModeToggle の存在 | トグルボタンが含まれること |

## 11. 実装上の注意事項

### 11.1 SSR / ハイドレーション対応

- `useDarkMode` フックの初期値は `false` とし、`useEffect` 内で `localStorage` を読み込む
- これにより SSR 時とクライアント初期レンダリング時の値が一致し、ハイドレーションエラーを防ぐ
- ダークモードの初期化は `useEffect` が実行された直後（クライアントサイドのみ）に行われるため、初回レンダリング時に一瞬ライトモードで表示される可能性がある（フラッシュ）。必要に応じて `<html>` にスクリプトを追加してフラッシュを防ぐ対応も検討する（今回のスコープでは対応しない）

### 11.2 CSS変数によるテーマ管理

- ヘッダーや DarkModeToggle のスタイルには CSS 変数（`var(--header-bg)` 等）を使用する
- CSS 変数は `app/globals.css` に定義し、`[data-theme="dark"]` セレクターで上書きする方式を採用する

### 11.3 既存コンポーネントへの影響

- 既存の CSS ファイル（`ProfileEditForm.module.css` 等）はハードコードされた色を使用しているため、ダークモードの色変化は今回スコープ外とする
- 将来的に既存コンポーネントもダークモード対応する場合は、CSS 変数に移行する作業が必要

### 11.4 `'use client'` ディレクティブ

- `useDarkMode` は `localStorage` と `document` にアクセスするため、クライアントコンポーネントとして実装する
- `Header` コンポーネントはクライアントコンポーネントである `useDarkMode` を利用するため、`'use client'` を宣言する
- `DarkModeToggle` も `'use client'` を宣言する（インタラクティブなボタンのため）
- `app/layout.tsx` は Server Component のままでよい（`Header` が内部で `'use client'` を管理するため）

## 12. 実装順序

依存関係に基づき、以下の順序で実装する。

| 順序 | ファイル | 種別 | 新規/変更 | 依存先 |
|------|----------|------|-----------|--------|
| 1 | `app/globals.css` | グローバルCSS | 新規 | なし |
| 2 | `src/hooks/useDarkMode.ts` | Hook | 新規 | なし |
| 3 | `src/components/DarkModeToggle.tsx` + CSS | コンポーネント | 新規 | なし |
| 4 | `src/components/Header.tsx` + CSS | コンポーネント | 新規 | 順序2, 3 |
| 5 | `app/layout.tsx` | レイアウト | 変更 | 順序4 |
| 6 | テスト追加 | テスト | 新規 | 順序2-5 |

**並列実装可能なグループ**:
- 順序2（`useDarkMode`）と 順序3（`DarkModeToggle`）は互いに独立しているため並列実装可能

## 13. 依存関係図

```
app/globals.css（新規: CSS変数定義）
  ↓（参照）
src/hooks/useDarkMode.ts（新規: ダークモード状態管理）
  ↓
src/components/DarkModeToggle.tsx + CSS（新規: トグルボタンUI）
  ↓（参照）
src/components/Header.tsx + CSS（新規: ヘッダーコンポーネント）
  ↓
app/layout.tsx（変更: Header 組み込み）
```
