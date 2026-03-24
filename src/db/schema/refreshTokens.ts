/**
 * refresh_tokens テーブルのスキーマ定義
 * Issue #23: refresh_tokens テーブル新規作成
 */

import type { RefreshToken } from '../../types/auth';

export type { RefreshToken };

/** refresh_tokens テーブル作成 DDL */
export const CREATE_REFRESH_TOKENS_TABLE_SQL = `
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
`.trim();

/** token_hash インデックス DDL（トークン検証時のルックアップ高速化）*/
export const CREATE_REFRESH_TOKENS_HASH_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash
    ON refresh_tokens (token_hash);
`.trim();

/** user_id インデックス DDL（ユーザー単位のトークン一覧取得高速化）*/
export const CREATE_REFRESH_TOKENS_USER_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
    ON refresh_tokens (user_id);
`.trim();
