# Issue #129: ユーザープロフィール画面の追加 — 設計書

## 概要

ユーザープロフィール画面を完成させる。コンポーネント・フック・型定義の基盤実装はすでに揃っているが、以下の点が未実装であるため補完する。

1. **Next.js Route Handler の欠落** — フロントエンドが呼び出す `GET /api/users/{id}/profile` および `PATCH /api/users/{id}/profile` に対応する Route Handler (`app/api/users/[id]/profile/route.ts`) が存在しない
2. **ヘッダーナビゲーション未整備** — `Header.tsx` にプロフィール画面へのリンクが存在しない
3. **ページ品質の軽微な不足** — ページタイトル (`<title>`) や読み込み・エラー状態の UI 改善が不足している

---

## 現状分析

| ファイル | 状態 | 備考 |
|---|---|---|
| `app/profile/page.tsx` | 実装済み (一部課題あり) | `getCurrentUserId()` がハードコード (`'current-user-id'`)、ページタイトル未設定 |
| `src/components/UserProfileView.tsx` | 実装済み | 表示専用、アバターアップロードなし (今回スコープ外) |
| `src/components/ProfileEditForm.tsx` | 実装済み | バリデーション・エラーハンドリング込み |
| `src/hooks/useUserProfile.ts` | 実装済み | 取得・更新・エラー管理 |
| `src/api/client.ts` | 実装済み | `getUserProfile` / `updateUserProfile` を `NEXT_PUBLIC_API_URL` に向けて呼び出し |
| `src/types/user.ts` | 実装済み | `User` / `UserProfile` 定義あり |
| `app/api/users/[id]/profile/route.ts` | **未実装** | Route Handler がない |
| `src/components/Header.tsx` | **プロフィールリンクなし** | ナビゲーションに `/profile` リンクを追加する必要あり |

---

## 対応スコープ

### スコープ内

- `app/api/users/[id]/profile/route.ts` の新規実装（GET / PATCH）
- `Header.tsx` へのプロフィールナビゲーションリンク追加
- `app/profile/page.tsx` のページタイトル設定・ローディング/エラー UI の改善

### スコープ外

- 認証基盤との統合（`getCurrentUserId()` のハードコードは既存 TODO のままとし、別 Issue で対応）
- アバター画像アップロード（別 Issue で対応）

---

## 詳細設計

### 1. Route Handler — `app/api/users/[id]/profile/route.ts`

#### GET `/api/users/[id]/profile`

- パスパラメータ `id` を受け取り、対応するユーザーのプロフィールを返す
- 今回は外部バックエンドが未確定なため、**静的モックデータ**で実装し、環境変数 `BACKEND_API_URL` が設定されている場合は外部 API へプロキシする構造とする
- レスポンス型は `UserProfile` に準拠した JSON

```typescript
// レスポンス例
{
  "id": "current-user-id",
  "name": "サンプルユーザー",
  "email": "sample@example.com",
  "avatarUrl": null,
  "bio": null,
  "location": null,
  "website": null,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### PATCH `/api/users/[id]/profile`

- リクエストボディに `Partial<UserProfile>` を受け取り、更新後のプロフィールを返す
- 更新可能フィールド: `name`, `bio`, `location`, `website`
- `id`・`email`・`createdAt` は更新不可 (リクエストに含まれても無視)
- バリデーション:
  - `name`: 必須、空文字不可
  - `bio`: 200文字以内
  - `location`: 100文字以内
  - `website`: `https://` で始まること

#### エラーレスポンス

| 状況 | HTTPステータス | メッセージ |
|---|---|---|
| `id` が空 | 400 | `"User ID is required"` |
| バリデーション失敗 | 400 | フィールドごとのエラーメッセージ |
| ユーザーが見つからない | 404 | `"User not found"` |
| サーバー内部エラー | 500 | `"Internal server error"` (詳細は露出しない) |

---

### 2. Header ナビゲーション — `src/components/Header.tsx`

- `<nav>` 要素に `/profile` へのリンクを追加する
- Next.js の `<Link>` コンポーネントを使用
- リンクテキスト: 「プロフィール」
- 既存のダークモードトグルと同じ `actions` エリアに配置

```
[Sample App]           [プロフィール] [ダークモードトグル]
```

---

### 3. ProfilePage 品質改善 — `app/profile/page.tsx`

- `export const metadata` による `<title>` の設定: `"プロフィール | Sample App"`
  - ただし `'use client'` ディレクティブとの共存が不可のため、Server Component ラッパーを導入する
- ローディング中の表示を `<div role="status">読み込み中...</div>` とし、スクリーンリーダー対応を改善
- エラー表示にリトライボタンを追加

#### Server/Client コンポーネント分割

```
app/profile/
  page.tsx          ← Server Component (メタデータ設定・getCurrentUserId呼び出し)
  ProfileClient.tsx ← 新規 Client Component ('use client' ディレクティブ移設)
```

---

## データフロー

```
ブラウザ
  └─ ProfilePage (Server Component)
       └─ ProfileClient (Client Component)
            └─ useUserProfile(userId)
                  └─ src/api/client.ts
                        └─ GET /api/users/{id}/profile  ← Route Handler (今回実装)
                        └─ PATCH /api/users/{id}/profile ← Route Handler (今回実装)
```

---

## セキュリティ考慮事項

- **入力バリデーション**: Route Handler 側で全フィールドを検証し、フロント側バリデーションのバイパスを防ぐ
- **更新不可フィールドの保護**: `id`・`email`・`createdAt` はリクエストボディに含まれても更新しない (allowlist 方式)
- **エラーメッセージの機密情報漏洩防止**: 500 エラー時はサーバー内部の例外メッセージをレスポンスに含めない。ログには記録する
- **XSS 対策**: Next.js / React のデフォルト JSX エスケープに依存。`dangerouslySetInnerHTML` は使用しない
- **SSRF 対策**: 将来的に外部バックエンドへプロキシする場合、`BACKEND_API_URL` は環境変数で管理し、ユーザー入力から生成しない

---

## テスト戦略

### ユニットテスト対象と方針

| 対象 | テストファイル | 方針 |
|---|---|---|
| Route Handler (GET/PATCH) | `app/api/users/[id]/profile/route.test.ts` (新規) | `NextRequest` をモックして正常系・バリデーション失敗・404 を検証 |
| `Header.tsx` | `src/components/__tests__/Header.test.tsx` (既存拡張) | プロフィールリンクが描画されることを検証 |
| `ProfileClient.tsx` | `app/profile/__tests__/page.test.tsx` (既存拡張) | メタデータ・リトライボタン・ローディング UI を追加検証 |

### カバレッジ目標

- テストカバレッジ **80% 以上** を維持する
- Route Handler は正常系・バリデーション異常系・404 の3ケース以上をカバーする
- `Header.tsx` のリンク追加に伴うスナップショット/描画テストを更新する

---

## サブタスク

### subtask-1: Next.js Route Handler の実装
- files: [`app/api/users/[id]/profile/route.ts`, `src/api/__tests__/client.test.ts`]
- depends_on: []
- description: `GET /api/users/[id]/profile` および `PATCH /api/users/[id]/profile` のRoute Handlerを新規実装する。モックデータを返す実装とし、バリデーション・エラーハンドリングを含める。既存の `src/api/__tests__/client.test.ts` に Route Handler との統合観点のテストケースを追加する。

### subtask-2: Headerナビゲーションへのプロフィールリンク追加
- files: [`src/components/Header.tsx`, `src/components/__tests__/Header.test.tsx`]
- depends_on: []
- description: `Header.tsx` の `actions` エリアに Next.js `<Link>` を使った `/profile` へのナビゲーションリンクを追加する。`Header.test.tsx` を更新してリンクの描画を検証するテストを追加する。

### subtask-3: ProfilePage のServer/Clientコンポーネント分割とUI品質改善
- files: [`app/profile/page.tsx`, `app/profile/ProfileClient.tsx`, `app/profile/__tests__/page.test.tsx`]
- depends_on: [1]
- description: `page.tsx` を Server Component に変更してメタデータを設定し、Client Component の処理を `ProfileClient.tsx` に分離する。ローディング表示・エラー表示・リトライ機能を改善する。`page.test.tsx` を更新して新しいコンポーネント構成に対応したテストを追加する。
