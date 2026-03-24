/**
 * users テーブルのスキーマ定義
 * Issue #23: oauth_provider / oauth_id カラム追加
 */

import type { OAuthProvider } from '../../types/auth';

/** users テーブルのレコード型 */
export interface User {
  id: string;                          // UUID 主キー
  email: string;                       // メールアドレス（ユニーク）
  password_hash: string | null;        // パスワードハッシュ（OAuth専用ユーザーはNULL）
  display_name: string | null;         // 表示名
  oauth_provider: OAuthProvider | null; // OAuthプロバイダー識別子（既存ユーザーはNULL）
  oauth_id: string | null;             // OAuthプロバイダー側のユーザーID（既存ユーザーはNULL）
  created_at: Date;                    // レコード作成日時
  updated_at: Date;                    // レコード更新日時
}

/** users テーブル作成 DDL */
export const CREATE_USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id             UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NULL     DEFAULT NULL,
    display_name   VARCHAR(100) NULL     DEFAULT NULL,
    oauth_provider VARCHAR(50)  NULL     DEFAULT NULL,
    oauth_id       VARCHAR(255) NULL     DEFAULT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_email UNIQUE (email)
  );
`.trim();

/** (oauth_provider, oauth_id) の複合ユニークインデックス DDL */
export const CREATE_USERS_OAUTH_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS uq_users_oauth
    ON users (oauth_provider, oauth_id)
    WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;
`.trim();
