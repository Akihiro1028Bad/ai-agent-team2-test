/**
 * JWT ペイロード・結果型定義
 * Issue #24: JWT発行・検証ロジック実装
 */

// ─── トークン種別 ────────────────────────────────────────────

/** トークン種別リテラル型 */
export type TokenType = 'access' | 'refresh';

// ─── JWT 標準クレーム ────────────────────────────────────────

/** JWT 標準クレーム（jsonwebtoken が自動付与するフィールド） */
export interface JwtStandardClaims {
  /** 発行日時（Unix タイムスタンプ秒） */
  iat: number;
  /** 有効期限（Unix タイムスタンプ秒） */
  exp: number;
}

// ─── アクセストークン ────────────────────────────────────────

/**
 * アクセストークンのペイロード（発行時の入力）
 * `iat` / `exp` は jsonwebtoken が自動付与するため含まない
 */
export interface AccessTokenInput {
  /** ユーザー UUID (users.id) */
  sub: string;
  /** メールアドレス */
  email: string;
}

/** アクセストークンのデコード済みペイロード（検証成功時） */
export interface AccessTokenPayload extends AccessTokenInput, JwtStandardClaims {
  type: 'access';
}

// ─── リフレッシュトークン ────────────────────────────────────

/**
 * リフレッシュトークンのペイロード（発行時の入力）
 */
export interface RefreshTokenInput {
  /** ユーザー UUID (users.id) */
  sub: string;
  /** JWT ID — DB の refresh_tokens.id（UUID v4）と紐付ける */
  jti: string;
}

/** リフレッシュトークンのデコード済みペイロード（検証成功時） */
export interface RefreshTokenPayload extends RefreshTokenInput, JwtStandardClaims {
  type: 'refresh';
}

// ─── 検証結果（Result 型） ───────────────────────────────────

/** JWT 検証失敗の理由 */
export type JwtVerifyErrorReason =
  | 'expired'      // 有効期限切れ
  | 'invalid'      // 署名不正・形式不正
  | 'wrong_type';  // トークン種別ミスマッチ

/** JWT 検証成功 */
export interface JwtVerifySuccess<T> {
  success: true;
  payload: T;
}

/** JWT 検証失敗 */
export interface JwtVerifyFailure {
  success: false;
  reason: JwtVerifyErrorReason;
}

/** JWT 検証結果（成功 | 失敗） */
export type JwtVerifyResult<T> = JwtVerifySuccess<T> | JwtVerifyFailure;

// ─── 発行オプション ──────────────────────────────────────────

/**
 * トークン発行時の追加オプション
 * （デフォルト有効期限を上書きしたい場合などに使用）
 */
export interface SignOptions {
  /** 有効期限（秒数または zeit/ms 形式文字列 e.g. "15m", "7d"） */
  expiresIn?: number | string;
}
