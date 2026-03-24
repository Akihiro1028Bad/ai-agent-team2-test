/**
 * Migration 001: users テーブルへの OAuth 関連カラム追加
 *
 * 変更内容:
 *   - oauth_provider VARCHAR(50)  NULLABLE カラム追加
 *   - oauth_id       VARCHAR(255) NULLABLE カラム追加
 *   - (oauth_provider, oauth_id) 複合ユニーク部分インデックス追加
 *
 * Issue #23 / 親 Issue #9 (JWT認証実装)
 */

export const migration = {
  name: '001_add_oauth_columns_to_users',

  /**
   * マイグレーション適用
   * - 既存ユーザーへの影響を避けるため両カラムは NULLABLE
   * - 部分インデックスにより oauth_provider/oauth_id が両方 NOT NULL の場合のみ一意制約を適用
   */
  up: `
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50)  NULL DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS oauth_id       VARCHAR(255) NULL DEFAULT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_oauth
      ON users (oauth_provider, oauth_id)
      WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;
  `.trim(),

  /**
   * マイグレーションロールバック
   * - インデックスを先に削除してからカラムを削除する
   */
  down: `
    DROP INDEX IF EXISTS uq_users_oauth;

    ALTER TABLE users
      DROP COLUMN IF EXISTS oauth_provider,
      DROP COLUMN IF EXISTS oauth_id;
  `.trim(),
};
