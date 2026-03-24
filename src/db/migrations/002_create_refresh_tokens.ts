/**
 * Migration 002: refresh_tokens テーブル新規作成
 *
 * 変更内容:
 *   - refresh_tokens テーブル作成
 *   - token_hash インデックス追加（検証時ルックアップ高速化）
 *   - user_id インデックス追加（ユーザー単位一覧取得高速化）
 *
 * 設計上の注意:
 *   - トークン平文は保存しない。SHA-256 ハッシュ値のみ保存。
 *   - users.id に ON DELETE CASCADE 外部キー制約あり。
 *   - revoked_at IS NOT NULL または expires_at <= NOW() のレコードは無効扱い。
 *
 * Issue #23 / 親 Issue #9 (JWT認証実装)
 */

export const migration = {
  name: '002_create_refresh_tokens',

  /**
   * マイグレーション適用
   */
  up: `
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash   VARCHAR(255) NOT NULL,
      expires_at   TIMESTAMPTZ  NOT NULL,
      revoked_at   TIMESTAMPTZ  NULL     DEFAULT NULL,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      user_agent   TEXT         NULL     DEFAULT NULL,
      ip_address   VARCHAR(45)  NULL     DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
      ON refresh_tokens (token_hash);

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
      ON refresh_tokens (user_id);
  `.trim(),

  /**
   * マイグレーションロールバック
   * - テーブルを DROP すればインデックスも自動削除される
   */
  down: `
    DROP TABLE IF EXISTS refresh_tokens;
  `.trim(),
};
