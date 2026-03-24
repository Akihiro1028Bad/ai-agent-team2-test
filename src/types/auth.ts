/**
 * 認証関連の型定義
 * Issue #23: DBスキーマ設計変更（認証テーブル追加）
 */

/** サポートするOAuthプロバイダー */
export type OAuthProvider = 'google' | 'github' | 'microsoft';

/** users テーブルに追加する OAuth 関連フィールド */
export interface UserOAuthFields {
  oauth_provider: OAuthProvider | null;
  oauth_id: string | null;
}

/** refresh_tokens テーブルのレコード型 */
export interface RefreshToken {
  id: string;               // UUID 主キー
  user_id: string;          // users.id への外部キー
  token_hash: string;       // SHA-256 ハッシュ値（平文は非保存）
  expires_at: Date;         // 有効期限
  revoked_at: Date | null;  // 失効日時（null = 有効）
  created_at: Date;         // レコード作成日時
  user_agent: string | null; // 発行時の User-Agent（監査用）
  ip_address: string | null; // 発行時の IP アドレス（監査用）
}

/** refresh_tokens レコード作成時の入力型 */
export interface CreateRefreshTokenInput {
  user_id: string;
  token_hash: string;
  expires_at: Date;
  user_agent?: string;
  ip_address?: string;
}

/** トークンの有効性チェック結果 */
export interface TokenValidationResult {
  isValid: boolean;
  reason?: 'expired' | 'revoked' | 'not_found';
}
