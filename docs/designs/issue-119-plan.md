# 実装計画: Issue #119 ダークモード切り替えボタンの追加

## 概要

ヘッダーコンポーネントを新規作成し、右上にダークモード/ライトモードを切り替えるトグルボタンを配置する。
CSS変数（カスタムプロパティ）で色管理を行い、`localStorage` で選択を永続化する。
実装はCSS Modulesで行い、Tailwind CSSは使用しない。

実装対象ファイルは以下のとおり:
- 新規作成: `app/globals.css`, `src/hooks/useDarkMode.ts`, `src/components/DarkModeToggle.tsx`, `src/components/DarkModeToggle.module.css`, `src/components/Header.tsx`, `src/components/Header.module.css`, テスト3ファイル
- 変更: `app/layout.tsx`（Headerコンポーネントの組み込み）

## サブタスク

### subtask-1: グローバルCSS変数定義とダークモードHook

- files: [`app/globals.css`, `src/hooks/useDarkMode.ts`]
- depends_on: []
- description: |
    アプリ全体のテーマ基盤を構築する。

    `app/globals.css` では `:root` および `[data-theme="light"]`、`[data-theme="dark"]` セレクターに CSS変数を定義する。
    定義する変数: `--bg-color`, `--text-color`, `--header-bg`, `--header-border`, `--border-color`, `--button-bg`, `--button-color`, `--button-hover-bg`。
    また `body` に `background-color: var(--bg-color)` と `color: var(--text-color)` を設定し、`transition` でスムーズな切り替えを実現する。

    `src/hooks/useDarkMode.ts` では以下の仕様でHookを実装する:
    - シグネチャ: `export function useDarkMode(): { isDark: boolean; toggle: () => void }`
    - `'use client'` ディレクティブを先頭に付与する
    - 初期値は `false`（SSRでのハイドレーションエラー防止）
    - `useEffect` 内でのみ `localStorage` と `window.matchMedia` にアクセスし、初期テーマを決定する
    - 2つ目の `useEffect` で `isDark` の変化を監視し、`document.documentElement.setAttribute('data-theme', theme)` および `localStorage.setItem('theme', theme)` を実行する
    - `toggle` 関数は `setIsDark((prev) => !prev)` で実装する
    - localStorage のキーは `'theme'`、値は `'dark'` または `'light'`
    - 優先順位: localStorage保存値 > OSの `prefers-color-scheme` > デフォルト `'light'`

### subtask-2: DarkModeToggleコンポーネントとスタイル

- files: [`src/components/DarkModeToggle.tsx`, `src/components/DarkModeToggle.module.css`]
- depends_on: []
- description: |
    ダークモード切り替えボタンのUIコンポーネントを実装する。subtask-1とは独立しており並列実装可能。

    `src/components/DarkModeToggle.tsx` の仕様:
    - `'use client'` ディレクティブを先頭に付与する
    - Props インターフェース: `interface DarkModeToggleProps { isDark: boolean; onToggle: () => void; }`
    - `<button>` 要素で実装し、`className={styles.toggleButton}` を付与する
    - `onClick={onToggle}` でトグル操作を実装する
    - `aria-label`: ライトモード時は `'ダークモードに切り替え'`、ダークモード時は `'ライトモードに切り替え'`
    - `title` にも同じ値を設定する
    - ボタン内部に `<span className={styles.icon}>` （ライトモード時 `🌙`、ダークモード時 `☀️`）と `<span className={styles.label}>` （ライトモード時 `'ダークモード'`、ダークモード時 `'ライトモード'`）を配置する
    - 名前付きエクスポート: `export const DarkModeToggle: React.FC<DarkModeToggleProps>`

    `src/components/DarkModeToggle.module.css` の実装:
    - `.toggleButton`: CSS変数 `var(--button-bg)`, `var(--button-color)` を使用。`border`, `border-radius`, `cursor: pointer`, `padding`, `display: flex`, `align-items: center`, `gap` などを設定。ホバー時は `var(--button-hover-bg)` に変更
    - `.icon`: アイコン（絵文字）のフォントサイズを設定
    - `.label`: ボタンラベルのフォントサイズを設定。モバイル対応としてメディアクエリで非表示にすることも検討する

### subtask-3: Headerコンポーネント、スタイル、およびlayout.tsx変更

- files: [`src/components/Header.tsx`, `src/components/Header.module.css`, `app/layout.tsx`]
- depends_on: [1, 2]
- description: |
    subtask-1, 2 の完了後に実装する。ヘッダーコンポーネントを作成し、レイアウトに組み込む。

    `src/components/Header.tsx` の仕様:
    - `'use client'` ディレクティブを先頭に付与する
    - `useDarkMode` を `'../hooks/useDarkMode'` からインポートする
    - `DarkModeToggle` を `'./DarkModeToggle'` からインポートする
    - `styles` を `'./Header.module.css'` からインポートする
    - Props なし（状態は内部の `useDarkMode` フックで管理）
    - JSX構成: `<header className={styles.header}>` > `<div className={styles.inner}>` > 左側に `<div className={styles.logo}>Sample App</div>`、右側に `<div className={styles.actions}>` > `<DarkModeToggle isDark={isDark} onToggle={toggle} />`
    - 名前付きエクスポート: `export const Header: React.FC`

    `src/components/Header.module.css` の実装:
    - `.header`: `background-color: var(--header-bg)`, `border-bottom: 1px solid var(--header-border)`, `position: sticky`, `top: 0`, `z-index: 100`, `transition` によるスムーズな色変化
    - `.inner`: `max-width`, `margin: 0 auto`, `padding`, `display: flex`, `justify-content: space-between`, `align-items: center`
    - `.logo`: フォントサイズ、フォントウェイト、`color: var(--text-color)`
    - `.actions`: `display: flex`, `align-items: center`, `gap`

    `app/layout.tsx` の変更:
    - `import { Header } from '../src/components/Header';` を追加する
    - `import './globals.css';` を追加してCSS変数を読み込む
    - `<body>` 内の先頭に `<Header />` を追加する
    - `app/layout.tsx` 自体は Server Component のままで問題ない（`Header` 内部で `'use client'` を管理するため）

### subtask-4: テスト群

- files: [`src/hooks/__tests__/useDarkMode.test.ts`, `src/components/__tests__/DarkModeToggle.test.tsx`, `src/components/__tests__/Header.test.tsx`]
- depends_on: [1, 2, 3]
- description: |
    subtask-1, 2, 3 の完了後に実装する。3つのテストファイルは互いに独立しているため並列作業が可能。

    `src/hooks/__tests__/useDarkMode.test.ts` のテストケース（`renderHook`, `act`, `waitFor` を使用）:
    1. 初期値テスト（localStorage なし、OS設定なし）: `isDark` が `false` であること
    2. localStorage に `'dark'` が保存されている場合: `isDark` が `true` であること
    3. localStorage に `'light'` が保存されている場合: `isDark` が `false` であること
    4. OS設定がダークモードの場合（localStorage なし）: `isDark` が `true` であること
    5. `toggle` 呼び出しで `isDark` が反転すること
    6. `toggle` 後に `localStorage.setItem` が正しいキー・値で呼ばれること
    7. `toggle` 後に `document.documentElement.getAttribute('data-theme')` が正しい値になること

    テスト実装のポイント:
    - `localStorage` は `beforeEach` でクリア（`localStorage.clear()`）
    - `window.matchMedia` は `jest.fn()` でモックを作成してテストケースごとに設定
    - `act` 内で `toggle` を呼び出し、状態更新を待つ

    `src/components/__tests__/DarkModeToggle.test.tsx` のテストケース（`render`, `screen`, `fireEvent` を使用）:
    1. ライトモード時（`isDark=false`）のボタン表示: `🌙` と「ダークモード」が表示されること
    2. ダークモード時（`isDark=true`）のボタン表示: `☀️` と「ライトモード」が表示されること
    3. ライトモード時の `aria-label`: 「ダークモードに切り替え」であること
    4. ダークモード時の `aria-label`: 「ライトモードに切り替え」であること
    5. クリック時に `onToggle` が1回呼ばれること（`jest.fn()` でモック）

    `src/components/__tests__/Header.test.tsx` のテストケース:
    1. `<header>` 要素が表示されること（`render(<Header />)` でレンダリング）
    2. 「Sample App」が表示されること
    3. トグルボタン（DarkModeToggle）が含まれること（`aria-label` または絵文字で確認）

    テスト実装のポイント:
    - `Header` コンポーネントは `useDarkMode` フックを内部で使用するため、`localStorage` と `window.matchMedia` のモックが必要
    - 既存テストパターン（`UserCard.test.tsx`, `useNotificationSettings.test.ts`）に従い、`jest.clearAllMocks()` を `beforeEach` に記述する
    - CSS Modulesは `identity-obj-proxy` により自動的にモックされる（`jest.config.js` で設定済み）
