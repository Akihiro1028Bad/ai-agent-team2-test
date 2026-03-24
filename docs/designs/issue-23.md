# [Issue #23] DBスキーマ設計変更（認証テーブル追加）

## 概要

JWT認証機能（Issue #9）の実装に必要なDBスキーマ変更を行う。
具体的には、既存の `users` テーブルへのOAuth関連カラム追加と、リフレッシュトークン管理のための `refresh_tokens` テーブルの新規作成を行う。

- **親Issue**: #9 (JWT認証実装)
- **優先順位**: 1（最高）
- **依存**: なし

---

## 変更ファイル一覧

| ファイルパス | 種別 | 説明 |
|---|---|---|
| `src/db/migrations/001_add_oauth_columns_to_users.ts` | 新規作成 | usersテーブルへのOAuth関連カラム追加マイグレーション |
| `src/db/migrations/002_create_refresh_tokens.ts` | 新規作成 | refresh_tokensテーブル作成マイグレーション |
| `src/db/schema/users.ts` | 更新 | usersテーブルスキーマ定義に新カラムを追加 |
| `src/db/schema/refreshTokens.ts` | 新規作成 | refresh_tokensテーブルスキーマ定義 |
| `src/types/auth.ts` | 新規作成 | 認証関連の型定義 |
| `tests/db/migrations/001_add_oauth_columns_to_users.test.ts` | 新規作成 | マイグレーション001のテスト |
| `tests/db/migrations/002_create_refresh_tokens.test.ts` | 新規作成 | マイグレーション002のテスト |

---

## 実装方針

### 1. `users` テーブルへのカラム追加

既存の `users` テーブルに以下のカラムを追加する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `oauth_provider` | `VARCHAR(50)` | NULLABLE | NULL | OAuthプロバイダー識別子（例: `"google"`, `"github"`）|
| `oauth_id` | `VARCHAR(255)` | NULLABLE | NULL | OAuthプロバイダー側のユーザーID |

**設計上の判断**:
- 両カラムともNULLABLEとし、既存のパスワード認証ユーザーとの後方互換性を保つ。
- `(oauth_provider, oauth_id)` の複合ユニーク制約を追加し、同一プロバイダーでの重複登録を防ぐ。
- 将来的に複数のOAuthプロバイダーに対応できるよう、`oauth_provider` はENUM型ではなくVARCHARとする。

**マイグレーションSQL（概要）**:
```sql
ALTER TABLE users
  ADD COLUMN oauth_provider VARCHAR(50)  NULL DEFAULT NULL,
  ADD COLUMN oauth_id       VARCHAR(255) NULL DEFAULT NULL;

CREATE UNIQUE INDEX uq_users_oauth
  ON users (oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;
```

---

### 2. `refresh_tokens` テーブルの新規作成

JWTリフレッシュトークンのライフサイクルを管理するテーブルを新規作成する。

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---|---|---|---|---|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | 主キー |
| `user_id` | `UUID` | NOT NULL | — | `users.id` への外部キー |
| `token_hash` | `VARCHAR(255)` | NOT NULL | — | リフレッシュトークンのSHA-256ハッシュ値（平文は保存しない）|
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | — | トークンの有効期限 |
| `revoked_at` | `TIMESTAMPTZ` | NULLABLE | NULL | 失効日時（NULL = 有効）|
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | レコード作成日時 |
| `user_agent` | `TEXT` | NULLABLE | NULL | 発行時のUser-Agent（セキュリティ監査用）|
| `ip_address` | `VARCHAR(45)` | NULLABLE | NULL | 発行時のIPアドレス（IPv6対応のため45文字）|

**設計上の判断**:
- トークン自体はDBに保存せず、SHA-256ハッシュ値のみ保存することでDB漏洩時のリスクを軽減する。
- `revoked_at` カラムで失効管理を行い、ログアウト・強制無効化に対応する。
- `user_id` に外部キー制約を設け、ユーザー削除時はCASCADE削除とする。
- `token_hash` にインデックスを追加し、トークン検証時のルックアップを高速化する。
- `expires_at <= NOW()` または `revoked_at IS NOT NULL` のトークンは無効として扱う。

**マイグレーションSQL（概要）**:
```sql
CREATE TABLE refresh_tokens (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   VARCHAR(255) NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ NULL     DEFAULT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT        NULL     DEFAULT NULL,
  ip_address   VARCHAR(45) NULL     DEFAULT NULL
);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_id    ON refresh_tokens (user_id);
```

---

### 3. TypeScript型定義

```typescript
// src/types/auth.ts

export type OAuthProvider = 'google' | 'github' | 'microsoft';

export interface UserOAuthFields {
  oauth_provider: OAuthProvider | null;
  oauth_id: string | null;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  user_agent: string | null;
  ip_address: string | null;
}

export interface CreateRefreshTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  user_agent?: string;
  ip_address?: string;
}
```

---

### 4. マイグレーション管理方針

- マイグレーションは連番プレフィックス（`001_`, `002_`, ...）で管理し、適用順序を明示する。
- 各マイグレーションは `up()` / `down()` を実装し、ロールバック可能とする。
- CI/CDパイプラインでのマイグレーション自動適用を前提とする。

---

## テスト方針

### 単体テスト（マイグレーション）

各マイグレーションファイルに対してテストを作成する。

| テストケース | 内容 |
|---|---|
| `up()` 実行後のスキーマ検証 | カラム・テーブル・インデックス・制約が正しく作成されていることを確認 |
| `down()` 実行後のスキーマ検証 | `up()` で行った変更が完全にロールバックされることを確認 |
| `up()` のべき等性 | 2回連続実行してもエラーにならないことを確認（IF NOT EXISTSなど） |

### データ整合性テスト

| テストケース | 内容 |
|---|---|
| OAuthユニーク制約 | 同一 `(oauth_provider, oauth_id)` の重複INSERTが拒否されることを確認 |
| 外部キー制約 | `users` レコード削除時に関連 `refresh_tokens` がCASCADE削除されることを確認 |
| NULLトークン | `oauth_provider = NULL` のユーザーが複数存在できることを確認 |
| トークンハッシュインデックス | `token_hash` での検索がインデックスを使用することを確認（EXPLAIN ANALYZE）|

### テスト環境

- テスト用DBはDockerコンテナ（PostgreSQL）を使用し、テストごとにマイグレーションを適用・ロールバックする。
- テストフレームワーク: **Vitest**
- DBクライアント: **pg** (node-postgres) または **Drizzle ORM**

---

## 関連Issue

- 親Issue: [#9 JWT認証実装](../issues/9)
- 後続Issue: DBスキーマ完成後、認証APIエンドポイント実装へ

---

*作成日: 2026-03-24*
