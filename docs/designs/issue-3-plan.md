# 実装計画: Issue #3 - ユーザープロフィール画面を追加したい

## 変更ファイル一覧（実装順）

| # | ファイル | 種別 | 内容 |
|---|---------|------|------|
| 1 | `src/types/user.ts` | 新規作成 | `User` インターフェース定義 |
| 2 | `src/api/user.ts` | 新規作成 | `GET /api/users/:id` を呼び出す API クライアント |
| 3 | `src/components/UserProfile.tsx` | 新規作成 | プロフィール情報を表示するカードコンポーネント（ページ統合含む） |
| 4 | `tests/UserProfile.test.tsx` | 新規作成 | `UserProfile` コンポーネントのユニットテスト |

---

## 各ファイルの変更内容

### 1. `src/types/user.ts`

- `User` インターフェースを定義する
- フィールド: `id`, `name`, `email`, `avatarUrl`, `bio`
- API レスポンスの型として利用する

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  bio: string;
}
```

### 2. `src/api/user.ts`

- `fetchUser(id: string): Promise<User>` 関数を実装する
- `fetch` を使用して `GET /api/users/:id` を呼び出す
- 404 / 5xx に対するエラーハンドリングを実装する
- カスタムエラークラス `UserNotFoundError` / `ApiError` を定義する

### 3. `src/components/UserProfile.tsx`

- `id: string` を props として受け取るページ統合型コンポーネント
- 内部で `fetchUser` を呼び出し、ローディング／エラー／成功の3状態を管理
- アバター・ユーザー名・メールアドレス・自己紹介文をカードレイアウトで表示
- アバター読み込み失敗時のフォールバック画像を実装
- モバイルファーストのレスポンシブ対応（Tailwind CSS クラスを想定）

### 4. `tests/UserProfile.test.tsx`

- `UserProfile` コンポーネントのユニットテスト
- テストケース:
  - ローディング中にスピナーが表示される
  - 正常取得時にプロフィール情報が表示される
  - 404 エラー時に「ユーザーが見つかりません」が表示される
  - 5xx エラー時に汎用エラーメッセージが表示される
  - `avatarUrl` が空の場合にフォールバックが表示される

---

## テスト方針

### ユニットテスト

- **フレームワーク**: Vitest + React Testing Library（または Jest）を想定
- **モック方針**: `src/api/user.ts` の `fetchUser` をモック化してコンポーネントをテスト
- **カバレッジ目標**:
  - ローディング状態
  - 正常表示（全フィールド）
  - 404 エラー表示
  - 5xx エラー表示
  - アバターフォールバック

### E2E テスト（将来対応）

- `/users/:id` へのアクセスでプロフィールカードが表示されることを確認
- 存在しない ID でアクセスした場合の 404 表示を確認

---

## 実装上の注意点

1. **認証なし**: 今回スコープ外。任意の `:id` でアクセス可能
2. **バックエンド依存**: `GET /api/users/:id` のレスポンス仕様は設計書の JSON を参照
3. **ルーティング**: 今回の実装スコープはコンポーネント・API クライアント・型定義のみ。ルーター設定は別途 `src/router.tsx` に追加が必要
